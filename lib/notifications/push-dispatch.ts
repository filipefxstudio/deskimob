import "server-only";

import { getAppOrigin } from "@/lib/auth/app-url";

import { sendPushForCorretor } from "./push-send";

export type PushDispatchPayload = {
  corretorId: string;
  destinatarioUserId?: string | null;
  title: string;
  body?: string;
  url?: string;
  badgeCount?: number;
};

/** Envia push na mesma invocação (fallback). */
export async function sendPushNow(payload: PushDispatchPayload): Promise<void> {
  await sendPushForCorretor(
    payload.corretorId,
    {
      title: payload.title,
      body: payload.body,
      url: payload.url,
      badgeCount: payload.badgeCount,
    },
    { destinatarioUserId: payload.destinatarioUserId },
  );
}

/**
 * Dispara push em outra invocação serverless (mais confiável após Server Actions na Vercel).
 * Se INTERNAL_PUSH_SECRET não estiver definido, envia inline.
 */
export function schedulePushDispatch(payload: PushDispatchPayload): void {
  const secret = process.env.INTERNAL_PUSH_SECRET?.trim();
  const origin = getAppOrigin();

  if (!secret) {
    void sendPushNow(payload).catch((error) => {
      console.error("[push] schedule inline failed", error);
    });
    return;
  }

  void fetch(`${origin}/api/push/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("[push] dispatch HTTP", response.status, text);
      }
    })
    .catch((error) => {
      console.error("[push] dispatch fetch failed", error);
    });
}
