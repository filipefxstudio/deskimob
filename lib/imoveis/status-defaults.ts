import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { StatusImovel } from "@/types";

export type DefaultStatusImovelRow = {
  nome: string;
  cor: string;
  padrao: boolean;
  ativo: boolean;
  ordem: number;
};

/** Status padrão por corretor — alinhado às migrations de seed/backfill. */
export const DEFAULT_STATUS_IMOVEL: DefaultStatusImovelRow[] = [
  { nome: "Em cadastro", cor: "#94A3B8", padrao: false, ativo: true, ordem: -2 },
  { nome: "Aguardando aprovação", cor: "#F59E0B", padrao: false, ativo: true, ordem: -1 },
  { nome: "Disponível", cor: "#2DC653", padrao: true, ativo: true, ordem: 1 },
  { nome: "Reservado", cor: "#F18F01", padrao: true, ativo: true, ordem: 2 },
  { nome: "Vendido", cor: "#1E3A5F", padrao: true, ativo: true, ordem: 3 },
  { nome: "Locado", cor: "#7C3AED", padrao: true, ativo: true, ordem: 4 },
  { nome: "Desativado", cor: "#6B7280", padrao: false, ativo: true, ordem: 99 },
];

export type StatusImovelResolveFailureReason =
  | "fetch_error"
  | "not_found"
  | "service_role_missing"
  | "seed_failed";

export type StatusImovelResolveResult =
  | { ok: true; status: StatusImovel }
  | {
      ok: false;
      reason: StatusImovelResolveFailureReason;
      message: string;
      details?: string;
    };

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

function isServiceRoleConfigError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("supabase_service_role_key") ||
    normalized.includes("supabase admin client requires") ||
    normalized.includes("cliente administrativo")
  );
}

/** Busca um status por nome; usa limit(1) para tolerar duplicatas legadas no banco. */
export async function fetchStatusImovelByNome(
  supabase: SupabaseClient,
  corretorId: string,
  nome: string,
): Promise<{ status: StatusImovel | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("status_imovel")
    .select("*")
    .eq("corretor_id", corretorId)
    .eq("nome", nome)
    .order("criado_em", { ascending: true })
    .limit(1);

  if (error) {
    return { status: null, error };
  }

  return { status: (data?.[0] as StatusImovel | undefined) ?? null, error: null };
}

export function formatStatusImovelResolveError(
  nome: string,
  result: Extract<StatusImovelResolveResult, { ok: false }>,
): string {
  const devSuffix =
    process.env.NODE_ENV === "development" && result.details
      ? ` (${result.details})`
      : "";

  switch (result.reason) {
    case "service_role_missing":
      return `Configuração incompleta: defina SUPABASE_SERVICE_ROLE_KEY no servidor.${devSuffix}`;
    case "fetch_error":
      return `Não foi possível carregar o status "${nome}". Verifique permissões ou recarregue a página.${devSuffix}`;
    case "seed_failed":
      return `Não foi possível preparar o status "${nome}". Tente novamente ou entre em contato com o suporte.${devSuffix}`;
    case "not_found":
    default:
      return `Status "${nome}" não configurado. Recarregue a página ou entre em contato com o suporte.${devSuffix}`;
  }
}

async function insertDefaultStatusInline(
  admin: SupabaseClient,
  corretorId: string,
  nome: string,
): Promise<StatusImovel | null> {
  const defaultRow = DEFAULT_STATUS_IMOVEL.find((status) => status.nome === nome);

  if (!defaultRow) {
    return null;
  }

  const { data: inserted, error: insertError } = await admin
    .from("status_imovel")
    .insert({
      corretor_id: corretorId,
      ...defaultRow,
    })
    .select("*")
    .limit(1);

  if (!insertError && inserted?.[0]) {
    return inserted[0] as StatusImovel;
  }

  if (insertError && isUniqueViolation(insertError)) {
    const { status } = await fetchStatusImovelByNome(admin, corretorId, nome);
    return status;
  }

  if (insertError) {
    console.error("[insertDefaultStatusInline] failed", { nome, insertError });
  }

  return null;
}

