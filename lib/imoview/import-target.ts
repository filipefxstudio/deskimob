import type { StatusImovelSlug } from "@/types";
import type { ImoviewSituacao } from "@/lib/imoview/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { XlsRow } from "@/lib/imoview/types";

/** Conta Imobee (migração original) */
export const IMOBEE_CORRETOR_ID = "400bbcb9-4c2d-43c2-af04-f2b7996618b2";
export const IMOBEE_CAPTADOR_PERFIL_ID = "82d8eff4-4dc3-4169-9dc1-5b12b117b0e5";

/** Conta Kenia Ribeiro (plano separado) */
export const KENIA_CORRETOR_ID = "7f6df903-f2cf-4852-80c5-b505e6e2968f";

export type ImoviewImportTarget = {
  id: "imobee" | "kenia";
  label: string;
  corretorId: string;
  captadorPerfilId: string;
  /** Códigos Imoview a ignorar (blocklist manual). */
  excludedCodigos: readonly string[];
  /** Filtro extra após excluir Desativado/blocklist. */
  rowFilter?: (row: XlsRow) => boolean;
};

export function isKeniaCaptadoraRow(row: XlsRow): boolean {
  return /kenia/i.test(String(row.Captadores ?? ""));
}

export async function resolveCaptadorPerfilId(
  admin: SupabaseClient,
  corretorId: string,
): Promise<string> {
  const { data, error } = await admin
    .from("perfis")
    .select("id, papel")
    .eq("corretor_id", corretorId)
    .eq("ativo", true);

  if (error) throw new Error(`Perfis do corretor: ${error.message}`);
  if (!data?.length) {
    throw new Error(`Nenhum perfil ativo encontrado para corretor ${corretorId}.`);
  }

  const adminPerfil = data.find((p) => p.papel === "admin");
  return adminPerfil?.id ?? data[0]!.id;
}

export async function buildImobeeImportTarget(
  admin: SupabaseClient,
): Promise<ImoviewImportTarget> {
  const { IMOVIEW_EXCLUDED_CODIGOS } = await import("@/lib/imoview/constants");

  return {
    id: "imobee",
    label: "Imobee / Filipe Marconi",
    corretorId: IMOBEE_CORRETOR_ID,
    captadorPerfilId: IMOBEE_CAPTADOR_PERFIL_ID,
    excludedCodigos: IMOVIEW_EXCLUDED_CODIGOS,
  };
}

export async function buildKeniaImportTarget(
  admin: SupabaseClient,
): Promise<ImoviewImportTarget> {
  const captadorPerfilId = await resolveCaptadorPerfilId(admin, KENIA_CORRETOR_ID);

  return {
    id: "kenia",
    label: "Kenia Ribeiro",
    corretorId: KENIA_CORRETOR_ID,
    captadorPerfilId,
    excludedCodigos: [],
    rowFilter: isKeniaCaptadoraRow,
  };
}

export async function resolveImportTarget(
  admin: SupabaseClient,
  targetId: string,
): Promise<ImoviewImportTarget> {
  if (targetId === "kenia") return buildKeniaImportTarget(admin);
  if (targetId === "imobee") return buildImobeeImportTarget(admin);
  throw new Error(`Destino de importação desconhecido: ${targetId}. Use imobee ou kenia.`);
}

/** Nome do status customizado no Deskimob por situação Imoview. */
export const SITUACAO_STATUS_NOME: Record<ImoviewSituacao, string> = {
  "Vago/Disponível": "Disponível",
  Desativado: "Desativado",
  "Em moderação": "Em cadastro",
  Vendido: "Vendido",
  "Em reforma": "Desativado temporariamente",
  Alugado: "Locado",
};

export const SITUACAO_STATUS_SLUG: Record<
  ImoviewSituacao,
  { status: StatusImovelSlug; statusAprovacao: "em_cadastro" | "aprovado" }
> = {
  "Vago/Disponível": { status: "disponivel", statusAprovacao: "aprovado" },
  Desativado: { status: "desativado", statusAprovacao: "aprovado" },
  "Em moderação": { status: "em_cadastro", statusAprovacao: "em_cadastro" },
  Vendido: { status: "vendido", statusAprovacao: "aprovado" },
  "Em reforma": { status: "desativado_temporariamente", statusAprovacao: "aprovado" },
  Alugado: { status: "locado", statusAprovacao: "aprovado" },
};

export type StatusImovelLookup = Map<string, string>;

export async function loadStatusImovelLookup(
  admin: SupabaseClient,
  corretorId: string,
): Promise<StatusImovelLookup> {
  const { data, error } = await admin
    .from("status_imovel")
    .select("id, nome")
    .eq("corretor_id", corretorId);

  if (error) throw new Error(`status_imovel: ${error.message}`);

  const lookup: StatusImovelLookup = new Map();
  for (const row of data ?? []) {
    lookup.set(String(row.nome).trim().toLowerCase(), row.id);
  }
  return lookup;
}

export function resolveStatusFromSituacao(
  situacaoRaw: string,
  lookup: StatusImovelLookup,
): {
  status: StatusImovelSlug;
  statusImovelId: string;
  statusAprovacao: "em_cadastro" | "aprovado";
  warning?: string;
} {
  const situacao = situacaoRaw.trim() as ImoviewSituacao;
  const slugConfig = SITUACAO_STATUS_SLUG[situacao] ?? SITUACAO_STATUS_SLUG.Desativado;
  const preferredNome = SITUACAO_STATUS_NOME[situacao] ?? SITUACAO_STATUS_NOME.Desativado;

  let statusImovelId = lookup.get(preferredNome.toLowerCase()) ?? null;

  if (!statusImovelId && situacao === "Em reforma") {
    statusImovelId = lookup.get("desativado") ?? null;
  }

  if (!statusImovelId) {
    statusImovelId = lookup.get("disponível") ?? lookup.get("disponivel") ?? null;
  }

  if (!statusImovelId) {
    throw new Error(
      `status_imovel "${preferredNome}" não encontrado para situação "${situacaoRaw}".`,
    );
  }

  const warning =
    situacao === "Em reforma" && !lookup.has("desativado temporariamente")
      ? `Situação Em reforma — status custom "Desativado temporariamente" ausente; usando fallback.`
      : !SITUACAO_STATUS_SLUG[situacao as ImoviewSituacao]
        ? `Situação desconhecida "${situacaoRaw}" — usando Desativado.`
        : undefined;

  return {
    status: slugConfig.status,
    statusImovelId,
    statusAprovacao: slugConfig.statusAprovacao,
    warning,
  };
}

/** Contexto mínimo para scripts de diagnóstico (não grava no banco). */
export function createDiagnosticMapContext(): {
  captadorPerfilId: string;
  statusImovelLookup: StatusImovelLookup;
} {
  const statusImovelLookup: StatusImovelLookup = new Map(
    Object.values(SITUACAO_STATUS_NOME).map((nome) => [nome.toLowerCase(), "00000000-0000-4000-a000-000000000001"]),
  );
  statusImovelLookup.set("desativado temporariamente", "00000000-0000-4000-a000-000000000002");

  return {
    captadorPerfilId: "00000000-0000-4000-a000-000000000000",
    statusImovelLookup,
  };
}
