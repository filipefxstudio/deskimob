"use server";

import { STATUS_IMOVEL } from "@/lib/constants/imoveis";
import { createClient } from "@/lib/supabase/server";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import type { StatusImovelSlug } from "@/types";

export type AlertaRepublicacaoImovel = {
  imovelOrigemId: string;
  imovelOrigemCodigo: string;
  statusOrigem: StatusImovelSlug;
  statusOrigemLabel: string;
};

function labelStatusImovel(slug: string): string {
  return STATUS_IMOVEL.find((item) => item.value === slug)?.label ?? slug;
}

function parseRepublicacaoDetalhes(
  detalhes: Record<string, unknown> | null | undefined,
): { imovelOrigemId: string } | null {
  if (!detalhes || detalhes.origem !== "republicar") {
    return null;
  }

  const imovelOrigemId = detalhes.imovelOrigemId;
  if (typeof imovelOrigemId !== "string" || !imovelOrigemId) {
    return null;
  }

  return { imovelOrigemId };
}

export async function getAlertaRepublicacaoImovel(
  imovelId: string,
): Promise<AlertaRepublicacaoImovel | null> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  const supabase = await createClient();

  const { data: auditoriaRows, error: auditoriaError } = await supabase
    .from("auditoria_imovel")
    .select("detalhes")
    .eq("imovel_id", imovelId)
    .eq("corretor_id", corretor.id)
    .eq("acao", "imovel_cadastrado")
    .order("criado_em", { ascending: true });

  if (auditoriaError || !auditoriaRows?.length) {
    return null;
  }

  let imovelOrigemId: string | null = null;

  for (const row of auditoriaRows) {
    const parsed = parseRepublicacaoDetalhes(
      row.detalhes as Record<string, unknown> | null | undefined,
    );
    if (parsed) {
      imovelOrigemId = parsed.imovelOrigemId;
      break;
    }
  }

  if (!imovelOrigemId) {
    return null;
  }

  const { data: origem, error: origemError } = await supabase
    .from("imoveis")
    .select("id, codigo, status")
    .eq("id", imovelOrigemId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (origemError || !origem) {
    return null;
  }

  const statusOrigem = (origem.status ?? "desativado") as StatusImovelSlug;

  return {
    imovelOrigemId: origem.id,
    imovelOrigemCodigo: origem.codigo ?? "—",
    statusOrigem,
    statusOrigemLabel: labelStatusImovel(statusOrigem),
  };
}
