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

async function countUnreadForUser(
  corretorId: string,
  userId: string | null | undefined,
): Promise<number | undefined> {
  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return undefined;
  }

  let query = supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", corretorId)
    .is("lida_em", null);

  if (userId) {
    query = query.or(`destinatario_user_id.is.null,destinatario_user_id.eq.${userId}`);
  }

  const { count } = await query;
  return count ?? undefined;
}

export async function sendPushForCorretor(
  corretorId: string,
  payload: { title: string; body?: string; url?: string; badgeCount?: number },
  options?: { destinatarioUserId?: string | null },
): Promise<void> {
  if (!pushConfigured()) {
    console.warn("[push] VAPID não configurado — push ignorado.");
    return;
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    console.error("[push] admin client", error);
    return;
  }

  let subsQuery = supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .eq("corretor_id", corretorId);

  const destinatarioUserId = options?.destinatarioUserId?.trim();
  if (destinatarioUserId) {
    subsQuery = subsQuery.eq("user_id", destinatarioUserId);
  }

  let { data: subs, error } = await subsQuery;

  if (error) {
    console.error("[push] list subscriptions", error);
    return;
  }

  if (!subs?.length && destinatarioUserId) {
    const fallback = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .eq("corretor_id", corretorId);

    if (fallback.data?.length) {
      console.warn("[push] destinatario sem assinatura; enviando para todos os aparelhos do corretor", {
        destinatarioUserId,
        aparelhos: fallback.data.length,
      });
      subs = fallback.data;
    }
  }

  if (!subs?.length) {
    console.warn("[push] nenhuma assinatura push", {
      corretorId,
      destinatarioUserId: destinatarioUserId ?? "todos",
    });
    return;
  }

  const badgeCount =
    payload.badgeCount ??
    (await countUnreadForUser(corretorId, destinatarioUserId ?? null));

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/dashboard",
    badgeCount,
  });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        json,
      );
    }),
  );

  let sent = 0;
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const sub = subs[i];
    if (result.status === "fulfilled") {
      sent += 1;
      continue;
    }
    const err = result.reason;
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    } else {
      console.error("[push] send failed", { subId: sub.id, userId: sub.user_id, err });
    }
  }

  if (sent > 0) {
    console.info("[push] enviado", { corretorId, destinatarioUserId, sent, total: subs.length });
  }
}