export async function resolveStatusImovelByNome(
  corretorId: string,
  nome: string,
  userClient: SupabaseClient,
): Promise<StatusImovelResolveResult> {
  let { status, error } = await fetchStatusImovelByNome(userClient, corretorId, nome);

  if (status) {
    return { ok: true, status };
  }

  if (error) {
    console.error("[resolveStatusImovelByNome] user fetch failed", { nome, error });
  }

  try {
    await ensureStatusImovelDefaults(corretorId);
  } catch (ensureError) {
    const message =
      ensureError instanceof Error ? ensureError.message : "Falha ao preparar status padrão.";

    return {
      ok: false,
      reason: isServiceRoleConfigError(message) ? "service_role_missing" : "seed_failed",
      message,
      details: message,
    };
  }

  ({ status, error } = await fetchStatusImovelByNome(userClient, corretorId, nome));

  if (status) {
    return { ok: true, status };
  }

  if (error) {
    console.warn("[resolveStatusImovelByNome] user fetch failed after seed, trying admin", {
      nome,
      error,
    });
  }

  let admin: SupabaseClient;

  try {
    admin = createServiceRoleClient();
  } catch (adminError) {
    const message =
      adminError instanceof Error
        ? adminError.message
        : "Falha ao inicializar cliente administrativo.";

    return {
      ok: false,
      reason: "service_role_missing",
      message,
      details: message,
    };
  }

  ({ status, error } = await fetchStatusImovelByNome(admin, corretorId, nome));

  if (status) {
    return { ok: true, status };
  }

  if (error) {
    return {
      ok: false,
      reason: "fetch_error",
      message: error.message,
      details: `${error.code ?? "unknown"}: ${error.message}`,
    };
  }

  const inlineStatus = await insertDefaultStatusInline(admin, corretorId, nome);

  if (inlineStatus) {
    return { ok: true, status: inlineStatus };
  }

  return {
    ok: false,
    reason: "not_found",
    message: `Status "${nome}" não encontrado após seed.`,
    details: "Verifique a tabela status_imovel no Supabase.",
  };
}

export async function seedStatusImovelForCorretor(
  supabase: SupabaseClient,
  corretorId: string,
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from("status_imovel")
    .select("nome")
    .eq("corretor_id", corretorId);

  if (fetchError) {
    console.error("[seedStatusImovelForCorretor] fetch failed", fetchError);
    throw new Error("Não foi possível verificar os status de imóvel.");
  }

  const existingNames = new Set((existing ?? []).map((row) => row.nome));
  const rows = DEFAULT_STATUS_IMOVEL.filter((status) => !existingNames.has(status.nome)).map(
    (status) => ({
      corretor_id: corretorId,
      ...status,
    }),
  );

  if (rows.length === 0) {
    return;
  }

  const { error: upsertError } = await supabase.from("status_imovel").upsert(rows, {
    onConflict: "corretor_id,nome",
    ignoreDuplicates: true,
  });

  if (!upsertError) {
    return;
  }

  if (!isUniqueViolation(upsertError)) {
    console.warn("[seedStatusImovelForCorretor] upsert failed, falling back to row inserts", upsertError);
  }

  for (const row of rows) {
    const { error: insertError } = await supabase.from("status_imovel").insert(row);

    if (!insertError || isUniqueViolation(insertError)) {
      continue;
    }

    console.error("[seedStatusImovelForCorretor] insert failed", insertError);
    throw new Error("Não foi possível criar os status padrão de imóvel.");
  }
}

export async function verifyDefaultStatusImovelSeeded(
  supabase: SupabaseClient,
  corretorId: string,
): Promise<void> {
  for (const required of ["Em cadastro", "Disponível"] as const) {
    const { status, error } = await fetchStatusImovelByNome(supabase, corretorId, required);

    if (error) {
      throw new Error(`Falha ao verificar status "${required}": ${error.message}`);
    }

    if (!status) {
      throw new Error(`Status "${required}" não foi criado durante o cadastro.`);
    }
  }
}

/** Garante status padrão via service role (ignora RLS). */
export async function ensureStatusImovelDefaults(corretorId: string): Promise<void> {
  let admin: SupabaseClient;

  try {
    admin = createServiceRoleClient();
  } catch (error) {
    console.error("[ensureStatusImovelDefaults] admin client failed", error);
    throw new Error(
      "Configuração do servidor inválida. Não foi possível preparar os status de imóvel.",
    );
  }

  await seedStatusImovelForCorretor(admin, corretorId);
}
