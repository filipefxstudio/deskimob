import { NextResponse } from "next/server";

import { sendPushNow, type PushDispatchPayload } from "@/lib/notifications/push-dispatch";

export const runtime = "nodejs";
export const maxDuration = 30;

function unauthorized() {
  return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
}

export async function POST(request: Request) {
  const secret = process.env.INTERNAL_PUSH_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Push dispatch desabilitado." }, { status: 503 });
  }

  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return unauthorized();
  }

  let body: PushDispatchPayload;
  try {
    body = (await request.json()) as PushDispatchPayload;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  if (!body.corretorId?.trim() || !body.title?.trim()) {
    return NextResponse.json({ error: "Payload incompleto." }, { status: 400 });
  }

  try {
    await sendPushNow(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[push/dispatch]", error);
    return NextResponse.json({ error: "Falha ao enviar push." }, { status: 500 });
  }
}
