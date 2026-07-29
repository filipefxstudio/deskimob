"use server";

import { STATUS_IMOVEL } from "@/lib/constants/imoveis";
import { isImovelIgnoradoNaDuplicidadeEndereco } from "@/lib/imoveis/republicar";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";
import type { StatusImovelSlug } from "@/types";

export type AlertaRepublicacaoImovel = {
  imovelOrigemId: string;
  imovelOrigemCodigo: string;
  statusOrigem: StatusImovelSlug;
  statusOrigemLabel: string;
};

type EnderecoImovelRow = {
  logradouro: string | null;
  numero: string | null;
  complemento_valor?: string | null;
  complemento?: string | null;
  complemento_numero?: string | null;
  complemento_tipo?: string | null;
};

type ImovelEncerradoRow = EnderecoImovelRow & {
  id: string;
  codigo: string | null;
  status: string | null;
  atualizado_em?: string | null;
  criado_em?: string | null;
};

function labelStatusImovel(slug: string): string {
  return STATUS_IMOVEL.find((item) => item.value === slug)?.label ?? slug;
}

function normalizeComplementoEndereco(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

function complementoFromImovelRow(imovel: EnderecoImovelRow): string {
  const fromValor =
    imovel.complemento_valor?.trim() ||
    imovel.complemento?.trim() ||
    [imovel.complemento_tipo, imovel.complemento_numero].filter(Boolean).join(" ").trim();

  return normalizeComplementoEndereco(fromValor);
}

function mesmoEndereco(atual: EnderecoImovelRow, candidato: EnderecoImovelRow): boolean {
  const logradouroAtual = atual.logradouro?.toLowerCase().trim() ?? "";
  const numeroAtual = atual.numero?.toLowerCase().trim() ?? "";
  const logradouroCandidato = candidato.logradouro?.toLowerCase().trim() ?? "";
  const numeroCandidato = candidato.numero?.toLowerCase().trim() ?? "";

  if (!logradouroAtual || !numeroAtual) {
    return false;
  }

  if (logradouroAtual !== logradouroCandidato || numeroAtual !== numeroCandidato) {
    return false;
  }

  return complementoFromImovelRow(atual) === complementoFromImovelRow(candidato);
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

async function fetchAuditoriaRepublicacao(
  imovelId: string,
  corretorId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: auditoriaRows, error: auditoriaError } = await supabase
    .from("auditoria_imovel")
    .select("detalhes")
    .eq("imovel_id", imovelId)
    .eq("corretor_id", corretorId)
    .eq("acao", "imovel_cadastrado")
    .order("criado_em", { ascending: true });

  if (!auditoriaError && auditoriaRows?.length) {
    for (const row of auditoriaRows) {
      const parsed = parseRepublicacaoDetalhes(
        row.detalhes as Record<string, unknown> | null | undefined,
      );
      if (parsed) {
        return parsed.imovelOrigemId;
      }
    }
  }

  if (auditoriaError) {
    console.error("[getAlertaRepublicacaoImovel] auditoria read failed", auditoriaError);
  }

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackRows, error: fallbackError } = await admin
      .from("auditoria_imovel")
      .select("detalhes")
      .eq("imovel_id", imovelId)
      .eq("corretor_id", corretorId)
      .eq("acao", "imovel_cadastrado")
      .order("criado_em", { ascending: true });

    if (fallbackError) {
      console.error("[getAlertaRepublicacaoImovel] auditoria fallback failed", fallbackError);
      return null;
    }

    for (const row of fallbackRows ?? []) {
      const parsed = parseRepublicacaoDetalhes(
        row.detalhes as Record<string, unknown> | null | undefined,
      );
      if (parsed) {
        return parsed.imovelOrigemId;
      }
    }
  } catch (error) {
    console.error("[getAlertaRepublicacaoImovel] service role unavailable", error);
  }

  return null;
}

