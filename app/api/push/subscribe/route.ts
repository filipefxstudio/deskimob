import { NextResponse } from "next/server";

import { sendPushForCorretor } from "@/lib/notifications/push-send";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface PushSubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

function mapSubscribeError(code: string | undefined, message: string): string {
  if (code === "42P01") {
    return "Tabela push_subscriptions ausente — aplique as migrations no Supabase.";
  }
  if (code === "42501") {
    return "Sem permissão para salvar a assinatura push.";
  }
  if (code === "23503") {
    return "Conta do corretor inválida ao registrar push.";
  }
  if (message.toLowerCase().includes("push_subscriptions")) {
    return "Tabela push_subscriptions não encontrada. Rode a migration de notificações no Supabase.";
  }
  return "Não foi possível salvar a assinatura.";
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

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (error) {
    console.error("[push/subscribe] service role", error);
    return NextResponse.json(
      { error: "Erro de configuração do servidor (service role)." },
      { status: 500 },
    );
  }

  const row = {
    corretor_id: corretor.id,
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
  };

  const { error: upsertError } = await admin.from("push_subscriptions").upsert(row, {
    onConflict: "user_id,endpoint",
  });

  if (upsertError) {
    console.error("[push/subscribe]", upsertError);
    return NextResponse.json(
      {
        error: mapSubscribeError(upsertError.code, upsertError.message ?? ""),
        code: upsertError.code,
      },
      { status: 500 },
    );
  }

  await sendPushForCorretor(
    corretor.id,
    {
      title: "Deskimob",
      body: "Alertas push ativados neste aparelho.",
      url: "/dashboard",
    },
    { destinatarioUserId: user.id },
  );

  return NextResponse.json({ success: true });
}
