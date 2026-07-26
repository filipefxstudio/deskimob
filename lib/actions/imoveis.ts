"use server";

import { revalidatePath } from "next/cache";

import {
  IMOVEL_LIMITS,
  STATUS_IMOVEL_SISTEMA,
  STATUS_NOME_TO_SLUG,
  STORAGE_BUCKET_MARCA_DAGUA,
} from "@/lib/constants/imoveis";
import {
  clampImovelListLimit,
  clampListOffset,
  type ListQueryOptions,
} from "@/lib/constants/listings";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";
import { getImovelFotoDashboardUrl } from "@/lib/imoveis/foto-url";
import { removeImovelFotosFromStorage, uploadFotoImovel } from "@/lib/imoveis/foto-cloudinary";
import { createClienteFromImovel } from "@/lib/actions/clientes";
import { getMarcaDaguaConfigByCorretorId } from "@/lib/actions/configuracoes";
import { buildComplementoString, getCaptadorPrincipalId, imovelToFormValues } from "@/lib/imoveis/form";
import {
  ensureStatusImovelDefaults,
  formatStatusImovelResolveError,
  resolveStatusImovelByNome,
} from "@/lib/imoveis/status-defaults";
import { mensagemImovelDuplicado } from "@/lib/pessoas/messages";
import { registrarAuditoriaImovel } from "@/lib/imoveis/auditoria";
import { applyWatermark } from "@/lib/imoveis/watermark";
import { compressImageBufferForStorage } from "@/lib/imoveis/foto-compress.server";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import { buildUserFacingError } from "@/lib/auth/errors";
import { logSupabaseError } from "@/lib/negocios/row";
import {
  extractMissingColumn,
  isSchemaMismatchError,
  logPostgrestError,
} from "@/lib/supabase/postgrest-error";
import { generateImovelSlug } from "@/lib/utils";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  imovelCadastroSchema,
  validateImovelParaAprovacao,
  type ImovelFormValues,
} from "@/lib/validations/imovel";
import type { Imovel, PlanoAssinatura, StatusImovel, StatusImovelSlug } from "@/types";

export type ImovelActionResult = {
  success?: boolean;
  error?: string;
  imovelId?: string;
};

export type FotoUploadInput = {
  file: File;
  legenda?: string;
  ordem: number;
};

export type FotoMetadataInput = {
  existingId?: string;
  legenda?: string;
  ordem: number;
};

type FotoUploadMetadata = {
  tempId: string;
  legenda?: string;
  ordem: number;
};

async function getPlanoAtivo(corretorId: string): Promise<PlanoAssinatura> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assinaturas")
    .select("plano, status")
    .eq("corretor_id", corretorId);

  if (!error) {
    const ativa = (data ?? []).find((item) => item.status === "ativo");
    return (ativa?.plano as PlanoAssinatura | undefined) ?? "basico";
  }

  logPostgrestError("getPlanoAtivo", error);

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackData, error: fallbackError } = await admin
      .from("assinaturas")
      .select("plano, status")
      .eq("corretor_id", corretorId);

    if (fallbackError) {
      logPostgrestError("getPlanoAtivo:fallback", fallbackError);
      return "basico";
    }

    console.warn("[getPlanoAtivo] used service role fallback", { corretorId });
    const ativa = (fallbackData ?? []).find((item) => item.status === "ativo");
    return (ativa?.plano as PlanoAssinatura | undefined) ?? "basico";
  } catch (fallbackError) {
    console.error("[getPlanoAtivo] service role fallback unavailable", fallbackError);
    return "basico";
  }
}

async function countImoveis(corretorId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", corretorId);

  if (!error) {
    return count ?? 0;
  }

  logPostgrestError("countImoveis", error);

  try {
    const admin = createServiceRoleClient();
    const { count: fallbackCount, error: fallbackError } = await admin
      .from("imoveis")
      .select("id", { count: "exact", head: true })
      .eq("corretor_id", corretorId);

    if (fallbackError) {
      logPostgrestError("countImoveis:fallback", fallbackError);
      throw new Error("Não foi possível verificar a quantidade de imóveis.");
    }

    console.warn("[countImoveis] used service role fallback", { corretorId });
    return fallbackCount ?? 0;
  } catch (fallbackError) {
    console.error("[countImoveis] service role fallback unavailable", fallbackError);
    throw fallbackError instanceof Error
      ? fallbackError
      : new Error("Não foi possível verificar a quantidade de imóveis.");
  }
}

async function ensureUniqueImovelSlug(
  corretorId: string,
  baseSlug: string,
): Promise<string> {
  let supabase: ImovelDbClient;

  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    console.error("[ensureUniqueImovelSlug] service role unavailable", error);
    supabase = await createClient();
  }

  const normalizedBase = baseSlug || "imovel";
  let slug = normalizedBase;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("imoveis")
      .select("id")
      .eq("corretor_id", corretorId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) {
      return slug;
    }

    slug = `${normalizedBase}-${counter}`;
    counter += 1;
  }
}

function sanitizeCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

function normalizeImovelFotoRows<T extends { url: string }>(
  fotos: T[] | null | undefined,
): T[] {
  return (fotos ?? []).map((foto) => ({
    ...foto,
    url: getImovelFotoDashboardUrl(foto.url),
  }));
}

function normalizeImovelRow<T extends { fotos?: { url: string }[] | null }>(
  row: T | null,
): T | null {
  if (!row) {
    return null;
  }

  if (!row.fotos?.length) {
    return row;
  }

  return {
    ...row,
    fotos: normalizeImovelFotoRows(row.fotos),
  };
}

const IMOVEL_LIST_FOTOS = "fotos:imovel_fotos(id, url, ordem)";
const IMOVEL_LIST_STATUS = "status_imovel:status_imovel(*)";
const IMOVEL_LIST_CAPTADOR = "captador:perfis!captador_id(id, nome)";

const IMOVEL_LIST_SELECT_TIERS = [
  `*, ${IMOVEL_LIST_FOTOS}, ${IMOVEL_LIST_STATUS}, ${IMOVEL_LIST_CAPTADOR}`,
  `*, ${IMOVEL_LIST_FOTOS}, ${IMOVEL_LIST_STATUS}`,
  `*, ${IMOVEL_LIST_FOTOS}`,
  "*",
] as const;

/** Known imoveis columns for SELECT fallback when optional columns are absent in DB. */
const IMOVEL_DB_COLUMNS = [
  "id",
  "corretor_id",
  "codigo",
  "codigo_personalizado",
  "titulo",
  "slug",
  "tipo",
  "finalidade",
  "destinacao",
  "status",
  "status_imovel_id",
  "status_aprovacao",
  "captador_id",
  "comissao_percent",
  "exibir_endereco_site",
  "exibir_endereco_portais",
  "motivo_desativacao",
  "cadastrado_por_perfil_id",
  "data_ativacao",
  "data_desativacao",
  "data_ultima_atualizacao",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "complemento_valor",
  "complemento_tipo",
  "complemento_numero",
  "complemento_torre",
  "condominio_nome",
  "bairro",
  "cidade",
  "estado",
  "latitude",
  "longitude",
  "portal_endereco_diferente",
  "portal_logradouro",
  "portal_numero",
  "portal_bairro",
  "portal_cep",
  "portal_cidade",
  "portal_estado",
  "local_chaves",
  "chaves_codigo",
  "chaves_descricao",
  "exclusividade",
  "imovel_ocupado",
  "contrato_aluguel_ativo",
  "aceita_financiamento",
  "aceita_permuta",
  "imovel_na_planta",
  "area_util",
  "area_total",
  "ano_construcao",
  "quartos",
  "suites",
  "salas",
  "banheiros",
  "elevadores",
  "vagas",
  "vagas_tipo",
  "vagas_cobertura",
  "valor_venda",
  "valor_locacao",
  "valor_condominio",
  "valor_iptu",
  "descricao",
  "diferenciais",
  "video_url",
  "publicado_site",
  "destaque_site",
  "publicado_portais",
  "cliente_id",
  "visualizacoes",
  "criado_em",
  "atualizado_em",
] as const;

