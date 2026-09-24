import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Usuário auth que deve receber alertas do atendimento (responsável ou dono da conta). */
export async function resolveDestinatarioUserId(
  supabase: SupabaseClient,
  corretorId: string,
  perfilId?: string | null,
): Promise<string | null> {
  if (perfilId) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("user_id, ativo")
      .eq("id", perfilId)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (perfil?.ativo !== false && perfil?.user_id) {
      return perfil.user_id;
    }
  }

  const { data: corretor } = await supabase
    .from("corretores")
    .select("user_id")
    .eq("id", corretorId)
    .maybeSingle();

  return corretor?.user_id ?? null;
}