async function fetchImovelOrigemPorEndereco(
  imovelId: string,
  corretorId: string,
): Promise<ImovelEncerradoRow | null> {
  try {
    const admin = createServiceRoleClient();

    const { data: atual, error: atualError } = await admin
      .from("imoveis")
      .select(
        "logradouro, numero, complemento_valor, complemento, complemento_numero, complemento_tipo",
      )
      .eq("id", imovelId)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (atualError || !atual) {
      if (atualError) {
        console.error("[getAlertaRepublicacaoImovel] imovel atual failed", atualError);
      }
      return null;
    }

    const logradouro = atual.logradouro?.trim();
    const numero = atual.numero?.trim();

    if (!logradouro || !numero) {
      return null;
    }

    const { data: candidatos, error: candidatosError } = await admin
      .from("imoveis")
      .select(
        "id, codigo, status, logradouro, numero, complemento_valor, complemento, complemento_numero, complemento_tipo, atualizado_em, criado_em",
      )
      .eq("corretor_id", corretorId)
      .neq("id", imovelId)
      .ilike("logradouro", logradouro)
      .ilike("numero", numero);

    if (candidatosError || !candidatos?.length) {
      if (candidatosError) {
        console.error("[getAlertaRepublicacaoImovel] candidatos endereco failed", candidatosError);
      }
      return null;
    }

    const encerrados = (candidatos as ImovelEncerradoRow[]).filter(
      (row) =>
        isImovelIgnoradoNaDuplicidadeEndereco(row.status ?? "") &&
        mesmoEndereco(atual, row),
    );

    if (encerrados.length === 0) {
      return null;
    }

    encerrados.sort((a, b) => {
      const aTime = new Date(a.atualizado_em ?? a.criado_em ?? 0).getTime();
      const bTime = new Date(b.atualizado_em ?? b.criado_em ?? 0).getTime();
      return bTime - aTime;
    });

    return encerrados[0] ?? null;
  } catch (error) {
    console.error("[getAlertaRepublicacaoImovel] endereco fallback unavailable", error);
    return null;
  }
}

async function buildAlertaFromOrigem(
  corretorId: string,
  imovelOrigemId: string,
): Promise<AlertaRepublicacaoImovel | null> {
  const supabase = await createClient();
  const { data: origem, error: origemError } = await supabase
    .from("imoveis")
    .select("id, codigo, status")
    .eq("id", imovelOrigemId)
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (!origemError && origem) {
    const statusOrigem = (origem.status ?? "desativado") as StatusImovelSlug;
    return {
      imovelOrigemId: origem.id,
      imovelOrigemCodigo: origem.codigo ?? "—",
      statusOrigem,
      statusOrigemLabel: labelStatusImovel(statusOrigem),
    };
  }

  if (origemError) {
    console.error("[getAlertaRepublicacaoImovel] origem read failed", origemError);
  }

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackOrigem, error: fallbackError } = await admin
      .from("imoveis")
      .select("id, codigo, status")
      .eq("id", imovelOrigemId)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (fallbackError || !fallbackOrigem) {
      if (fallbackError) {
        console.error("[getAlertaRepublicacaoImovel] origem fallback failed", fallbackError);
      }
      return null;
    }

    const statusOrigem = (fallbackOrigem.status ?? "desativado") as StatusImovelSlug;
    return {
      imovelOrigemId: fallbackOrigem.id,
      imovelOrigemCodigo: fallbackOrigem.codigo ?? "—",
      statusOrigem,
      statusOrigemLabel: labelStatusImovel(statusOrigem),
    };
  } catch (error) {
    console.error("[getAlertaRepublicacaoImovel] origem service role unavailable", error);
    return null;
  }
}

export async function getAlertaRepublicacaoImovel(
  imovelId: string,
): Promise<AlertaRepublicacaoImovel | null> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  const imovelOrigemIdAuditoria = await fetchAuditoriaRepublicacao(imovelId, corretor.id);

  if (imovelOrigemIdAuditoria) {
    return buildAlertaFromOrigem(corretor.id, imovelOrigemIdAuditoria);
  }

  const origemPorEndereco = await fetchImovelOrigemPorEndereco(imovelId, corretor.id);

  if (!origemPorEndereco) {
    return null;
  }

  const statusOrigem = (origemPorEndereco.status ?? "desativado") as StatusImovelSlug;

  return {
    imovelOrigemId: origemPorEndereco.id,
    imovelOrigemCodigo: origemPorEndereco.codigo ?? "—",
    statusOrigem,
    statusOrigemLabel: labelStatusImovel(statusOrigem),
  };
}
