import "server-only";

import webpush from "web-push";

import { createServiceRoleClient } from "@/lib/supabase/admin";

function pushConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:suporte@deskimob.com.br";
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendPushForCorretor(
  corretorId: string,
  payload: { title: string; body?: string; url?: string },
): Promise<void> {
  if (!pushConfigured()) {
    return;
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    console.error("[push] admin client", error);
    return;
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("corretor_id", corretorId);

  if (error || !subs?.length) {
    return;
  }

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/dashboard",
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push] send failed", err);
        }
      }
    }),
  );
}
