import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PushSubscriptionRow = {
  corretor_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function savePushSubscription(
  admin: SupabaseClient,
  row: PushSubscriptionRow,
): Promise<{ error: { code?: string; message: string } | null }> {
  const { data: existing, error: selectError } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", row.user_id)
    .eq("endpoint", row.endpoint)
    .maybeSingle();

  if (selectError) {
    return { error: { code: selectError.code, message: selectError.message } };
  }

  if (existing?.id) {
    const { error: updateError } = await admin
      .from("push_subscriptions")
      .update({
        corretor_id: row.corretor_id,
        p256dh: row.p256dh,
        auth: row.auth,
      })
      .eq("id", existing.id);

    if (updateError) {
      return { error: { code: updateError.code, message: updateError.message } };
    }
    return { error: null };
  }

  const { error: insertError } = await admin.from("push_subscriptions").insert(row);

  if (insertError) {
    return { error: { code: insertError.code, message: insertError.message } };
  }

  return { error: null };
}