function imovelListSelectForTier(
  tier: number,
  excludedOptional: readonly string[],
): string {
  const select = IMOVEL_LIST_SELECT_TIERS[tier];

  if (excludedOptional.length === 0) {
    return select;
  }

  const explicit = IMOVEL_DB_COLUMNS.filter(
    (column) => !excludedOptional.includes(column),
  ).join(", ");

  return select.replace(/^\*, /, `${explicit}, `);
}

const IMOVEL_SELECT =
  "*, fotos:imovel_fotos(*), status_imovel:status_imovel(*), cliente:clientes(*), captador:perfis!captador_id(*), captadores:imovel_captadores(*, perfil:perfis(*)), proprietarios:imovel_proprietarios(*, cliente:clientes(*)), cadastrado_por:perfis!cadastrado_por_perfil_id(*)";

const IMOVEL_DETAIL_SELECT_TIERS = [
  IMOVEL_SELECT,
  `*, ${IMOVEL_LIST_FOTOS}, ${IMOVEL_LIST_STATUS}, ${IMOVEL_LIST_CAPTADOR}`,
  `*, ${IMOVEL_LIST_FOTOS}, ${IMOVEL_LIST_STATUS}`,
  `*, ${IMOVEL_LIST_FOTOS}`,
  "*",
] as const;

async function getStatusById(
  corretorId: string,
  statusId: string,
): Promise<StatusImovel | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("status_imovel")
    .select("*")
    .eq("id", statusId)
    .eq("corretor_id", corretorId)
    .limit(1);

  if (error) {
    console.error("[getStatusById] fetch failed", { statusId, error });
    return null;
  }

  return (data?.[0] as StatusImovel | undefined) ?? null;
}

async function getStatusByNome(
  corretorId: string,
  nome: string,
): Promise<StatusImovel | null> {
  const supabase = await createClient();
  const result = await resolveStatusImovelByNome(corretorId, nome, supabase);

  if (result.ok) {
    return result.status;
  }

  console.error("[getStatusByNome] resolve failed", {
    nome,
    reason: result.reason,
    details: result.details,
  });

  return null;
}

function slugFromStatusRecord(status: StatusImovel | null): StatusImovelSlug {
  if (!status) {
    return "disponivel";
  }

  return STATUS_NOME_TO_SLUG[status.nome] ?? "disponivel";
}

async function resolveStatusSlug(
  corretorId: string,
  statusImovelId: string,
): Promise<StatusImovelSlug> {
  const status = await getStatusById(corretorId, statusImovelId);
  return slugFromStatusRecord(status);
}

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function processImageBuffer(
  corretorId: string,
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  let processed = await compressImageBufferForStorage(buffer);

  if ("error" in processed) {
    return processed;
  }

  const config = await getMarcaDaguaConfigByCorretorId(corretorId);

  if (config?.logo_url) {
    const logoBuffer = await fetchLogoBuffer(config.logo_url);

    if (logoBuffer) {
      try {
        const watermarked = await applyWatermark(processed.buffer, config, logoBuffer);
        const recompressed = await compressImageBufferForStorage(watermarked);

        if ("error" in recompressed) {
          return recompressed;
        }

        processed = recompressed;
      } catch (error) {
        console.error("[processImageBuffer] watermark failed", error);
      }
    }
  }

  return processed;
}

async function fetchStatusImovelRows(
  client: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
): Promise<StatusImovel[]> {
  const { data, error } = await client
    .from("status_imovel")
    .select("*")
    .eq("corretor_id", corretorId)
    .eq("ativo", true)
    .order("ordem");

  if (error) {
    console.error("[fetchStatusImovelRows] failed", error);
    return [];
  }

  return (data ?? []) as StatusImovel[];
}

export async function getStatusImovelList(corretorId?: string): Promise<StatusImovel[]> {
  const corretor = corretorId
    ? { id: corretorId }
    : await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const supabase = await createClient();

  try {
    await ensureStatusImovelDefaults(corretor.id);
  } catch (error) {
    console.error("[getStatusImovelList] ensure defaults failed", error);
  }

  const rows = await fetchStatusImovelRows(supabase, corretor.id);

  if (rows.length > 0) {
    return rows;
  }

  try {
    const admin = createServiceRoleClient();
    const fallbackRows = await fetchStatusImovelRows(admin, corretor.id);

    if (fallbackRows.length > 0) {
      console.warn("[getStatusImovelList] authenticated query returned empty; used service role fallback", {
        corretorId: corretor.id,
      });
    }

    return fallbackRows;
  } catch (error) {
    console.error("[getStatusImovelList] service role fallback unavailable", error);
    return rows;
  }
}

export async function updateImovelStatus(
  id: string,
  statusImovelId: string,
  motivo?: string,
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  if (!motivo?.trim()) {
    return { error: "Informe o motivo da alteração de status." };
  }

  const owns = await ensureImovelOwnership(id, corretor.id);

  if (!owns) {
    return { error: "Imóvel não encontrado." };
  }

  const status = await getStatusById(corretor.id, statusImovelId);

  if (!status) {
    return { error: "Status não encontrado." };
  }

  if ((STATUS_IMOVEL_SISTEMA as readonly string[]).includes(status.nome)) {
    return { error: "Este status só pode ser alterado automaticamente pelo sistema." };
  }

  const { data: imovelAtual } = await (await createClient())
    .from("imoveis")
    .select("status_imovel_id, status_imovel:status_imovel(nome)")
    .eq("id", id)
    .maybeSingle();

  const slug = slugFromStatusRecord(status);
  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {
    status_imovel_id: statusImovelId,
    status: slug,
  };

  if (slug === "vendido" || slug === "locado" || slug === "desativado") {
    updatePayload.data_desativacao = new Date().toISOString();
  }

  const { error } = await supabase
    .from("imoveis")
    .update(updatePayload)
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[updateImovelStatus] failed", error);
    return { error: "Não foi possível alterar o status." };
  }

  const statusAnterior = (
    imovelAtual?.status_imovel as { nome?: string } | { nome?: string }[] | null
  );
  const nomeAnterior = Array.isArray(statusAnterior)
    ? statusAnterior[0]?.nome
    : statusAnterior?.nome;

  await registrarAuditoriaImovel(id, "status_alterado", {
    motivo: motivo.trim(),
    detalhes: {
      status_anterior: nomeAnterior ?? null,
      status_novo: status.nome,
    },
  });

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${id}`);

  return { success: true, imovelId: id };
}

export async function desativarImovel(
  id: string,
  motivo: string,
  infoAdicional?: string,
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  if (!motivo.trim()) {
    return { error: "Selecione o motivo da desativação." };
  }

  if (motivo === "Outro" && !infoAdicional?.trim()) {
    return { error: "Informe os detalhes da desativação." };
  }

  const owns = await ensureImovelOwnership(id, corretor.id);
  if (!owns) {
    return { error: "Imóvel não encontrado." };
  }

  const supabase = await createClient();
  const { data: statusDesativado } = await supabase
    .from("status_imovel")
    .select("id")
    .eq("corretor_id", corretor.id)
    .eq("nome", "Desativado")
    .maybeSingle();

  if (!statusDesativado) {
    return { error: "Status Desativado não configurado." };
  }

  const motivoCompleto =
    motivo === "Outro" && infoAdicional?.trim()
      ? `${motivo}: ${infoAdicional.trim()}`
      : motivo.trim();

  const { error } = await supabase
    .from("imoveis")
    .update({
      status_imovel_id: statusDesativado.id,
      status: "desativado",
      motivo_desativacao: motivoCompleto,
      data_desativacao: new Date().toISOString(),
      publicado_site: false,
      destaque_site: false,
      publicado_portais: false,
    })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[desativarImovel] failed", error);
    return { error: "Não foi possível desativar o imóvel." };
  }

  await registrarAuditoriaImovel(id, "imovel_desativado", {
    motivo: motivoCompleto,
  });

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${id}`);

  return { success: true, imovelId: id };
}

