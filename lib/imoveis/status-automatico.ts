import "server-only";

import { revalidatePath } from "next/cache";

import { STATUS_NOME_TO_SLUG } from "@/lib/constants/imoveis";
import { registrarAuditoriaImovel } from "@/lib/imoveis/auditoria";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";
import type { StatusImovel, StatusImovelSlug } from "@/types";

function slugFromStatusRecord(status: StatusImovel | null): StatusImovelSlug {
  if (!status) {
    return "disponivel";
  }

  return STATUS_NOME_TO_SLUG[status.nome] ?? "disponivel";
}

export async function atualizarStatusImovelAutomatico(
  imovelId: string,
  statusNome: "Disponível" | "Reservado" | "Vendido" | "Locado",
  motivo: string,
  detalhes?: Record<string, unknown>,
): Promise<void> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return;
  }

  const supabase = await createClient();
  const { data: status } = await supabase
    .from("status_imovel")
    .select("*")
    .eq("corretor_id", corretor.id)
    .eq("nome", statusNome)
    .maybeSingle();

  if (!status) {
    return;
  }

  const slug = slugFromStatusRecord(status as StatusImovel);
  const updatePayload: Record<string, unknown> = {
    status_imovel_id: status.id,
    status: slug,
  };

  if (slug === "vendido" || slug === "locado") {
    updatePayload.data_desativacao = new Date().toISOString();
  }

  await supabase
    .from("imoveis")
    .update(updatePayload)
    .eq("id", imovelId)
    .eq("corretor_id", corretor.id);

  await registrarAuditoriaImovel(imovelId, "status_automatico", {
    motivo,
    detalhes: { status: statusNome, ...detalhes },
  });

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${imovelId}`);
}
