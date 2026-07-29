"use server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import { createClient } from "@/lib/supabase/server";

export async function registrarAuditoriaImovel(
  imovelId: string,
  acao: string,
  options?: {
    motivo?: string | null;
    detalhes?: Record<string, unknown> | null;
    perfilId?: string | null;
  },
): Promise<void> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return;
  }

  const perfil = options?.perfilId
    ? { id: options.perfilId }
    : await getPerfilForUser();

  const payload = {
    imovel_id: imovelId,
    corretor_id: corretor.id,
    perfil_id: perfil?.id ?? null,
    acao,
    motivo: options?.motivo?.trim() || null,
    detalhes: options?.detalhes ?? null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("auditoria_imovel").insert(payload);

  if (!error) {
    return;
  }

  console.error("[registrarAuditoriaImovel] insert failed", error);

  try {
    const admin = createServiceRoleClient();
    const { error: fallbackError } = await admin.from("auditoria_imovel").insert(payload);

    if (fallbackError) {
      console.error("[registrarAuditoriaImovel] service role insert failed", fallbackError);
    }
  } catch (fallbackError) {
    console.error("[registrarAuditoriaImovel] service role unavailable", fallbackError);
  }
}