/** @deprecated Use updateImovelStatus com motivo */
export async function alterarStatusImovel(
  id: string,
  statusImovelId: string,
  motivo: string,
): Promise<ImovelActionResult> {
  return updateImovelStatus(id, statusImovelId, motivo);
}

export async function enviarImovelParaAprovacao(
  id: string,
  options?: {
    formValues?: ImovelFormValues;
    fotosCount?: number;
  },
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const scopedClient = await createImovelScopedClient(corretor.id, id);
  if (!scopedClient) {
    return { error: "Imóvel não encontrado." };
  }

  const { data: imovelRow, error: fetchError } = await scopedClient
    .from("imoveis")
    .select("status_aprovacao, status")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !imovelRow) {
    if (fetchError) {
      logPostgrestError("enviarImovelParaAprovacao:fetch", fetchError);
    }
    return { error: "Imóvel não encontrado." };
  }

  const emCadastro =
    imovelRow.status_aprovacao === "em_cadastro" ||
    (!imovelRow.status_aprovacao &&
      (imovelRow.status === "em_cadastro" || !imovelRow.status));

  if (!emCadastro) {
    return { error: "Este imóvel não está em cadastro." };
  }

  let validation;
  if (options?.formValues) {
    validation = validateImovelParaAprovacao(options.formValues, {
      fotosCount: options.fotosCount ?? 0,
    });
  } else {
    const imovelCompleto = await getImovelById(id);
    if (!imovelCompleto) {
      return { error: "Imóvel não encontrado." };
    }

    validation = validateImovelParaAprovacao(imovelToFormValues(imovelCompleto), {
      fotosCount: imovelCompleto.fotos?.length ?? 0,
    });
  }

  if (!validation.success) {
    return { error: validation.message };
  }

  const statusResult = await resolveStatusImovelByNome(
    corretor.id,
    "Aguardando aprovação",
    scopedClient,
  );

  const updatePayload: Record<string, unknown> = {
    status_aprovacao: "aguardando_aprovacao",
  };

  if (statusResult.ok) {
    updatePayload.status_imovel_id = statusResult.status.id;
    updatePayload.status = "aguardando_aprovacao";
  } else {
    console.error("[enviarImovelParaAprovacao] status resolve failed", statusResult);
  }

  const { error: updateError } = await persistImovelRowUpdate(
    scopedClient,
    id,
    corretor.id,
    updatePayload,
  );

  if (updateError) {
    return { error: mapImovelPersistError(updateError, "update") };
  }

  const { data: updated, error: verifyError } = await scopedClient
    .from("imoveis")
    .select("status_aprovacao")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (verifyError || updated?.status_aprovacao !== "aguardando_aprovacao") {
    if (verifyError) {
      logPostgrestError("enviarImovelParaAprovacao:verify", verifyError);
    }
    return { error: "Não foi possível enviar para aprovação. Tente novamente." };
  }

  await registrarAuditoriaImovel(id, "enviado_aprovacao");

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${id}`);
  revalidatePath("/dashboard");

  return { success: true, imovelId: id };
}

export async function aprovarImovel(id: string, motivo?: string): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const perfil = await getPerfilForUser(corretor.id);

  if (!perfil || (perfil.papel !== "gerente" && perfil.papel !== "admin")) {
    return { error: "Sem permissão para aprovar imóveis." };
  }

  const scopedClient = await createImovelScopedClient(corretor.id, id);
  if (!scopedClient) {
    return { error: "Imóvel não encontrado." };
  }

  const { data: imovel, error: fetchError } = await scopedClient
    .from("imoveis")
    .select("status_aprovacao")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !imovel) {
    if (fetchError) {
      logPostgrestError("aprovarImovel:fetch", fetchError);
    }
    return { error: "Imóvel não encontrado." };
  }

  if (imovel.status_aprovacao !== "aguardando_aprovacao") {
    return { error: "Este imóvel não está aguardando aprovação." };
  }

  const statusResult = await resolveStatusImovelByNome(
    corretor.id,
    "Disponível",
    scopedClient,
  );

  const updatePayload: Record<string, unknown> = {
    status_aprovacao: "aprovado",
  };

  if (statusResult.ok) {
    updatePayload.status_imovel_id = statusResult.status.id;
    updatePayload.status = "disponivel";
  }

  const { error } = await persistImovelRowUpdate(
    scopedClient,
    id,
    corretor.id,
    updatePayload,
  );

  if (error) {
    return { error: mapImovelPersistError(error, "update") };
  }

  await registrarAuditoriaImovel(id, "imovel_aprovado", {
    motivo: motivo?.trim() || null,
  });

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${id}`);
  revalidatePath("/dashboard");

  return { success: true, imovelId: id };
}

