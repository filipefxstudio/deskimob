import { NextResponse } from "next/server";

import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";

interface PushSubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const corretor = await getCorretorForUser();
  if (!corretor) {
    return NextResponse.json({ error: "Corretor não encontrado." }, { status: 403 });
  }

  let body: PushSubscribeBody;
  try {
    body = (await request.json()) as PushSubscribeBody;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Assinatura push incompleta." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      corretor_id: corretor.id,
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    console.error("[push/subscribe]", error);
    return NextResponse.json({ error: "Não foi possível salvar a assinatura." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
