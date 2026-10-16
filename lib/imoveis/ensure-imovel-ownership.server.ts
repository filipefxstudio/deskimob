import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function ensureImovelOwnership(
  imovelId: string,
  corretorId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("imoveis")
    .select("id")
    .eq("id", imovelId)
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (!error && data) {
    return true;
  }

  if (error) {
    console.error("[ensureImovelOwnership] failed", error);
  }

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackData, error: fallbackError } = await admin
      .from("imoveis")
      .select("id")
      .eq("id", imovelId)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (fallbackError) {
      console.error("[ensureImovelOwnership] service role fallback failed", fallbackError);
      return false;
    }

    return Boolean(fallbackData);
  } catch (fallbackError) {
    console.error("[ensureImovelOwnership] service role fallback unavailable", fallbackError);
    return false;
  }
}