export async function reprovarImovel(id: string, motivo?: string): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const perfil = await getPerfilForUser(corretor.id);

  if (!perfil || (perfil.papel !== "gerente" && perfil.papel !== "admin")) {
    return { error: "Sem permissão para reprovar imóveis." };
  }

  const scopedClient = await createImovelScopedClient(corretor.id, id);
  if (!scopedClient) {
    return { error: "Imóvel não encontrado." };
  }

  const { data: imovel, error: fetchError } = await scopedClient
    .from("imoveis")
    .select("status_aprovacao")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !imovel) {
    if (fetchError) {
      logPostgrestError("reprovarImovel:fetch", fetchError);
    }
    return { error: "Imóvel não encontrado." };
  }

  if (imovel.status_aprovacao !== "aguardando_aprovacao") {
    return { error: "Este imóvel não está aguardando aprovação." };
  }

  const statusResult = await resolveStatusImovelByNome(
    corretor.id,
    "Em cadastro",
    scopedClient,
  );

  const updatePayload: Record<string, unknown> = {
    status_aprovacao: "em_cadastro",
  };

  if (statusResult.ok) {
    updatePayload.status_imovel_id = statusResult.status.id;
    updatePayload.status = "em_cadastro";
  }

  const { error } = await persistImovelRowUpdate(
    scopedClient,
    id,
    corretor.id,
    updatePayload,
  );

  if (error) {
    return { error: mapImovelPersistError(error, "update") };
  }

  await registrarAuditoriaImovel(id, "imovel_reprovado", {
    motivo: motivo?.trim() || null,
  });

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${id}`);
  revalidatePath("/dashboard");

  return { success: true, imovelId: id };
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

export async function validarAtualizacao(id: string): Promise<ImovelActionResult & { data?: string }> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const owns = await ensureImovelOwnership(id, corretor.id);

  if (!owns) {
    return { error: "Imóvel não encontrado." };
  }

  const now = new Date().toISOString();
  const supabase = await createClient();

  const { error } = await supabase
    .from("imoveis")
    .update({ data_ultima_atualizacao: now })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[validarAtualizacao] failed", error);
    return { error: "Não foi possível registrar a atualização." };
  }

  await registrarAuditoriaImovel(id, "atualizacao_validada");

  revalidatePath(`/dashboard/imoveis/${id}`);

  return { success: true, imovelId: id, data: now };
}

async function ensureImovelOwnership(imovelId: string, corretorId: string) {
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

async function fetchImovelByIdRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  id: string,
): Promise<Imovel | null> {
  const excludedOptional = new Set<string>();

  for (let tier = 0; tier < IMOVEL_DETAIL_SELECT_TIERS.length; tier += 1) {
    let select = IMOVEL_DETAIL_SELECT_TIERS[tier];

    if (excludedOptional.size > 0) {
      const explicit = IMOVEL_DB_COLUMNS.filter(
        (column) => !excludedOptional.has(column),
      ).join(", ");
      select = select.replace(/^\*, /, `${explicit}, `) as (typeof IMOVEL_DETAIL_SELECT_TIERS)[number];
    }

    const { data, error } = await supabase
      .from("imoveis")
      .select(select as "*")
      .eq("id", id)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (!error && data) {
      return normalizeImovelRow(data as Imovel);
    }

    if (!error) {
      break;
    }

    const missingColumn = extractMissingColumn(error);
    if (
      missingColumn &&
      (OPTIONAL_IMOVEL_DB_COLUMNS as readonly string[]).includes(missingColumn) &&
      !excludedOptional.has(missingColumn)
    ) {
      excludedOptional.add(missingColumn);
      logPostgrestError(`fetchImovelByIdRow:retry_without_${missingColumn}`, error);
      tier -= 1;
      continue;
    }

    const hasFallback = tier < IMOVEL_DETAIL_SELECT_TIERS.length - 1;
    if (hasFallback && error && isSchemaMismatchError(error)) {
      logPostgrestError(`fetchImovelByIdRow.tier${tier}`, error);
      continue;
    }

    if (error) {
      logPostgrestError("fetchImovelByIdRow", error);
    }

    break;
  }

  return null;
}

type ImovelDbClient = Awaited<ReturnType<typeof createClient>>;

/** Cliente de escrita após validar sessão/corretor (contorna RLS no cadastro). */
function createImovelWriteClient(): ImovelDbClient {
  try {
    return createServiceRoleClient();
  } catch (error) {
    console.error("[createImovelWriteClient] service role unavailable", error);
    throw new Error("Não foi possível salvar o imóvel. Verifique a configuração do servidor.");
  }
}

/** Cliente de dados do imóvel após validar tenant (contorna RLS para membros da equipe). */
async function createImovelScopedClient(
  corretorId: string,
  imovelId: string,
): Promise<ImovelDbClient | null> {
  const owns = await ensureImovelOwnership(imovelId, corretorId);

  if (!owns) {
    return null;
  }

  try {
    return createServiceRoleClient();
  } catch (error) {
    console.error("[createImovelScopedClient] service role unavailable", error);
    return createClient();
  }
}

async function ensureUniqueImovelSlugForUpdate(
  corretorId: string,
  baseSlug: string,
  currentImovelId: string,
  supabase: ImovelDbClient,
): Promise<string> {
  const normalizedBase = baseSlug || "imovel";
  let slug = normalizedBase;
  let counter = 1;

  while (true) {
    const { data } = await supabase
      .from("imoveis")
      .select("id")
      .eq("corretor_id", corretorId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data || data.id === currentImovelId) {
      return slug;
    }

    slug = `${normalizedBase}-${counter}`;
    counter += 1;
  }
}

async function generateNextCodigo(corretorId: string): Promise<string> {
  let admin;

  try {
    admin = createServiceRoleClient();
  } catch (error) {
    console.error("[generateNextCodigo] service role unavailable", error);
    throw new Error("Não foi possível gerar o código do imóvel.");
  }

  const { data, error } = await admin
    .from("imoveis")
    .select("codigo")
    .eq("corretor_id", corretorId)
    .not("codigo", "is", null);

  if (error) {
    console.error("[generateNextCodigo] failed", error);
    throw new Error("Não foi possível gerar o código do imóvel.");
  }

  let max = 0;
  for (const row of data ?? []) {
    const num = parseInt(row.codigo ?? "", 10);
    if (!Number.isNaN(num) && num > max) {
      max = num;
    }
  }

  return String(max + 1).padStart(4, "0");
}

function isImovelCodigoConflict(error: PostgrestError): boolean {
  if (error.code !== "23505") {
    return false;
  }

  const details = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return details.includes("codigo") || details.includes("imoveis_corretor_codigo");
}

export async function getProximoCodigoPreview(): Promise<string | null> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  try {
    return await generateNextCodigo(corretor.id);
  } catch {
    return null;
  }
}

function numericForDb(value: number | null | undefined): number | null {
  return value ?? null;
}

/** Columns added in recent migrations — omitted on retry when the DB schema is behind. */
const OPTIONAL_IMOVEL_DB_COLUMNS = ["destaque_site"] as const;

function mapImovelPersistError(
  error: PostgrestError,
  action: "insert" | "update",
): string {
  const baseMessage =
    action === "update"
      ? "Não foi possível atualizar o imóvel."
      : "Não foi possível cadastrar o imóvel. Tente novamente.";

  if (isSchemaMismatchError(error)) {
    return buildUserFacingError(
      "Banco de dados desatualizado. Aplique as migrations pendentes no Supabase.",
      error.message,
    );
  }

  if (isImovelCodigoConflict(error)) {
    return buildUserFacingError(
      "Não foi possível reservar o próximo código do imóvel. Tente salvar novamente.",
      error.message,
    );
  }

  const duplicateDetails = `${error.message} ${error.details ?? ""}`.toLowerCase();
  if (error.code === "23505" && duplicateDetails.includes("imoveis_endereco_unique")) {
    return buildUserFacingError(
      "Já existe um imóvel cadastrado neste endereço na sua conta.",
      error.message,
    );
  }

  return buildUserFacingError(baseMessage, error.message);
}

async function persistImovelRowUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  corretorId: string,
  payload: Record<string, unknown>,
): Promise<{ error: PostgrestError | null }> {
  let currentPayload = { ...payload };

  for (let attempt = 0; attempt <= OPTIONAL_IMOVEL_DB_COLUMNS.length; attempt += 1) {
    const { error } = await supabase
      .from("imoveis")
      .update(currentPayload)
      .eq("id", id)
      .eq("corretor_id", corretorId);

    if (!error) {
      return { error: null };
    }

    if (!isSchemaMismatchError(error)) {
      logPostgrestError("updateImovel", error);
      return { error };
    }

    const missingColumn = extractMissingColumn(error);
    const columnToStrip =
      missingColumn && missingColumn in currentPayload
        ? missingColumn
        : OPTIONAL_IMOVEL_DB_COLUMNS.find((column) => column in currentPayload);

    if (!columnToStrip) {
      logPostgrestError("updateImovel", error);
      return { error };
    }

    logPostgrestError(`updateImovel:retry_without_${columnToStrip}`, error);
    const { [columnToStrip]: _removed, ...rest } = currentPayload;
    currentPayload = rest;
  }

  return { error: null };
}

async function persistImovelRowInsert(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: Record<string, unknown>,
): Promise<{ data: { id: string } | null; error: PostgrestError | null }> {
  let currentPayload = { ...payload };

  for (let attempt = 0; attempt <= OPTIONAL_IMOVEL_DB_COLUMNS.length; attempt += 1) {
    const { data, error } = await supabase
      .from("imoveis")
      .insert(currentPayload)
      .select("id")
      .single();

    if (!error) {
      return { data, error: null };
    }

    if (!isSchemaMismatchError(error)) {
      logPostgrestError("createImovel", error);
      return { data: null, error };
    }

    const missingColumn = extractMissingColumn(error);
    const columnToStrip =
      missingColumn && missingColumn in currentPayload
        ? missingColumn
        : OPTIONAL_IMOVEL_DB_COLUMNS.find((column) => column in currentPayload);

    if (!columnToStrip) {
      logPostgrestError("createImovel", error);
      return { data: null, error };
    }

    logPostgrestError(`createImovel:retry_without_${columnToStrip}`, error);
    const { [columnToStrip]: _removed, ...rest } = currentPayload;
    currentPayload = rest;
  }

  return { data: null, error: null };
}

function buildImovelFields(data: ImovelFormValues) {
  const complemento = buildComplementoString(data);

  return {
    codigo_personalizado: data.codigo_personalizado?.trim() || null,
    complemento: complemento || null,
    complemento_valor: complemento || null,
    complemento_tipo: data.complemento_tipo?.trim() || null,
    complemento_numero: data.complemento_numero?.trim() || null,
    complemento_torre: data.complemento_torre?.trim() || null,
    condominio_nome: data.condominio_nome?.trim() || null,
    portal_endereco_diferente: data.portal_endereco_diferente,
    portal_logradouro: data.portal_endereco_diferente
      ? data.portal_logradouro?.trim() || null
      : null,
    portal_numero: data.portal_endereco_diferente
      ? data.portal_numero?.trim() || null
      : null,
    portal_bairro: data.portal_endereco_diferente
      ? data.portal_bairro?.trim() || null
      : null,
    portal_cep: data.portal_endereco_diferente
      ? sanitizeCep(data.portal_cep ?? "")
      : null,
    portal_cidade: data.portal_endereco_diferente
      ? data.portal_cidade?.trim() || null
      : null,
    portal_estado: data.portal_endereco_diferente
      ? data.portal_estado?.trim().toUpperCase() || null
      : null,
    local_chaves: data.local_chaves,
    chaves_codigo:
      data.local_chaves === "imobiliaria" ? data.chaves_codigo?.trim() || null : null,
    chaves_descricao:
      data.local_chaves === "outros" ? data.chaves_descricao?.trim() || null : null,
    exclusividade: data.exclusividade,
    imovel_ocupado: data.imovel_ocupado,
    contrato_aluguel_ativo: data.contrato_aluguel_ativo,
    aceita_financiamento: data.aceita_financiamento,
    aceita_permuta: data.aceita_permuta,
    imovel_na_planta: data.imovel_na_planta,
    ano_construcao: numericForDb(data.ano_construcao),
    salas: numericForDb(data.salas),
    elevadores: numericForDb(data.elevadores),
    vagas_tipo: data.vagas_tipo?.trim() || null,
    vagas_cobertura: data.vagas_cobertura?.trim() || null,
    cliente_id: data.cliente_id ?? null,
    captador_id: getCaptadorPrincipalId(data.captadores),
    comissao_percent: numericForDb(data.comissao_percent),
    destinacao: data.destinacao,
    exibir_endereco_site: data.exibir_endereco_site,
    exibir_endereco_portais: data.exibir_endereco_portais,
  };
}

function buildImovelInsert(
  corretorId: string,
  data: ImovelFormValues,
  slug: string,
  codigo: string,
  clienteId: string | null,
  statusSlug: StatusImovelSlug,
  statusImovelId: string,
  cadastradoPorPerfilId: string | null,
) {
  return {
    corretor_id: corretorId,
    codigo,
    titulo: data.titulo?.trim() || "",
    slug,
    tipo: data.tipo,
    finalidade: data.finalidade,
    status: statusSlug,
    status_imovel_id: statusImovelId,
    status_aprovacao: "em_cadastro",
    data_ativacao: new Date().toISOString(),
    cadastrado_por_perfil_id: cadastradoPorPerfilId,
    cep: sanitizeCep(data.cep),
    logradouro: data.logradouro.trim(),
    numero: data.numero.trim(),
    bairro: data.bairro.trim(),
    cidade: data.cidade.trim(),
    estado: data.estado,
    latitude: data.latitude,
    longitude: data.longitude,
    area_util: numericForDb(data.area_util),
    area_total: numericForDb(data.area_total),
    quartos: numericForDb(data.quartos),
    suites: numericForDb(data.suites),
    banheiros: numericForDb(data.banheiros),
    vagas: numericForDb(data.vagas),
    valor_venda: data.finalidade === "venda" ? data.valor_venda : null,
    valor_locacao: data.finalidade === "locacao" ? data.valor_locacao : null,
    valor_condominio: numericForDb(data.valor_condominio),
    valor_iptu: numericForDb(data.valor_iptu),
    descricao: data.descricao?.trim() || null,
    diferenciais: data.diferenciais.length > 0 ? data.diferenciais : null,
    video_url: data.video_url?.trim() || null,
    publicado_site: data.publicado_site,
    destaque_site: data.publicado_site ? data.destaque_site : false,
    publicado_portais: data.publicado_portais,
    visualizacoes: 0,
    ...buildImovelFields(data),
    cliente_id: clienteId,
  };
}

function buildImovelUpdate(
  data: ImovelFormValues,
  slug: string,
  clienteId: string | null,
  statusSlug: StatusImovelSlug,
  statusImovelId: string,
) {
  return {
    titulo: data.titulo?.trim() || "",
    slug,
    tipo: data.tipo,
    finalidade: data.finalidade,
    status: statusSlug,
    status_imovel_id: statusImovelId,
    cep: sanitizeCep(data.cep),
    logradouro: data.logradouro.trim(),
    numero: data.numero.trim(),
    bairro: data.bairro.trim(),
    cidade: data.cidade.trim(),
    estado: data.estado,
    latitude: data.latitude,
    longitude: data.longitude,
    area_util: numericForDb(data.area_util),
    area_total: numericForDb(data.area_total),
    quartos: numericForDb(data.quartos),
    suites: numericForDb(data.suites),
    banheiros: numericForDb(data.banheiros),
    vagas: numericForDb(data.vagas),
    valor_venda: data.finalidade === "venda" ? data.valor_venda : null,
    valor_locacao: data.finalidade === "locacao" ? data.valor_locacao : null,
    valor_condominio: numericForDb(data.valor_condominio),
    valor_iptu: numericForDb(data.valor_iptu),
    descricao: data.descricao?.trim() || null,
    diferenciais: data.diferenciais.length > 0 ? data.diferenciais : null,
    video_url: data.video_url?.trim() || null,
    publicado_site: data.publicado_site,
    destaque_site: data.publicado_site ? data.destaque_site : false,
    publicado_portais: data.publicado_portais,
    ...buildImovelFields(data),
    cliente_id: clienteId,
  };
}

async function resolveProprietarioIds(data: ImovelFormValues): Promise<string[]> {
  const ids = [...data.proprietario_ids];

  if (data.proprietario_novo) {
    const result = await createClienteFromImovel(data.proprietario_novo);

    if (result.error || !result.clienteId) {
      throw new Error(result.error ?? "Não foi possível cadastrar o proprietário.");
    }

    ids.push(result.clienteId);
  }

  return [...new Set(ids)];
}

async function saveImovelCaptadores(
  imovelId: string,
  captadores: ImovelFormValues["captadores"],
  supabase: ImovelDbClient,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("imovel_captadores")
    .delete()
    .eq("imovel_id", imovelId);

  if (deleteError) {
    logSupabaseError("saveImovelCaptadores:delete", deleteError);
    throw new Error("Não foi possível salvar os captadores.");
  }

  if (captadores.length === 0) {
    return;
  }

  const perfilIds = new Set<string>();
  const rows = captadores.map((captador) => {
    if (captador.externo) {
      const nomeExterno = captador.nome_externo?.trim();
      if (!nomeExterno) {
        throw new Error("Informe o nome do corretor parceiro externo.");
      }

      return {
        imovel_id: imovelId,
        perfil_id: null,
        nome_externo: nomeExterno,
        principal: captador.principal,
      };
    }

    if (!captador.perfil_id) {
      throw new Error("Selecione o captador.");
    }

    if (perfilIds.has(captador.perfil_id)) {
      throw new Error("Não é possível repetir o mesmo captador.");
    }
    perfilIds.add(captador.perfil_id);

    return {
      imovel_id: imovelId,
      perfil_id: captador.perfil_id,
      principal: captador.principal,
    };
  });

  const { error: insertError } = await supabase.from("imovel_captadores").insert(rows);

  if (insertError) {
    logSupabaseError("saveImovelCaptadores:insert", insertError);
    throw new Error("Não foi possível salvar os captadores.");
  }
}

async function saveImovelProprietarios(
  imovelId: string,
  proprietarioIds: string[],
  supabase: ImovelDbClient,
): Promise<void> {
  await supabase.from("imovel_proprietarios").delete().eq("imovel_id", imovelId);

  const adicionais = proprietarioIds.slice(1);

  if (adicionais.length === 0) {
    return;
  }

  const rows = adicionais.map((clienteId, index) => ({
    imovel_id: imovelId,
    cliente_id: clienteId,
    ordem: index + 1,
  }));

  const { error } = await supabase.from("imovel_proprietarios").insert(rows);

  if (error) {
    logSupabaseError("saveImovelProprietarios:insert", error);
    throw new Error("Não foi possível salvar os proprietários adicionais.");
  }
}

async function resolveClienteId(data: ImovelFormValues): Promise<string | null> {
  const ids = await resolveProprietarioIds(data);
  return ids[0] ?? null;
}

export async function verificarImovelExistente(
  corretorId: string,
  dados: {
    logradouro: string;
    numero: string;
    complementoValor?: string;
  },
  imovelIdIgnorar?: string,
): Promise<{
  existe: boolean;
  imovel?: { id: string; codigo: string; titulo?: string; bairro: string };
}> {
  const supabase = await createClient();

  const logradouroNorm = dados.logradouro.toLowerCase().trim();
  const numeroNorm = dados.numero.toLowerCase().trim();
  const complementoNorm = (dados.complementoValor ?? "").toLowerCase().trim();

  if (!logradouroNorm || !numeroNorm) {
    return { existe: false };
  }

  let query = supabase
    .from("imoveis")
    .select("id, codigo, titulo, bairro, logradouro, numero, complemento_valor, complemento")
    .eq("corretor_id", corretorId)
    .ilike("logradouro", logradouroNorm)
    .ilike("numero", numeroNorm);

  if (imovelIdIgnorar) {
    query = query.neq("id", imovelIdIgnorar);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return { existe: false };
  }

  const duplicado = data.find((imovel) => {
    const compExistente = (
      imovel.complemento_valor ??
      imovel.complemento ??
      ""
    )
      .toLowerCase()
      .trim();
    return compExistente === complementoNorm;
  });

  if (!duplicado) {
    return { existe: false };
  }

  return {
    existe: true,
    imovel: {
      id: duplicado.id,
      codigo: duplicado.codigo ?? "",
      titulo: duplicado.titulo ?? undefined,
      bairro: duplicado.bairro ?? "",
    },
  };
}

export async function checkImovelDuplicado(
  cep: string,
  numero: string,
  complemento: string,
  logradouro?: string,
  excludeId?: string,
): Promise<{ duplicado: boolean; imovelId?: string; titulo?: string; codigo?: string; bairro?: string }> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { duplicado: false };
  }

  if (logradouro) {
    const result = await verificarImovelExistente(
      corretor.id,
      {
        logradouro,
        numero,
        complementoValor: complemento,
      },
      excludeId,
    );

    if (result.existe && result.imovel) {
      return {
        duplicado: true,
        imovelId: result.imovel.id,
        titulo: result.imovel.titulo,
        codigo: result.imovel.codigo,
        bairro: result.imovel.bairro,
      };
    }
  }

  const supabase = await createClient();
  const sanitizedCep = sanitizeCep(cep);
  const normalizedComplemento = complemento.trim().toLowerCase();

  let query = supabase
    .from("imoveis")
    .select("id, titulo, codigo, bairro, complemento, complemento_valor, complemento_numero, complemento_tipo")
    .eq("corretor_id", corretor.id)
    .eq("cep", sanitizedCep)
    .eq("numero", numero.trim());

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return { duplicado: false };
  }

  const match = data.find((imovel) => {
    const existing =
      imovel.complemento_valor?.trim().toLowerCase() ??
      imovel.complemento?.trim().toLowerCase() ??
      [imovel.complemento_tipo, imovel.complemento_numero]
        .filter(Boolean)
        .join(" ")
        .trim()
        .toLowerCase();
    return existing === normalizedComplemento;
  });

  if (!match) {
    return { duplicado: false };
  }

  return {
    duplicado: true,
    imovelId: match.id,
    titulo: match.titulo ?? undefined,
    codigo: match.codigo ?? undefined,
    bairro: match.bairro ?? undefined,
  };
}

async function fetchImoveisRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  limit: number,
  offset: number,
): Promise<Imovel[]> {
  const excludedOptional = new Set<string>();

  for (let tier = 0; tier < IMOVEL_LIST_SELECT_TIERS.length; tier += 1) {
    const { data, error } = await supabase
      .from("imoveis")
      .select(imovelListSelectForTier(tier, Array.from(excludedOptional)) as "*")
      .eq("corretor_id", corretorId)
      .order("criado_em", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error) {
      return (data ?? []).map((row) => normalizeImovelRow(row as Imovel)!) as Imovel[];
    }

    const missingColumn = extractMissingColumn(error);
    if (
      missingColumn &&
      (OPTIONAL_IMOVEL_DB_COLUMNS as readonly string[]).includes(missingColumn) &&
      !excludedOptional.has(missingColumn)
    ) {
      excludedOptional.add(missingColumn);
      logPostgrestError(`getImoveis:retry_without_${missingColumn}`, error);
      tier -= 1;
      continue;
    }

    const hasFallback = tier < IMOVEL_LIST_SELECT_TIERS.length - 1;
    if (hasFallback && isSchemaMismatchError(error)) {
      logPostgrestError(`getImoveis.tier${tier}`, error);
      continue;
    }

    logPostgrestError("getImoveis", error);
    return [];
  }

  return [];
}

export async function getImoveis(options?: ListQueryOptions): Promise<Imovel[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const limit = clampImovelListLimit(options?.limit);
  const offset = clampListOffset(options?.offset);

  const supabase = await createClient();
  const rows = await fetchImoveisRows(supabase, corretor.id, limit, offset);

  if (rows.length > 0) {
    return rows;
  }

  try {
    const admin = createServiceRoleClient();
    const fallbackRows = await fetchImoveisRows(admin, corretor.id, limit, offset);

    if (fallbackRows.length > 0) {
      console.warn("[getImoveis] authenticated query returned empty; used service role fallback", {
        corretorId: corretor.id,
      });
    }

    return fallbackRows;
  } catch (error) {
    console.error("[getImoveis] service role fallback unavailable", error);
    return rows;
  }
}

export type ImovelListingBadge = "proposta" | "negocio_fechado";

export async function getImoveisWorkflowBadges(): Promise<
  Record<string, ImovelListingBadge>
> {
  const corretor = await getCorretorForUser();
  if (!corretor) return {};

  const fetchBadges = async (supabase: Awaited<ReturnType<typeof createClient>>) => {
    const [propostasRes, negociosRes] = await Promise.all([
      supabase
        .from("propostas")
        .select("imovel_id")
        .eq("corretor_id", corretor.id)
        .not("status", "in", '("cancelada","recusada")'),
      supabase
        .from("negocios")
        .select("imovel_id")
        .eq("corretor_id", corretor.id)
        .eq("status", "fechado"),
    ]);

    const badges: Record<string, ImovelListingBadge> = {};

    for (const row of propostasRes.data ?? []) {
      if (row.imovel_id) {
        badges[row.imovel_id as string] = "proposta";
      }
    }

    for (const row of negociosRes.data ?? []) {
      if (row.imovel_id) {
        badges[row.imovel_id as string] = "negocio_fechado";
      }
    }

    return badges;
  };

  const supabase = await createClient();
  const badges = await fetchBadges(supabase);

  if (Object.keys(badges).length > 0) {
    return badges;
  }

  try {
    const admin = createServiceRoleClient();
    const fallbackBadges = await fetchBadges(admin);

    if (Object.keys(fallbackBadges).length > 0) {
      console.warn("[getImoveisWorkflowBadges] authenticated query returned empty; used service role fallback", {
        corretorId: corretor.id,
      });
    }

    return fallbackBadges;
  } catch (error) {
    console.error("[getImoveisWorkflowBadges] service role fallback unavailable", error);
    return badges;
  }
}

export async function getImovelById(id: string): Promise<Imovel | null> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  const supabase = await createClient();
  const row = await fetchImovelByIdRow(supabase, corretor.id, id);

  if (row) {
    return row;
  }

  try {
    const admin = createServiceRoleClient();
    const fallbackRow = await fetchImovelByIdRow(admin, corretor.id, id);

    if (fallbackRow) {
      console.warn("[getImovelById] authenticated query returned empty; used service role fallback", {
        corretorId: corretor.id,
        imovelId: id,
      });
    }

    return fallbackRow;
  } catch (error) {
    console.error("[getImovelById] service role fallback unavailable", error);
    return null;
  }
}

export async function updatePublicadoSite(
  id: string,
  publicado: boolean,
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const owns = await ensureImovelOwnership(id, corretor.id);

  if (!owns) {
    return { error: "Imóvel não encontrado." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("imoveis")
    .update({ publicado_site: publicado })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[updatePublicadoSite] failed", error);
    return { error: "Não foi possível atualizar a publicação." };
  }

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${id}`);

  return { success: true, imovelId: id };
}

export async function deleteImovel(id: string): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { data: imovel, error: fetchError } = await supabase
    .from("imoveis")
    .select("id, fotos:imovel_fotos(id, url, cloudinary_public_id)")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !imovel) {
    return { error: "Imóvel não encontrado." };
  }

  const fotos = (imovel.fotos ?? []) as {
    id: string;
    url: string;
    cloudinary_public_id?: string | null;
  }[];

  if (fotos.length > 0) {
    try {
      await removeImovelFotosFromStorage(fotos);
    } catch (error) {
      console.error("[deleteImovel] storage cleanup failed", error);
    }
  }

  const { error: deleteError } = await supabase
    .from("imoveis")
    .delete()
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (deleteError) {
    console.error("[deleteImovel] failed", deleteError);
    return { error: "Não foi possível excluir o imóvel." };
  }

  revalidatePath("/dashboard/imoveis");

  return { success: true };
}

async function uploadFotosForImovel(
  corretorId: string,
  imovelId: string,
  fotos: FotoUploadInput[],
): Promise<ImovelActionResult | null> {
  if (fotos.length === 0) {
    return null;
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch (error) {
    console.error("[uploadFotosForImovel] service role client failed", error);
    return {
      error: "Upload de fotos indisponível. Verifique a configuração do banco de dados.",
    };
  }

  const sortedFotos = [...fotos].sort((a, b) => a.ordem - b.ordem);

  for (const foto of sortedFotos) {
    const rawBuffer = Buffer.from(await foto.file.arrayBuffer());
    const processed = await processImageBuffer(corretorId, rawBuffer);

    if ("error" in processed) {
      return { error: processed.error };
    }

    let uploadResult: { url: string; publicId: string };

    try {
      uploadResult = await uploadFotoImovel(
        processed.buffer,
        corretorId,
        imovelId,
        processed.contentType,
      );
    } catch (error) {
      console.error("[uploadFotosForImovel] cloudinary upload failed", error);
      return { error: "Não foi possível enviar as fotos. Tente novamente." };
    }

    const { error: fotoInsertError } = await admin.from("imovel_fotos").insert({
      imovel_id: imovelId,
      url: uploadResult.url,
      cloudinary_public_id: uploadResult.publicId,
      ordem: foto.ordem,
      legenda: foto.legenda?.trim() || null,
    });

    if (fotoInsertError) {
      console.error("[uploadFotosForImovel] foto insert failed", fotoInsertError);
      try {
        await removeImovelFotosFromStorage([
          { url: uploadResult.url, cloudinary_public_id: uploadResult.publicId },
        ]);
      } catch (cleanupError) {
        console.error("[uploadFotosForImovel] cloudinary rollback failed", cleanupError);
      }
      return { error: "Não foi possível salvar as fotos do imóvel." };
    }
  }

  return null;
}

export async function uploadImovelFotos(
  imovelId: string,
  formData: FormData,
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const owns = await ensureImovelOwnership(imovelId, corretor.id);

  if (!owns) {
    return { error: "Imóvel não encontrado." };
  }

  const metadataRaw = formData.get("metadata");

  if (!metadataRaw || typeof metadataRaw !== "string") {
    return { error: "Dados das fotos inválidos." };
  }

  let metadata: FotoUploadMetadata[];

  try {
    metadata = JSON.parse(metadataRaw) as FotoUploadMetadata[];
  } catch {
    return { error: "Dados das fotos inválidos." };
  }

  if (!Array.isArray(metadata) || metadata.length === 0) {
    return { success: true, imovelId };
  }

  const fotos: FotoUploadInput[] = [];

  for (const item of metadata) {
    const file = formData.get(`file:${item.tempId}`);

    if (!(file instanceof File) || file.size === 0) {
      continue;
    }

    fotos.push({
      file,
      legenda: item.legenda,
      ordem: item.ordem,
    });
  }

  if (fotos.length === 0) {
    return {
      error:
        "Não foi possível receber os arquivos das fotos. Tente salvar novamente ou envie menos fotos por vez.",
    };
  }

  const uploadResult = await uploadFotosForImovel(corretor.id, imovelId, fotos);

  if (uploadResult?.error) {
    return uploadResult;
  }

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${imovelId}`);

  return { success: true, imovelId };
}

export async function createImovel(
  rawData: ImovelFormValues,
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  try {
    await ensureStatusImovelDefaults(corretor.id);
  } catch (error) {
    console.error("[createImovel] ensure defaults failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível configurar os status padrão de imóvel.",
    };
  }

  const parsed = imovelCadastroSchema.safeParse(rawData);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((item) => {
      const path = String(item.path[0] ?? "");
      const labels: Record<string, string> = {
        tipo: "Tipo",
        finalidade: "Finalidade",
        destinacao: "Destinação",
        status_imovel_id: "Status",
        cep: "CEP",
        logradouro: "Logradouro",
        numero: "Número",
        complemento_tipo: "Tipo de complemento",
        complemento_numero: "Complemento/Identificação",
        bairro: "Bairro",
        cidade: "Cidade",
        estado: "Estado (UF)",
        cliente_id: "Proprietário",
        captadores: "Captador",
        quartos: "Quartos",
        vagas: "Vagas",
        valor_venda: "Valor de venda/locação",
        valor_locacao: "Valor de venda/locação",
      };
      return labels[path] ?? item.message;
    });
    const uniqueLabels = [...new Set(issues)];
    return {
      error: `Preencha os campos obrigatórios: ${uniqueLabels.join(", ")}.`,
    };
  }

  const data = parsed.data;

  const complementoValor = buildComplementoString(data);
  const duplicidade = await verificarImovelExistente(
    corretor.id,
    {
      logradouro: data.logradouro,
      numero: data.numero,
      complementoValor,
    },
  );

  if (duplicidade.existe && duplicidade.imovel) {
    return {
      error: mensagemImovelDuplicado(duplicidade.imovel.codigo, duplicidade.imovel.bairro),
    };
  }

  try {
    const plano = await getPlanoAtivo(corretor.id);
    const limite = IMOVEL_LIMITS[plano];

    if (limite !== null) {
      const total = await countImoveis(corretor.id);

      if (total >= limite) {
        return {
          error: `Seu plano ${plano === "basico" ? "Básico" : plano} permite até ${limite} imóveis. Faça upgrade para cadastrar mais.`,
        };
      }
    }
  } catch (error) {
    console.error("[createImovel] limit check failed", error);
    return { error: "Não foi possível verificar o limite do seu plano." };
  }

  const baseSlug = generateImovelSlug(data.titulo ?? "", data.cidade);
  const slug = await ensureUniqueImovelSlug(corretor.id, baseSlug);

  let codigo: string;
  try {
    codigo = await generateNextCodigo(corretor.id);
  } catch (error) {
    console.error("[createImovel] codigo generation failed", error);
    return { error: "Não foi possível gerar o código do imóvel." };
  }

  const supabase = await createClient();

  let writeClient: ImovelDbClient;

  try {
    writeClient = createImovelWriteClient();
  } catch (error) {
    console.error("[createImovel] write client failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o imóvel. Verifique a configuração do servidor.",
    };
  }

  let clienteId: string | null = null;
  let proprietarioIds: string[] = [];
  try {
    proprietarioIds = await resolveProprietarioIds(data);
    clienteId = proprietarioIds[0] ?? null;
  } catch (error) {
    console.error("[createImovel] proprietario failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível vincular o proprietário.",
    };
  }

  const statusResult = await resolveStatusImovelByNome(
    corretor.id,
    "Em cadastro",
    supabase,
  );

  if (!statusResult.ok) {
    return { error: formatStatusImovelResolveError("Em cadastro", statusResult) };
  }

  const statusEmCadastro = statusResult.status;

  const perfil = await getPerfilForUser();

  const insertPayloadBase = buildImovelInsert(
    corretor.id,
    data,
    slug,
    "0000",
    clienteId,
    "em_cadastro",
    statusEmCadastro.id,
    perfil?.id ?? null,
  );

  let imovel: { id: string } | null = null;
  let insertError: PostgrestError | null = null;
  let codigoUsado = codigo;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      try {
        codigoUsado = await generateNextCodigo(corretor.id);
      } catch (error) {
        console.error("[createImovel] codigo regeneration failed", error);
        return { error: "Não foi possível gerar o código do imóvel." };
      }
    }

    const result = await persistImovelRowInsert(writeClient, {
      ...insertPayloadBase,
      codigo: codigoUsado,
    });

    imovel = result.data;
    insertError = result.error;

    if (!insertError) {
      break;
    }

    if (!isImovelCodigoConflict(insertError)) {
      break;
    }

    console.warn("[createImovel] codigo conflict, retrying", {
      corretorId: corretor.id,
      codigo: codigoUsado,
      attempt,
    });
  }

  if (insertError || !imovel) {
    return {
      error: insertError
        ? mapImovelPersistError(insertError, "insert")
        : "Não foi possível cadastrar o imóvel. Tente novamente.",
    };
  }

  await registrarAuditoriaImovel(imovel.id, "imovel_cadastrado", {
    detalhes: { codigo: codigoUsado },
  });

  try {
    await saveImovelCaptadores(imovel.id, data.captadores, writeClient);
    await saveImovelProprietarios(imovel.id, proprietarioIds, writeClient);
  } catch (error) {
    console.error("[createImovel] relacionamentos failed", error);
    await writeClient.from("imoveis").delete().eq("id", imovel.id);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar captadores ou proprietários.",
    };
  }

  revalidatePath("/dashboard/imoveis");

  return { success: true, imovelId: imovel.id };
}

export async function updateImovel(
  id: string,
  rawData: ImovelFormValues,
  fotos: FotoMetadataInput[],
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const scopedClient = await createImovelScopedClient(corretor.id, id);

  if (!scopedClient) {
    return { error: "Imóvel não encontrado." };
  }

  const parsed = imovelCadastroSchema.safeParse(rawData);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((item) => {
      const path = String(item.path[0] ?? "");
      const labels: Record<string, string> = {
        tipo: "Tipo",
        finalidade: "Finalidade",
        destinacao: "Destinação",
        status_imovel_id: "Status",
        cep: "CEP",
        logradouro: "Logradouro",
        numero: "Número",
        complemento_tipo: "Tipo de complemento",
        complemento_numero: "Complemento/Identificação",
        bairro: "Bairro",
        cidade: "Cidade",
        estado: "Estado (UF)",
        cliente_id: "Proprietário",
        captadores: "Captador",
        quartos: "Quartos",
        vagas: "Vagas",
        valor_venda: "Valor de venda/locação",
        valor_locacao: "Valor de venda/locação",
      };
      return labels[path] ?? item.message;
    });
    const uniqueLabels = [...new Set(issues)];
    return {
      error: `Preencha os campos obrigatórios: ${uniqueLabels.join(", ")}.`,
    };
  }

  const data = parsed.data;

  const complementoValor = buildComplementoString(data);
  const duplicidade = await verificarImovelExistente(
    corretor.id,
    {
      logradouro: data.logradouro,
      numero: data.numero,
      complementoValor,
    },
    id,
  );

  if (duplicidade.existe && duplicidade.imovel) {
    return {
      error: mensagemImovelDuplicado(duplicidade.imovel.codigo, duplicidade.imovel.bairro),
    };
  }

  const baseSlug = generateImovelSlug(data.titulo ?? "", data.cidade);
  const slug = await ensureUniqueImovelSlugForUpdate(corretor.id, baseSlug, id, scopedClient);

  let clienteId: string | null = null;
  let proprietarioIds: string[] = [];
  try {
    proprietarioIds = await resolveProprietarioIds(data);
    clienteId = proprietarioIds[0] ?? null;
  } catch (error) {
    console.error("[updateImovel] proprietario failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível vincular o proprietário.",
    };
  }

  const { data: imovelAtual, error: fetchError } = await scopedClient
    .from("imoveis")
    .select("status_aprovacao")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !imovelAtual) {
    return { error: "Imóvel não encontrado." };
  }

  let statusSlug: StatusImovelSlug;
  let statusImovelId: string;

  if (imovelAtual.status_aprovacao === "em_cadastro") {
    const statusResult = await resolveStatusImovelByNome(
      corretor.id,
      "Em cadastro",
      scopedClient,
    );

    if (!statusResult.ok) {
      return { error: formatStatusImovelResolveError("Em cadastro", statusResult) };
    }

    statusSlug = "em_cadastro";
    statusImovelId = statusResult.status.id;
  } else if (imovelAtual.status_aprovacao === "aguardando_aprovacao") {
    const statusResult = await resolveStatusImovelByNome(
      corretor.id,
      "Aguardando aprovação",
      scopedClient,
    );

    if (!statusResult.ok) {
      return {
        error: formatStatusImovelResolveError("Aguardando aprovação", statusResult),
      };
    }

    statusSlug = "aguardando_aprovacao";
    statusImovelId = statusResult.status.id;
  } else {
    if (!data.status_imovel_id) {
      return { error: "Selecione o status operacional do imóvel." };
    }
    statusSlug = await resolveStatusSlug(corretor.id, data.status_imovel_id);
    statusImovelId = data.status_imovel_id;
  }

  const { error: updateError } = await persistImovelRowUpdate(
    scopedClient,
    id,
    corretor.id,
    buildImovelUpdate(data, slug, clienteId, statusSlug, statusImovelId),
  );

  if (updateError) {
    return { error: mapImovelPersistError(updateError, "update") };
  }

  await registrarAuditoriaImovel(id, "imovel_editado");

  try {
    await saveImovelCaptadores(id, data.captadores, scopedClient);
    await saveImovelProprietarios(id, proprietarioIds, scopedClient);
  } catch (error) {
    console.error("[updateImovel] relacionamentos failed", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar captadores ou proprietários.",
    };
  }

  const { data: existingFotos, error: fotosError } = await scopedClient
    .from("imovel_fotos")
    .select("id, url, cloudinary_public_id")
    .eq("imovel_id", id);

  if (fotosError) {
    console.error("[updateImovel] fetch fotos failed", fotosError);
    return { error: "Não foi possível atualizar as fotos." };
  }

  const keptExistingIds = new Set(
    fotos.filter((foto) => foto.existingId).map((foto) => foto.existingId as string),
  );

  const removedFotos = (existingFotos ?? []).filter((foto) => !keptExistingIds.has(foto.id));

  if (removedFotos.length > 0) {
    try {
      await removeImovelFotosFromStorage(removedFotos);
    } catch (error) {
      console.error("[updateImovel] storage cleanup failed", error);
    }

    await scopedClient
      .from("imovel_fotos")
      .delete()
      .in(
        "id",
        removedFotos.map((foto) => foto.id),
      );
  }

  for (const foto of fotos) {
    if (foto.existingId) {
      await scopedClient
        .from("imovel_fotos")
        .update({
          ordem: foto.ordem,
          legenda: foto.legenda?.trim() || null,
        })
        .eq("id", foto.existingId)
        .eq("imovel_id", id);
    }
  }

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${id}`);

  return { success: true, imovelId: id };
}
