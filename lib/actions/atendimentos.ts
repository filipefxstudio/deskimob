"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_FICHA_VISITA_TEXTO,
  DEFAULT_MOTIVOS_DESCARTE,
} from "@/lib/constants/atendimentos";
import {
  formatDateTimeBrasilia,
  formatLocalDateInput,
  localDateTimeToUTC,
  parseLocalDateTimeInput,
} from "@/lib/dates/format";
import { podeAvancarEtapa } from "@/lib/leads/etapa-order";
import { parseLeadObservacoes, mergeLeadObservacoesMeta } from "@/lib/leads/observacoes";
import {
  fetchPreferenciasInteresseFromImovel,
  resolveValorReferenciaImovel,
  type PreferenciasInteresseFromImovel,
} from "@/lib/atendimentos/interesse-from-imovel";
import { atualizarStatusImovelAutomatico } from "@/lib/actions/imoveis";
import {
  avaliarSelecaoPessoaAtendimento,
  verificarDuplicidadeContatoLead,
  verificarPessoaExistente,
} from "@/lib/actions/clientes";
import { erroDuplicidadePessoa } from "@/lib/pessoas/messages";
import { normalizeEmail, telefonesEquivalentes } from "@/lib/pessoas/duplicate";
import { getPerfisEquipe } from "@/lib/actions/configuracoes";
import { negociosTemCamposCompletos } from "@/lib/negocios/schema";
import { buildNegocioRow, logSupabaseError } from "@/lib/negocios/row";
import type { CreateNegocioInput } from "@/lib/negocios/types";
import {
  MSG_NEGOCIO_PROPOSTA_NAO_ACEITA,
  MSG_PROPOSTA_SEM_PARECER,
} from "@/lib/atendimentos/regras";
import { normalizar } from "@/lib/utils/normalizar";
import { isValidUuid } from "@/lib/utils/uuid";
import { parseTiposImovelBusca } from "@/lib/atendimentos/tipo-imovel-busca";
import { IMOVEL_LIST_LIMIT } from "@/lib/constants/listings";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createTenantDataClient,
  leadVisivelParaUsuario,
  resolveTenantAccess,
  type TenantDbClient,
} from "@/lib/supabase/tenant-access";
import {
  extractMissingColumn,
  isSchemaMismatchError,
  isUniqueViolationError,
  logPostgrestError,
} from "@/lib/supabase/postgrest-error";
import { createClient } from "@/lib/supabase/server";
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  AtendimentoConfig,
  AuditoriaAtendimento,
  EtapaLead,
  Imovel,
  Lead,
  LeadImovelSelecionado,
  MotivoDescarte,
  Negocio,
  Proposta,
  SituacaoLead,
  StatusProposta,
  StatusVisita,
  TemperaturaLead,
  TipoInteracao,
  Visita,
} from "@/types";

export type AtendimentoActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
  id?: string;
  token?: string;
  html?: string;
};

type OrigemInteracao = "usuario" | "sistema";

const OPTIONAL_LEAD_CREATE_COLUMNS = [
  "bairros_interesse",
  "finalidade_busca",
  "tipo_imovel_busca",
  "quartos_minimo",
  "suites_minimas",
  "banheiros_minimos",
  "vagas_minimas",
  "valor_minimo",
  "valor_maximo",
  "data_entrada",
  "codigo_atendimento",
  "situacao",
  "perfil_id",
  "cliente_id",
  "imovel_id",
] as const;

function createLeadWriteClient(): Awaited<ReturnType<typeof createClient>> {
  try {
    return createServiceRoleClient();
  } catch (error) {
    console.error("[createLeadWriteClient] service role unavailable", error);
    throw new Error("Não foi possível salvar o atendimento. Verifique a configuração do servidor.");
  }
}

async function persistLeadInsert(
  payload: Record<string, unknown>,
): Promise<{ leadId: string | null; error: unknown }> {
  const leadId = typeof payload.id === "string" ? payload.id : randomUUID();
  let currentPayload: Record<string, unknown> = { ...payload, id: leadId };

  let writeClient: Awaited<ReturnType<typeof createClient>>;
  try {
    writeClient = createLeadWriteClient();
  } catch (error) {
    return { leadId: null, error };
  }

  for (let attempt = 0; attempt <= OPTIONAL_LEAD_CREATE_COLUMNS.length; attempt += 1) {
    const { error } = await writeClient.from("leads").insert(currentPayload);

    if (!error) {
      return { leadId, error: null };
    }

    if (!isSchemaMismatchError(error)) {
      logPostgrestError("createAtendimento", error);
      return { leadId: null, error };
    }

    const missingColumn = extractMissingColumn(error);
    const columnToStrip =
      missingColumn && missingColumn in currentPayload
        ? missingColumn
        : OPTIONAL_LEAD_CREATE_COLUMNS.find((column) => column in currentPayload);

    if (!columnToStrip) {
      logPostgrestError("createAtendimento", error);
      return { leadId: null, error };
    }

    logPostgrestError(`createAtendimento:retry_without_${columnToStrip}`, error);
    const rest = { ...currentPayload };
    delete rest[columnToStrip];
    currentPayload = rest;
  }

  return { leadId: null, error: null };
}

function revalidateAtendimentoPaths(leadId: string) {
  revalidatePath("/dashboard/atendimentos");
  revalidatePath(`/dashboard/atendimentos/${leadId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
}

async function getLeadPerfilId(lead: { perfil_id?: string | null; observacoes?: string | null }) {
  if (lead.perfil_id) return lead.perfil_id;
  const { meta } = parseLeadObservacoes(lead.observacoes);
  return meta.perfil_id ?? null;
}

function isLeadCodigoConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const postgrestError = error as PostgrestError;
  if (!isUniqueViolationError(postgrestError)) {
    return false;
  }

  const text = `${postgrestError.message ?? ""} ${postgrestError.details ?? ""}`.toLowerCase();
  return text.includes("codigo_atendimento") || text.includes("leads_corretor_codigo");
}

function parseCodigoAtendimentoNumero(codigo?: string | null): number | null {
  if (!codigo) {
    return null;
  }

  const match = codigo.match(/ATD-(\d+)/i);
  if (!match) {
    return null;
  }

  const numero = parseInt(match[1], 10);
  return Number.isNaN(numero) ? null : numero;
}

export async function gerarCodigoAtendimento(corretorId: string): Promise<string> {
  let admin;

  try {
    admin = createServiceRoleClient();
  } catch (error) {
    console.error("[gerarCodigoAtendimento] service role unavailable", error);
    throw new Error("Não foi possível gerar o código do atendimento.");
  }

  const { data, error } = await admin
    .from("leads")
    .select("codigo_atendimento")
    .eq("corretor_id", corretorId)
    .not("codigo_atendimento", "is", null);

  if (error) {
    logPostgrestError("gerarCodigoAtendimento", error);
    throw new Error("Não foi possível gerar o código do atendimento.");
  }

  let max = 0;
  for (const row of data ?? []) {
    const numero = parseCodigoAtendimentoNumero(row.codigo_atendimento as string | undefined);
    if (numero != null && numero > max) {
      max = numero;
    }
  }

  return `ATD-${String(max + 1).padStart(4, "0")}`;
}

export async function registrarInteracao(
  leadId: string,
  tipo: TipoInteracao,
  descricao: string,
  options?: { origem?: OrigemInteracao; data?: string },
): Promise<void> {
  const origem = options?.origem ?? "usuario";

  const { addInteracao } = await import("@/lib/actions/leads");
  await addInteracao(leadId, {
    tipo,
    descricao,
    data: options?.data,
    contarPrimeiraResposta: origem === "usuario",
  });
}

export async function registrarAuditoria(
  leadId: string,
  acao: string,
  detalhes?: Record<string, unknown>,
  perfilId?: string | null,
): Promise<void> {
  const corretor = await getCorretorForUser();
  if (!corretor) return;

  let perfilIdFinal: string | null = null;
  if (perfilId !== undefined) {
    perfilIdFinal = perfilId;
  } else {
    const perfil = await getPerfilForUser(corretor.id);
    perfilIdFinal = perfil?.id ?? null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("auditoria_atendimento").insert({
    lead_id: leadId,
    corretor_id: corretor.id,
    perfil_id: perfilIdFinal,
    acao,
    detalhes: detalhes ?? null,
  });

  if (error) {
    console.error("[registrarAuditoria]", error);
  }
}

async function avancarEtapaLead(
  leadId: string,
  novaEtapa: EtapaLead,
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  registrarAuto = true,
): Promise<void> {
  const { data: lead } = await supabase
    .from("leads")
    .select("etapa")
    .eq("id", leadId)
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (!lead) return;

  const etapaAtual = lead.etapa as EtapaLead;
  if (!podeAvancarEtapa(etapaAtual, novaEtapa)) return;

  await supabase
    .from("leads")
    .update({
      etapa: novaEtapa,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("corretor_id", corretorId);

  if (registrarAuto && novaEtapa !== etapaAtual) {
    await registrarInteracao(
      leadId,
      "anotacao",
      `Etapa avançada para ${novaEtapa.replace(/_/g, " ")}.`,
      { origem: "sistema" },
    );
  }
}

async function criarAgendaFutura(input: {
  corretorId: string;
  leadId: string;
  imovelId?: string | null;
  visitaId?: string | null;
  perfilId?: string | null;
  tipo: string;
  titulo: string;
  descricao?: string;
  dataAtividade: string;
  lembreteEmail?: boolean;
  /** Visitas e reagendamentos devem sempre aparecer na agenda, mesmo no passado. */
  allowPast?: boolean;
}): Promise<boolean> {
  let dataAtividadeUtc: string;
  try {
    dataAtividadeUtc = parseLocalDateTimeInput(input.dataAtividade);
  } catch {
    console.error("[criarAgendaFutura] data inválida:", input.dataAtividade);
    return false;
  }

  if (!input.allowPast && new Date(dataAtividadeUtc) <= new Date()) {
    return false;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("agenda").insert({
    corretor_id: input.corretorId,
    lead_id: input.leadId,
    imovel_id: input.imovelId ?? null,
    visita_id: input.visitaId ?? null,
    perfil_id: input.perfilId ?? null,
    tipo: input.tipo,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    data_atividade: dataAtividadeUtc,
    lembrete_email: input.lembreteEmail ?? false,
    status: "pendente",
  });

  if (error) {
    console.error("[criarAgendaFutura]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }

  return true;
}

/** Recupera visitas agendadas que ficaram sem registro na agenda (ex.: horário no passado). */
export async function syncVisitasSemAgenda(
  corretorId: string,
  supabase: TenantDbClient,
): Promise<void> {
  const { data: visitas, error: visitasError } = await supabase
    .from("visitas")
    .select("id, lead_id, imovel_id, perfil_id, data_visita, observacoes")
    .eq("corretor_id", corretorId)
    .eq("status", "agendada");

  if (visitasError || !visitas?.length) {
    if (visitasError) {
      console.error("[syncVisitasSemAgenda]", visitasError);
    }
    return;
  }

  const visitaIds = visitas.map((visita) => visita.id);
  const { data: agendas, error: agendasError } = await supabase
    .from("agenda")
    .select("visita_id")
    .eq("corretor_id", corretorId)
    .in("visita_id", visitaIds);

  if (agendasError) {
    console.error("[syncVisitasSemAgenda]", agendasError);
    return;
  }

  const visitasComAgenda = new Set(
    (agendas ?? [])
      .map((item) => item.visita_id)
      .filter((visitaId): visitaId is string => Boolean(visitaId)),
  );

  const visitasSemAgenda = visitas.filter((visita) => !visitasComAgenda.has(visita.id));
  if (visitasSemAgenda.length === 0) {
    return;
  }

  const rows = visitasSemAgenda.map((visita) => ({
    corretor_id: corretorId,
    lead_id: visita.lead_id,
    imovel_id: visita.imovel_id,
    visita_id: visita.id,
    perfil_id: visita.perfil_id,
    tipo: "visita" as const,
    titulo: "Visita agendada",
    descricao: visita.observacoes,
    data_atividade: visita.data_visita,
    status: "pendente" as const,
  }));

  const { error } = await supabase.from("agenda").insert(rows);

  if (error) {
    console.error("[syncVisitasSemAgenda] batch insert", {
      count: rows.length,
      message: error.message,
      code: error.code,
    });
  }
}

export interface CreateAtendimentoInput {
  nome: string;
  telefone: string;
  email?: string;
  cliente_id?: string;
  midia_nome?: string;
  perfil_id?: string;
  imovel_id?: string;
  finalidade_busca?: string;
  tipo_imovel_busca?: string;
  bairros_interesse?: string[];
  quartos_minimo?: number;
  suites_minimas?: number;
  banheiros_minimos?: number;
  vagas_minimas?: number;
  valor_minimo?: number;
  valor_maximo?: number;
  observacoes?: string;
}

function mapMidiaToOrigem(midiaNome?: string): string {
  if (!midiaNome?.trim()) return "manual";
  const normalized = midiaNome.trim().toLowerCase();
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("site")) return "site";
  if (normalized.includes("indica")) return "indicacao";
  if (normalized.includes("portal")) return "portal";
  return "manual";
}

async function garantirImovelInteresseSelecionado(
  leadId: string,
  imovelId: string,
  corretorId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
  interesseInicial = false,
): Promise<void> {
  const { data: existente } = await supabase
    .from("lead_imoveis_selecionados")
    .select("id, interesse_inicial")
    .eq("lead_id", leadId)
    .eq("imovel_id", imovelId)
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (existente) {
    if (interesseInicial && !existente.interesse_inicial) {
      await supabase
        .from("lead_imoveis_selecionados")
        .update({ interesse_inicial: true })
        .eq("id", existente.id);
    }
    return;
  }

  await supabase.from("lead_imoveis_selecionados").insert({
    lead_id: leadId,
    imovel_id: imovelId,
    corretor_id: corretorId,
    interesse_inicial: interesseInicial,
    token_compartilhamento: randomUUID(),
  });
}

function campoTextoPreenchido(valor?: string | null): boolean {
  return Boolean(valor?.trim());
}

function numeroFiltroAtivo(valor?: number | null): boolean {
  return valor != null && valor > 0;
}

function imovelCompativelBairros(imovel: Imovel, bairrosInteresse: string[]): boolean {
  const bairroImovel = normalizar(imovel.bairro ?? "");
  if (!bairroImovel) return false;

  return bairrosInteresse.some((bairro) => {
    const alvo = normalizar(bairro);
    return bairroImovel.includes(alvo) || alvo.includes(bairroImovel);
  });
}

export async function podeExcluirAtendimento(): Promise<boolean> {
  const perfil = await getPerfilForUser();
  return perfil?.papel === "admin";
}

export async function excluirAtendimento(
  leadId: string,
  motivo: string,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  const perfil = await getPerfilForUser();
  if (!corretor) return { error: "Sessão expirada." };
  if (perfil?.papel !== "admin") return { error: "Sem permissão para excluir." };

  const motivoTrim = motivo.trim();
  if (!motivoTrim) return { error: "Informe o motivo da exclusão." };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, codigo_atendimento, nome")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!lead) return { error: "Atendimento não encontrado." };

  await registrarAuditoria(leadId, "atendimento_excluido", {
    motivo: motivoTrim,
    codigo: lead.codigo_atendimento,
    nome: lead.nome,
  });

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível excluir o atendimento." };

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Atendimento excluído." };
}

export async function createAtendimento(
  input: CreateAtendimentoInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const nome = input.nome.trim();
  const telefone = input.telefone.trim();
  if (!nome) return { error: "Informe o nome." };
  if (!telefone) return { error: "Informe o telefone." };

  const perfil = await getPerfilForUser(corretor.id);
  const perfilInformado = input.perfil_id?.trim();
  const perfilId =
    perfilInformado && isValidUuid(perfilInformado)
      ? perfilInformado
      : perfil?.id && isValidUuid(perfil.id)
        ? perfil.id
        : null;

  const supabase = await createClient();

  let clienteId = input.cliente_id ?? null;

  if (clienteId) {
    const duplicidadeLead = await verificarDuplicidadeContatoLead(
      telefone,
      input.email,
      undefined,
      clienteId,
    );
    if (duplicidadeLead.bloqueado) {
      return {
        error: duplicidadeLead.mensagem ?? "Esta pessoa já tem um atendimento ativo.",
      };
    }
  } else {
    const duplicidadeLead = await verificarDuplicidadeContatoLead(telefone, input.email);
    if (duplicidadeLead.bloqueado) {
      return { error: duplicidadeLead.mensagem ?? "Essa pessoa já está cadastrada." };
    }

    const duplicidade = await verificarPessoaExistente(corretor.id, telefone, input.email);
    if (duplicidade.existe && duplicidade.cliente?.id) {
      const avaliacao = await avaliarSelecaoPessoaAtendimento(duplicidade.cliente.id);
      if (avaliacao.tipo === "bloqueado") {
        return {
          error:
            avaliacao.mensagem ??
            erroDuplicidadePessoa(duplicidade.motivo!, duplicidade.cliente.nome),
        };
      }
      clienteId = duplicidade.cliente.id;
    }
  }

  const agora = new Date().toISOString();
  let insertedLeadId: string | null = null;
  let codigo = "";
  let lastError: unknown = null;

  let preferenciasImovel: PreferenciasInteresseFromImovel | null = null;
  const imovelIdValido =
    input.imovel_id && isValidUuid(input.imovel_id) ? input.imovel_id : null;

  if (imovelIdValido) {
    const config = await getAtendimentoConfigForCorretor(supabase, corretor.id);
    preferenciasImovel = await fetchPreferenciasInteresseFromImovel(
      supabase,
      corretor.id,
      imovelIdValido,
      config?.faixa_valor_percent ?? 20,
    );
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      codigo = await gerarCodigoAtendimento(corretor.id);
    } catch (error) {
      console.error("[createAtendimento] codigo generation failed", error);
      return { error: "Não foi possível gerar o código do atendimento." };
    }

    const leadId = randomUUID();
    const result = await persistLeadInsert({
      id: leadId,
      corretor_id: corretor.id,
      cliente_id: clienteId,
      nome,
      telefone,
      email: input.email?.trim() || null,
      imovel_id: imovelIdValido,
      perfil_id: perfilId,
      codigo_atendimento: codigo,
      situacao: "em_atendimento",
      finalidade_busca:
        input.finalidade_busca || preferenciasImovel?.finalidade_busca || null,
      tipo_imovel_busca:
        input.tipo_imovel_busca?.trim() || preferenciasImovel?.tipo_imovel_busca || null,
      bairros_interesse: input.bairros_interesse?.length
        ? input.bairros_interesse
        : preferenciasImovel?.bairros_interesse.length
          ? preferenciasImovel.bairros_interesse
          : null,
      quartos_minimo: input.quartos_minimo ?? preferenciasImovel?.quartos_minimo ?? null,
      suites_minimas: input.suites_minimas ?? preferenciasImovel?.suites_minimas ?? null,
      banheiros_minimos:
        input.banheiros_minimos ?? preferenciasImovel?.banheiros_minimos ?? null,
      vagas_minimas: input.vagas_minimas ?? preferenciasImovel?.vagas_minimas ?? null,
      valor_minimo: input.valor_minimo ?? preferenciasImovel?.valor_minimo ?? null,
      valor_maximo: input.valor_maximo ?? preferenciasImovel?.valor_maximo ?? null,
      origem: mapMidiaToOrigem(input.midia_nome),
      etapa: "novo",
      temperatura: "indefinido",
      atendido_por: "corretor",
      data_entrada: agora,
      observacoes: input.observacoes?.trim() || null,
    });

    if (!result.error && result.leadId) {
      insertedLeadId = result.leadId;
      break;
    }

    lastError = result.error;
    if (!isLeadCodigoConflict(result.error)) {
      break;
    }
  }

  if (!insertedLeadId) {
    if (lastError && typeof lastError === "object" && "message" in lastError) {
      console.error("[createAtendimento] insert failed", lastError);
    }
    return { error: "Não foi possível criar o atendimento." };
  }

  await registrarInteracao(
    insertedLeadId,
    "anotacao",
    `Atendimento ${codigo} criado.`,
    { origem: "sistema" },
  );
  await registrarAuditoria(insertedLeadId, "atendimento_criado", { codigo });

  if (input.imovel_id) {
    await garantirImovelInteresseSelecionado(
      insertedLeadId,
      input.imovel_id,
      corretor.id,
      supabase,
      true,
    );
  }

  revalidateAtendimentoPaths(insertedLeadId);
  return { success: true, id: insertedLeadId, message: `Atendimento ${codigo} criado.` };
}

export async function getAtendimentoCompleto(leadId: string) {
  const corretor = await getCorretorForUser();
  if (!corretor) return null;

  const access = await resolveTenantAccess(corretor);
  const supabase = await createClient();
  let dataClient: TenantDbClient = supabase;

  let bundle = await fetchAtendimentoBundle(dataClient, corretor.id, leadId);

  if (!bundle.lead) {
    const admin = await createTenantDataClient();
    if (!admin) return null;
    dataClient = admin;
    bundle = await fetchAtendimentoBundle(admin, corretor.id, leadId);
    if (bundle.lead) {
      console.warn("[getAtendimentoCompleto] used service role fallback", {
        corretorId: corretor.id,
        leadId,
      });
    }
  }

  if (!bundle.lead) return null;

  if (!access.verTodos && !leadVisivelParaUsuario(bundle.lead, access)) {
    return null;
  }

  const lead = bundle.lead;
  if (lead.interacoes) {
    lead.interacoes.sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    );
  }

  if (lead.imovel_id) {
    await garantirImovelInteresseSelecionado(
      leadId,
      lead.imovel_id,
      corretor.id,
      dataClient,
    );
    const { data: refreshed } = await dataClient
      .from("lead_imoveis_selecionados")
      .select("*, imovel:imoveis(*, fotos:imovel_fotos(*))")
      .eq("lead_id", leadId)
      .eq("corretor_id", corretor.id)
      .order("criado_em", { ascending: false });
    if (refreshed) {
      return {
        lead,
        visitas: bundle.visitas,
        propostas: bundle.propostas,
        negocios: bundle.negocios,
        imoveisSelecionados: refreshed as LeadImovelSelecionado[],
        auditoria: bundle.auditoria,
      };
    }
  }

  return {
    lead,
    visitas: bundle.visitas,
    propostas: bundle.propostas,
    negocios: bundle.negocios,
    imoveisSelecionados: bundle.imoveisSelecionados,
    auditoria: bundle.auditoria,
  };
}

const LEAD_ATENDIMENTO_SELECT_TIERS = [
  "*, imovel:imoveis!leads_imovel_id_fkey(*, fotos:imovel_fotos(*)), perfil:perfis(id, nome, email, papel), interacoes:lead_interacoes(*)",
  "*, imovel:imoveis!leads_imovel_id_fkey(*, fotos:imovel_fotos(*)), perfil:perfis(id, nome, email, papel)",
  "*, imovel:imoveis!leads_imovel_id_fkey(*, fotos:imovel_fotos(*))",
  "*",
] as const;

async function fetchAtendimentoLeadRow(
  client: TenantDbClient,
  corretorId: string,
  leadId: string,
): Promise<Lead | null> {
  for (let tier = 0; tier < LEAD_ATENDIMENTO_SELECT_TIERS.length; tier += 1) {
    const { data, error } = await client
      .from("leads")
      .select(LEAD_ATENDIMENTO_SELECT_TIERS[tier] as "*")
      .eq("id", leadId)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (!error && data) {
      const lead = data as Lead;
      if (!lead.interacoes) {
        const { data: interacoes } = await client
          .from("lead_interacoes")
          .select("*")
          .eq("lead_id", leadId)
          .eq("corretor_id", corretorId)
          .order("criado_em", { ascending: false });
        lead.interacoes = interacoes ?? [];
      }
      return lead;
    }

    const hasFallback = tier < LEAD_ATENDIMENTO_SELECT_TIERS.length - 1;
    if (hasFallback && error && isSchemaMismatchError(error)) {
      logPostgrestError(`getAtendimentoCompleto.lead.tier${tier}`, error);
      continue;
    }

    if (error) {
      logPostgrestError("getAtendimentoCompleto.lead", error);
    }

    break;
  }

  return null;
}

async function fetchAtendimentoBundle(
  client: TenantDbClient,
  corretorId: string,
  leadId: string,
) {
  const lead = await fetchAtendimentoLeadRow(client, corretorId, leadId);
  if (!lead) {
    return {
      lead: null,
      visitas: [] as Visita[],
      propostas: [] as Proposta[],
      negocios: [] as Negocio[],
      imoveisSelecionados: [] as LeadImovelSelecionado[],
      auditoria: [] as AuditoriaAtendimento[],
    };
  }

  const [visitasRes, propostasRes, negociosRes, selecionadosRes, auditoriaRes] =
    await Promise.all([
      client
        .from("visitas")
        .select("*, imovel:imoveis(*, fotos:imovel_fotos(*))")
        .eq("lead_id", leadId)
        .eq("corretor_id", corretorId)
        .order("data_visita", { ascending: false }),
      client
        .from("propostas")
        .select(
          "*, imovel:imoveis(*, fotos:imovel_fotos(*), captador:perfis!captador_id(id, nome))",
        )
        .eq("lead_id", leadId)
        .eq("corretor_id", corretorId)
        .order("data_proposta", { ascending: false }),
      client
        .from("negocios")
        .select(
          "*, imovel:imoveis(*, fotos:imovel_fotos(*), captador:perfis!captador_id(id, nome)), perfil:perfis(id, nome)",
        )
        .eq("lead_id", leadId)
        .eq("corretor_id", corretorId)
        .order("data_fechamento", { ascending: false }),
      client
        .from("lead_imoveis_selecionados")
        .select("*, imovel:imoveis(*, fotos:imovel_fotos(*))")
        .eq("lead_id", leadId)
        .eq("corretor_id", corretorId)
        .order("criado_em", { ascending: false }),
      client
        .from("auditoria_atendimento")
        .select("*, perfil:perfis(id, nome)")
        .eq("lead_id", leadId)
        .eq("corretor_id", corretorId)
        .order("criado_em", { ascending: false }),
    ]);

  return {
    lead,
    visitas: (visitasRes.data ?? []) as Visita[],
    propostas: (propostasRes.data ?? []) as Proposta[],
    negocios: (negociosRes.data ?? []) as Negocio[],
    imoveisSelecionados: (selecionadosRes.data ?? []) as LeadImovelSelecionado[],
    auditoria: (auditoriaRes.data ?? []) as AuditoriaAtendimento[],
  };
}

export interface UpdateAtendimentoDadosInput {
  temperatura?: TemperaturaLead;
  etapa?: EtapaLead;
  situacao?: SituacaoLead;
  finalidade_busca?: string | null;
  tipo_imovel_busca?: string;
  bairros_interesse?: string[];
  quartos_minimo?: number | null;
  suites_minimas?: number | null;
  banheiros_minimos?: number | null;
  vagas_minimas?: number | null;
  valor_minimo?: number | null;
  valor_maximo?: number | null;
  prazo_decisao?: string | null;
  imovel_id?: string | null;
  entrada_fgts?: number | null;
  entrada_recursos_proprios?: number | null;
  financiamento_aprovado?: boolean;
  possui_imovel_venda?: boolean;
  interesse_permuta?: boolean;
  info_permuta?: string | null;
  obs_financeiras?: string | null;
  observacoes?: string | null;
}

async function executarUpdateAtendimentoDados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  corretorId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", leadId)
    .eq("corretor_id", corretorId);

  return error;
}

export async function updateAtendimentoDados(
  leadId: string,
  input: UpdateAtendimentoDadosInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const payload: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
  };

  if (input.temperatura !== undefined) payload.temperatura = input.temperatura;
  if (input.situacao !== undefined) payload.situacao = input.situacao;
  if (input.finalidade_busca !== undefined) payload.finalidade_busca = input.finalidade_busca || null;
  if (input.tipo_imovel_busca !== undefined) {
    payload.tipo_imovel_busca = input.tipo_imovel_busca?.trim() || null;
  }
  if (input.bairros_interesse !== undefined) {
    payload.bairros_interesse = input.bairros_interesse.length ? input.bairros_interesse : null;
  }
  if (input.quartos_minimo !== undefined) payload.quartos_minimo = input.quartos_minimo;
  if (input.suites_minimas !== undefined) payload.suites_minimas = input.suites_minimas;
  if (input.banheiros_minimos !== undefined) payload.banheiros_minimos = input.banheiros_minimos;
  if (input.vagas_minimas !== undefined) payload.vagas_minimas = input.vagas_minimas;
  if (input.valor_minimo !== undefined) payload.valor_minimo = input.valor_minimo;
  if (input.valor_maximo !== undefined) payload.valor_maximo = input.valor_maximo;
  if (input.prazo_decisao !== undefined) payload.prazo_decisao = input.prazo_decisao?.trim() || null;
  if (input.imovel_id !== undefined) payload.imovel_id = input.imovel_id;
  if (input.entrada_fgts !== undefined) payload.entrada_fgts = input.entrada_fgts;
  if (input.entrada_recursos_proprios !== undefined) {
    payload.entrada_recursos_proprios = input.entrada_recursos_proprios;
  }
  if (input.financiamento_aprovado !== undefined) {
    payload.financiamento_aprovado = input.financiamento_aprovado;
  }
  if (input.possui_imovel_venda !== undefined) payload.possui_imovel_venda = input.possui_imovel_venda;
  if (input.interesse_permuta !== undefined) payload.interesse_permuta = input.interesse_permuta;
  if (input.info_permuta !== undefined) payload.info_permuta = input.info_permuta?.trim() || null;
  if (input.obs_financeiras !== undefined) payload.obs_financeiras = input.obs_financeiras?.trim() || null;
  if (input.observacoes !== undefined) {
    payload.observacoes =
      input.observacoes == null
        ? null
        : input.observacoes.trim() || null;
  }

  if (input.etapa !== undefined) {
    payload.etapa = input.etapa;
  }

  let updateError = await executarUpdateAtendimentoDados(supabase, leadId, corretor.id, payload);

  if (updateError) {
    const admin = await createTenantDataClient();
    if (admin) {
      const retryError = await executarUpdateAtendimentoDados(admin, leadId, corretor.id, payload);
      if (!retryError) {
        updateError = null;
      }
    }
  }

  if (updateError) {
    console.error("[updateAtendimentoDados]", updateError);
    return { error: updateError.message || "Não foi possível salvar." };
  }

  if (input.imovel_id !== undefined && input.imovel_id) {
    await garantirImovelInteresseSelecionado(
      leadId,
      input.imovel_id,
      corretor.id,
      supabase,
      true,
    );
  }

  await registrarAuditoria(leadId, "dados_atualizados", { campos: Object.keys(input) });
  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Dados salvos." };
}

export async function descartarAtendimento(
  leadId: string,
  motivoId: string,
  observacao: string,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const motivoIdTrim = motivoId.trim();
  if (!isValidUuid(motivoIdTrim)) {
    return { error: "Selecione um motivo válido." };
  }

  const observacaoTrim = observacao.trim();
  if (!observacaoTrim) return { error: "Informe informações adicionais." };

  const supabase = await createClient();

  const { data: leadExistente, error: leadBuscaError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (leadBuscaError || !leadExistente) {
    if (leadBuscaError) {
      console.error(
        "[descartar lead] erro completo:",
        JSON.stringify(leadBuscaError, null, 2),
      );
    }
    return { error: "Atendimento não encontrado." };
  }

  const { data: motivo } = await supabase
    .from("motivos_descarte")
    .select("nome")
    .eq("id", motivoIdTrim)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!motivo) return { error: "Motivo não encontrado." };

  const agora = new Date().toISOString();
  const updateTiers: Record<string, unknown>[] = [
    {
      situacao: "descartado",
      etapa: "perdido",
      motivo_descarte_id: motivoIdTrim,
      motivo_descarte_texto: observacaoTrim,
      atualizado_em: agora,
    },
    {
      situacao: "descartado",
      etapa: "perdido",
      atualizado_em: agora,
    },
    {
      etapa: "perdido",
      atualizado_em: agora,
    },
  ];

  let descartado = false;
  let motivoPersistido = false;

  for (const payload of updateTiers) {
    const { data, error } = await supabase
      .from("leads")
      .update(payload)
      .eq("id", leadId)
      .eq("corretor_id", corretor.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[descartar lead] erro completo:", JSON.stringify(error, null, 2));
      continue;
    }

    if (data) {
      descartado = true;
      motivoPersistido = "motivo_descarte_id" in payload;
      break;
    }
  }

  if (!descartado) {
    return { error: "Não foi possível descartar." };
  }

  const msg = `Atendimento descartado. Motivo: ${motivo.nome}. ${observacaoTrim}`;

  await registrarInteracao(leadId, "anotacao", msg);
  await registrarAuditoria(leadId, "atendimento_descartado", {
    motivo_id: motivoIdTrim,
    motivo: motivo.nome,
    observacao: observacaoTrim,
    motivo_persistido_colunas: motivoPersistido,
  });

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Atendimento descartado." };
}

export async function transferirAtendimento(
  leadId: string,
  novoPerfilId: string,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  const perfilAtual = await getPerfilForUser();
  if (!corretor) return { error: "Sessão expirada." };
  if (!perfilAtual || (perfilAtual.papel !== "admin" && perfilAtual.papel !== "gerente")) {
    return { error: "Sem permissão para transferir." };
  }

  const supabase = await createClient();
  const { data: destino } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("id", novoPerfilId)
    .eq("corretor_id", corretor.id)
    .eq("ativo", true)
    .maybeSingle();

  if (!destino) return { error: "Responsável não encontrado." };

  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("leads")
    .update({
      perfil_id: novoPerfilId,
      data_entrada: agora,
      tempo_primeira_resposta_min: null,
      atualizado_em: agora,
    })
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível transferir." };

  await registrarInteracao(
    leadId,
    "anotacao",
    `Atendimento transferido para ${destino.nome}.`,
  );
  await registrarAuditoria(leadId, "atendimento_transferido", {
    perfil_id: novoPerfilId,
    perfil_nome: destino.nome,
  });

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: `Transferido para ${destino.nome}.` };
}

const BAIRROS_EXCLUIDOS = new Set(["vendido", "desativado", "desativado_temporariamente"]);

function extrairBairrosImoveis(
  rows: Array<{
    bairro?: string | null;
    status?: string | null;
    status_imovel?: { nome?: string | null } | { nome?: string | null }[] | null;
  }>,
): string[] {
  const bairros = new Set<string>();

  for (const row of rows) {
    const bairro = row.bairro?.trim();
    if (!bairro) {
      continue;
    }

    const statusEmbed = Array.isArray(row.status_imovel)
      ? row.status_imovel[0]
      : row.status_imovel;
    const statusNome = statusEmbed?.nome?.trim().toLowerCase() ?? "";
    const statusSlug = row.status?.trim().toLowerCase() ?? "";

    if (
      BAIRROS_EXCLUIDOS.has(statusSlug) ||
      statusNome.includes("vendido") ||
      statusNome.includes("desativado")
    ) {
      continue;
    }

    bairros.add(bairro);
  }

  return Array.from(bairros).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function loadBairrosImoveis(
  client: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
): Promise<string[]> {
  const embedResult = await client
    .from("imoveis")
    .select("bairro, status, status_imovel:status_imovel(nome)")
    .eq("corretor_id", corretorId)
    .not("bairro", "is", null);

  if (!embedResult.error) {
    return extrairBairrosImoveis(embedResult.data ?? []);
  }

  if (isSchemaMismatchError(embedResult.error)) {
    logPostgrestError("getBairrosImoveisCadastrados:retry_without_status_embed", embedResult.error);
    const basicResult = await client
      .from("imoveis")
      .select("bairro, status")
      .eq("corretor_id", corretorId)
      .not("bairro", "is", null);

    if (!basicResult.error) {
      return extrairBairrosImoveis(basicResult.data ?? []);
    }

    logPostgrestError("getBairrosImoveisCadastrados", basicResult.error);
    return [];
  }

  logPostgrestError("getBairrosImoveisCadastrados", embedResult.error);
  return [];
}

export async function getBairrosImoveisCadastrados(): Promise<string[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  const supabase = await createClient();
  const bairros = await loadBairrosImoveis(supabase, corretor.id);
  if (bairros.length > 0) {
    return bairros;
  }

  try {
    const admin = createServiceRoleClient();
    return await loadBairrosImoveis(admin, corretor.id);
  } catch (fallbackError) {
    console.error("[getBairrosImoveisCadastrados] service role unavailable", fallbackError);
    return [];
  }
}

export async function getImoveisRadar(leadId: string): Promise<Imovel[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return [];
  }

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!lead) {
    return [];
  }

  let query = supabase
    .from("imoveis")
    .select("*, fotos:imovel_fotos(*), captador:perfis!captador_id(id, nome), status_imovel:status_imovel(*)")
    .eq("corretor_id", corretor.id)
    .eq("status", "disponivel");

  if (campoTextoPreenchido(lead.finalidade_busca)) {
    if (lead.finalidade_busca === "compra") {
      query = query.eq("finalidade", "venda");
    } else if (lead.finalidade_busca === "locacao") {
      query = query.eq("finalidade", "locacao");
    }
  }

  if (campoTextoPreenchido(lead.tipo_imovel_busca)) {
    const tipos = parseTiposImovelBusca(lead.tipo_imovel_busca);
    if (tipos.length === 1) {
      query = query.eq("tipo", tipos[0]);
    } else if (tipos.length > 1) {
      query = query.in("tipo", tipos);
    }
  }

  if (numeroFiltroAtivo(lead.quartos_minimo)) {
    query = query.gte("quartos", lead.quartos_minimo!);
  }
  if (numeroFiltroAtivo(lead.suites_minimas)) {
    query = query.gte("suites", lead.suites_minimas!);
  }
  if (numeroFiltroAtivo(lead.banheiros_minimos)) {
    query = query.gte("banheiros", lead.banheiros_minimos!);
  }
  if (numeroFiltroAtivo(lead.vagas_minimas)) {
    query = query.gte("vagas", lead.vagas_minimas!);
  }

  const isVenda =
    !campoTextoPreenchido(lead.finalidade_busca) || lead.finalidade_busca === "compra";
  const valorColumn = isVenda ? "valor_venda" : "valor_locacao";

  if (numeroFiltroAtivo(lead.valor_minimo)) {
    query = query.gte(valorColumn, lead.valor_minimo!);
  }
  if (numeroFiltroAtivo(lead.valor_maximo)) {
    query = query.lte(valorColumn, lead.valor_maximo!);
  }

  const { data, error } = await query
    .order("atualizado_em", { ascending: false })
    .limit(IMOVEL_LIST_LIMIT);

  if (error) {
    logPostgrestError("Radar", error);
    return [];
  }

  let imoveis = (data ?? []) as Imovel[];

  if (lead.bairros_interesse?.length) {
    imoveis = imoveis.filter((imovel) => imovelCompativelBairros(imovel, lead.bairros_interesse!));
  }

  return imoveis;
}

async function getAtendimentoConfigForCorretor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
): Promise<{ faixa_valor_percent: number } | null> {
  const { data } = await supabase
    .from("atendimento_config")
    .select("faixa_valor_percent")
    .eq("corretor_id", corretorId)
    .maybeSingle();

  return data as { faixa_valor_percent: number } | null;
}

export async function calcularFaixaValorImovel(
  imovelId: string,
): Promise<{ min: number; max: number } | null> {
  const corretor = await getCorretorForUser();
  if (!corretor) return null;

  const config = await getAtendimentoConfig();
  const percent = config?.faixa_valor_percent ?? 20;

  const supabase = await createClient();
  const { data: imovel } = await supabase
    .from("imoveis")
    .select("valor_venda, valor_locacao, finalidade")
    .eq("id", imovelId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!imovel) return null;

  const valor = resolveValorReferenciaImovel(imovel);
  if (valor == null) return null;

  const delta = Number(valor) * (percent / 100);
  return { min: Math.round(Number(valor) - delta), max: Math.round(Number(valor) + delta) };
}

export async function getAtendimentoConfig(): Promise<AtendimentoConfig | null> {
  const corretor = await getCorretorForUser();
  if (!corretor) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("atendimento_config")
    .select("*")
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (data) return data as AtendimentoConfig;

  const { data: created } = await supabase
    .from("atendimento_config")
    .insert({
      corretor_id: corretor.id,
      faixa_valor_percent: 20,
      ficha_visita_texto: DEFAULT_FICHA_VISITA_TEXTO,
    })
    .select("*")
    .single();

  return (created as AtendimentoConfig) ?? null;
}

export async function saveAtendimentoConfig(input: {
  faixa_valor_percent?: number;
  ficha_visita_texto?: string;
}): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const existing = await getAtendimentoConfig();
  const supabase = await createClient();

  const payload: Record<string, unknown> = {};
  if (input.faixa_valor_percent !== undefined) {
    payload.faixa_valor_percent = input.faixa_valor_percent;
  }
  if (input.ficha_visita_texto !== undefined) {
    payload.ficha_visita_texto = input.ficha_visita_texto;
  }

  if (existing) {
    const { error } = await supabase
      .from("atendimento_config")
      .update(payload)
      .eq("corretor_id", corretor.id);
    if (error) return { error: "Não foi possível salvar." };
  } else {
    const { error } = await supabase.from("atendimento_config").insert({
      corretor_id: corretor.id,
      ...payload,
    });
    if (error) return { error: "Não foi possível salvar." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Configuração salva." };
}

async function seedMotivosDescarte(corretorId: string) {
  const supabase = await createClient();
  const rows = DEFAULT_MOTIVOS_DESCARTE.map((nome, ordem) => ({
    corretor_id: corretorId,
    nome,
    ordem,
    ativo: true,
  }));
  await supabase.from("motivos_descarte").insert(rows);
}

export async function getMotivosDescarte(): Promise<MotivoDescarte[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("motivos_descarte")
    .select("*")
    .eq("corretor_id", corretor.id)
    .order("ordem");

  if (!data?.length) {
    await seedMotivosDescarte(corretor.id);
    const { data: seeded } = await supabase
      .from("motivos_descarte")
      .select("*")
      .eq("corretor_id", corretor.id)
      .order("ordem");
    return (seeded ?? []) as MotivoDescarte[];
  }

  return data as MotivoDescarte[];
}

export async function saveMotivoDescarte(input: {
  id?: string;
  nome: string;
  ativo?: boolean;
  ordem?: number;
}): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const nome = input.nome.trim();
  if (!nome) return { error: "Informe o nome." };

  const supabase = await createClient();

  if (input.id) {
    const { error } = await supabase
      .from("motivos_descarte")
      .update({
        nome,
        ativo: input.ativo ?? true,
        ordem: input.ordem ?? 0,
      })
      .eq("id", input.id)
      .eq("corretor_id", corretor.id);
    if (error) return { error: "Não foi possível salvar." };
  } else {
    const { error } = await supabase.from("motivos_descarte").insert({
      corretor_id: corretor.id,
      nome,
      ativo: input.ativo ?? true,
      ordem: input.ordem ?? 99,
    });
    if (error) return { error: "Não foi possível criar." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Motivo salvo." };
}

export async function deleteMotivoDescarte(id: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("motivos_descarte")
    .delete()
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível excluir." };
  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Motivo excluído." };
}

export async function podeTransferirAtendimento(): Promise<boolean> {
  const perfil = await getPerfilForUser();
  return perfil?.papel === "admin" || perfil?.papel === "gerente";
}

export async function getPerfisForTransferencia(): Promise<{ id: string; nome: string }[]> {
  const perfis = await getPerfisEquipe();
  return perfis
    .filter((p) => p.ativo)
    .map((p) => ({ id: p.id, nome: p.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface UpdateAtendimentoCadastroInput {
  nome: string;
  telefone: string;
  email?: string;
}

export async function updateAtendimentoCadastro(
  leadId: string,
  input: UpdateAtendimentoCadastroInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const nome = input.nome.trim();
  const telefone = input.telefone.trim();

  if (!nome) return { error: "Informe o nome." };
  if (!telefone) return { error: "Informe o telefone." };

  const supabase = await createClient();
  const { data: leadAtual, error: leadError } = await supabase
    .from("leads")
    .select("id, cliente_id, telefone, email")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (leadError || !leadAtual) {
    return { error: "Atendimento não encontrado." };
  }

  const telefoneMudou = !telefonesEquivalentes(telefone, leadAtual.telefone ?? "");
  const emailMudou =
    normalizeEmail(input.email ?? "") !== normalizeEmail(leadAtual.email ?? "");

  if (telefoneMudou || emailMudou) {
    const duplicidadeLead = await verificarDuplicidadeContatoLead(
      telefone,
      input.email,
      leadId,
      leadAtual.cliente_id ?? undefined,
    );
    if (duplicidadeLead.bloqueado) {
      return { error: duplicidadeLead.mensagem ?? "Contato já cadastrado." };
    }

    const duplicidade = await verificarPessoaExistente(
      corretor.id,
      telefone,
      input.email,
      leadAtual.cliente_id ?? undefined,
      leadId,
    );
    if (duplicidade.existe && duplicidade.cliente && duplicidade.motivo) {
      return { error: erroDuplicidadePessoa(duplicidade.motivo, duplicidade.cliente.nome) };
    }
  }

  const agora = new Date().toISOString();
  const emailNormalizado = input.email?.trim() || null;

  const { error } = await supabase
    .from("leads")
    .update({
      nome,
      telefone,
      email: emailNormalizado,
      atualizado_em: agora,
    })
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[updateAtendimentoCadastro]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { error: "Não foi possível salvar o cadastro." };
  }

  if (leadAtual.cliente_id) {
    const { error: clienteError } = await supabase
      .from("clientes")
      .update({
        nome,
        telefone,
        email: emailNormalizado,
        atualizado_em: agora,
      })
      .eq("id", leadAtual.cliente_id)
      .eq("corretor_id", corretor.id);

    if (clienteError) {
      console.error("[updateAtendimentoCadastro] cliente sync failed", clienteError);
    }
  }

  await registrarAuditoria(leadId, "cadastro_atualizado", { nome, telefone });
  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Cadastro atualizado." };
}

export interface CreateVisitaInput {
  imovel_id: string;
  perfil_id?: string;
  data_visita: string;
  status?: StatusVisita;
  observacoes?: string;
  lembrete_email?: boolean;
}

export async function createVisita(
  leadId: string,
  input: CreateVisitaInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (leadError || !lead) return { error: "Atendimento não encontrado." };

  let dataVisitaUtc: string;
  try {
    dataVisitaUtc = parseLocalDateTimeInput(input.data_visita);
  } catch {
    return { error: "Data ou hora inválida." };
  }

  const { data, error } = await supabase
    .from("visitas")
    .insert({
      corretor_id: corretor.id,
      lead_id: leadId,
      imovel_id: input.imovel_id,
      perfil_id: input.perfil_id ?? null,
      data_visita: dataVisitaUtc,
      status: input.status ?? "agendada",
      observacoes: input.observacoes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createVisita]", error);
    return { error: "Não foi possível agendar a visita." };
  }

  await criarAgendaFutura({
    corretorId: corretor.id,
    leadId,
    imovelId: input.imovel_id,
    visitaId: data.id,
    perfilId: input.perfil_id,
    tipo: "visita",
    titulo: "Visita agendada",
    descricao: input.observacoes,
    dataAtividade: input.data_visita,
    lembreteEmail: input.lembrete_email,
    allowPast: true,
  });

  await avancarEtapaLead(leadId, "visita_agendada", supabase, corretor.id, false);
  await registrarInteracao(leadId, "visita", "Visita agendada.");
  await registrarAuditoria(leadId, "visita_agendada", {
    visita_id: data.id,
    imovel_id: input.imovel_id,
  });

  revalidateAtendimentoPaths(leadId);
  return { success: true, id: data.id, message: "Visita agendada." };
}

export interface UpdateVisitaInput {
  status?: StatusVisita;
  parecer?: string;
  vai_gerar_proposta?: string;
  observacoes?: string;
  data_visita?: string;
}

export async function updateVisita(
  visitaId: string,
  input: UpdateVisitaInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: visita, error: buscaError } = await supabase
    .from("visitas")
    .select("id, lead_id, status")
    .eq("id", visitaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError) {
    console.error("[Visita] erro ao buscar visita", buscaError);
    return { error: "Visita não encontrada." };
  }

  if (!visita) {
    return { error: "Visita não encontrada." };
  }

  const payload: Record<string, unknown> = {};
  if (input.status) payload.status = input.status;
  if (input.parecer !== undefined) payload.parecer = input.parecer || null;
  if (input.vai_gerar_proposta !== undefined) {
    payload.vai_gerar_proposta = input.vai_gerar_proposta || null;
  }
  if (input.observacoes !== undefined) {
    payload.observacoes = input.observacoes?.trim() || null;
  }
  if (input.data_visita) {
    try {
      payload.data_visita = parseLocalDateTimeInput(input.data_visita);
    } catch {
      return { error: "Data ou hora inválida." };
    }
  }

  if (Object.keys(payload).length === 0) {
    return { error: "Nenhum dado para atualizar." };
  }

  const logContext = input.parecer !== undefined ? "registrarParecer" : "updateVisita";

  const { data: updated, error } = await supabase
    .from("visitas")
    .update(payload)
    .eq("id", visitaId)
    .eq("corretor_id", corretor.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[${logContext}]`, {
      visitaId,
      payload,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { error: "Não foi possível atualizar a visita." };
  }

  if (!updated) {
    console.error(`[${logContext}]`, {
      visitaId,
      payload,
      message: "Nenhuma linha atualizada (visita não encontrada ou sem permissão).",
    });
    return { error: "Visita não encontrada ou sem permissão para atualizar." };
  }

  const leadId = visita.lead_id as string;

  if (input.status === "realizada") {
    await avancarEtapaLead(leadId, "visita_agendada", supabase, corretor.id, false);
    await registrarInteracao(leadId, "visita", "Visita realizada.");
    await registrarAuditoria(leadId, "visita_realizada", { visita_id: visitaId });
  } else if (input.status === "cancelada") {
    await registrarInteracao(leadId, "visita", "Visita cancelada.");
    await registrarAuditoria(leadId, "visita_cancelada", { visita_id: visitaId });
  } else {
    await registrarAuditoria(leadId, "visita_atualizada", { visita_id: visitaId, ...payload });
  }

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Visita atualizada." };
}

export async function editarVisita(
  visitaId: string,
  data: string,
  hora: string,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  if (!data.trim() || !hora.trim()) {
    return { error: "Informe data e hora." };
  }

  let novaData: string;
  try {
    novaData = localDateTimeToUTC(data, hora);
  } catch {
    return { error: "Data ou hora inválida." };
  }

  const supabase = await createClient();
  const { data: visita, error: buscaError } = await supabase
    .from("visitas")
    .select("id, lead_id, imovel_id, perfil_id, observacoes, imovel:imoveis(codigo)")
    .eq("id", visitaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError || !visita) return { error: "Visita não encontrada." };
  const leadId = visita.lead_id as string;
  const imovelCodigo =
    (visita.imovel as { codigo?: string | null } | null)?.codigo ?? "????";

  const { error } = await supabase
    .from("visitas")
    .update({ data_visita: novaData })
    .eq("id", visitaId);

  if (error) return { error: "Não foi possível reagendar a visita." };

  const { data: agendaAtualizada } = await supabase
    .from("agenda")
    .update({ data_atividade: novaData })
    .eq("visita_id", visitaId)
    .eq("corretor_id", corretor.id)
    .select("id");

  if (!agendaAtualizada?.length) {
    await criarAgendaFutura({
      corretorId: corretor.id,
      leadId,
      imovelId: visita.imovel_id as string,
      visitaId,
      perfilId: visita.perfil_id as string | null | undefined,
      tipo: "visita",
      titulo: "Visita agendada",
      descricao: (visita.observacoes as string | null) ?? undefined,
      dataAtividade: novaData,
      allowPast: true,
    });
  }

  const dataHoraFmt = formatDateTimeBrasilia(novaData);
  const [dataFmt, horaFmt] = dataHoraFmt.split(", ");
  const horaExibicao = horaFmt?.replace(":", "h") ?? horaFmt;

  await registrarInteracao(
    leadId,
    "visita",
    `Visita no imóvel #${imovelCodigo} reagendada para ${dataFmt} às ${horaExibicao}`,
  );
  await registrarAuditoria(leadId, "visita_reagendada", {
    visita_id: visitaId,
    data_visita: novaData,
  });

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Visita reagendada." };
}

export async function deleteVisita(visitaId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: visita } = await supabase
    .from("visitas")
    .select("lead_id")
    .eq("id", visitaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!visita) return { error: "Visita não encontrada." };

  const { error: agendaError } = await supabase
    .from("agenda")
    .delete()
    .eq("visita_id", visitaId)
    .eq("corretor_id", corretor.id);

  if (agendaError) {
    console.error("[deleteVisita]", {
      visitaId,
      step: "agenda",
      message: agendaError.message,
      code: agendaError.code,
      details: agendaError.details,
      hint: agendaError.hint,
    });
    return { error: "Não foi possível excluir a visita (agenda vinculada)." };
  }

  const { error } = await supabase
    .from("visitas")
    .delete()
    .eq("id", visitaId)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[deleteVisita]", {
      visitaId,
      step: "visita",
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { error: "Não foi possível excluir." };
  }

  await registrarInteracao(visita.lead_id as string, "visita", "Visita excluída.");
  revalidateAtendimentoPaths(visita.lead_id as string);
  return { success: true, message: "Visita excluída." };
}

export async function cancelarVisitasEmLote(
  visitaIds: string[],
): Promise<AtendimentoActionResult> {
  if (!visitaIds.length) return { error: "Nenhuma visita selecionada." };

  let canceladas = 0;
  for (const id of visitaIds) {
    const result = await updateVisita(id, { status: "cancelada" });
    if (!result.error) canceladas += 1;
  }

  if (canceladas === 0) {
    return { error: "Não foi possível cancelar as visitas selecionadas." };
  }

  return {
    success: true,
    message:
      canceladas === visitaIds.length
        ? `${canceladas} visita(s) cancelada(s).`
        : `${canceladas} de ${visitaIds.length} visita(s) cancelada(s).`,
  };
}

export async function excluirVisitasEmLote(
  visitaIds: string[],
): Promise<AtendimentoActionResult> {
  if (!visitaIds.length) return { error: "Nenhuma visita selecionada." };

  let excluidas = 0;
  for (const id of visitaIds) {
    const result = await deleteVisita(id);
    if (!result.error) excluidas += 1;
  }

  if (excluidas === 0) {
    return { error: "Não foi possível excluir as visitas selecionadas." };
  }

  return {
    success: true,
    message:
      excluidas === visitaIds.length
        ? `${excluidas} visita(s) excluída(s).`
        : `${excluidas} de ${visitaIds.length} visita(s) excluída(s).`,
  };
}

export async function gerarFichaVisitaHtml(
  leadId: string,
  visitaIds: string[],
): Promise<AtendimentoActionResult & { html?: string }> {
  const { generateFichaVisita } = await import("@/lib/actions/ficha-visita");
  return generateFichaVisita(leadId, visitaIds);
}

export interface CreatePropostaInput {
  imovel_id: string;
  visita_id?: string;
  perfil_id?: string;
  valor_proposto: number;
  data_proposta: string;
  status?: StatusProposta;
  observacoes?: string;
}

export async function createProposta(
  leadId: string,
  input: CreatePropostaInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const status = input.status ?? "em_analise";

  if (input.visita_id) {
    const { data: visita, error: visitaError } = await supabase
      .from("visitas")
      .select("id, lead_id, parecer")
      .eq("id", input.visita_id)
      .eq("corretor_id", corretor.id)
      .maybeSingle();

    if (visitaError || !visita || visita.lead_id !== leadId) {
      return { error: "Visita não encontrada." };
    }

    if (!visita.parecer) {
      return { error: MSG_PROPOSTA_SEM_PARECER };
    }
  }

  const { data, error } = await supabase
    .from("propostas")
    .insert({
      corretor_id: corretor.id,
      lead_id: leadId,
      imovel_id: input.imovel_id,
      perfil_id: input.perfil_id ?? null,
      valor_proposto: input.valor_proposto,
      data_proposta: input.data_proposta,
      status,
      observacoes: input.observacoes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createProposta]", error);
    return { error: "Não foi possível registrar a proposta." };
  }

  if (status !== "cancelada") {
    await avancarEtapaLead(leadId, "proposta", supabase, corretor.id, false);
  }
  if (status === "recusada") {
    await avancarEtapaLead(leadId, "perdido", supabase, corretor.id, false);
  }

  await registrarInteracao(
    leadId,
    "proposta",
    `Proposta registrada: R$ ${input.valor_proposto.toLocaleString("pt-BR")}.`,
  );
  await registrarAuditoria(leadId, "proposta_registrada", {
    proposta_id: data.id,
    status,
    valor: input.valor_proposto,
  });

  if (input.imovel_id && status !== "cancelada" && status !== "recusada") {
    await atualizarStatusImovelAutomatico(
      input.imovel_id,
      "Reservado",
      "Proposta registrada no atendimento",
      { proposta_id: data.id, lead_id: leadId },
    );
  }

  revalidateAtendimentoPaths(leadId);
  return { success: true, id: data.id, message: "Proposta registrada." };
}

export interface UpdatePropostaInput {
  valor_proposto: number;
  observacoes: string;
}

export async function updateProposta(
  propostaId: string,
  input: UpdatePropostaInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const observacoes = input.observacoes.trim();
  if (!observacoes) {
    return { error: "Informe os detalhes da proposta." };
  }
  if (!Number.isFinite(input.valor_proposto) || input.valor_proposto <= 0) {
    return { error: "Informe um valor válido para a proposta." };
  }

  const supabase = await createClient();
  const { data: proposta, error: buscaError } = await supabase
    .from("propostas")
    .select("id, lead_id, status")
    .eq("id", propostaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError || !proposta) return { error: "Proposta não encontrada." };
  if (proposta.status === "cancelada") {
    return { error: "Não é possível editar uma proposta cancelada." };
  }

  const { error } = await supabase
    .from("propostas")
    .update({
      valor_proposto: input.valor_proposto,
      observacoes,
    })
    .eq("id", propostaId);

  if (error) return { error: "Não foi possível atualizar a proposta." };

  const leadId = proposta.lead_id as string;
  await registrarInteracao(
    leadId,
    "proposta",
    `Proposta atualizada: R$ ${input.valor_proposto.toLocaleString("pt-BR")}.`,
  );
  await registrarAuditoria(leadId, "proposta_atualizada", {
    proposta_id: propostaId,
    valor: input.valor_proposto,
  });

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Proposta atualizada." };
}

export async function updatePropostaStatus(
  propostaId: string,
  status: StatusProposta,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: proposta, error: buscaError } = await supabase
    .from("propostas")
    .select("id, lead_id")
    .eq("id", propostaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError || !proposta) return { error: "Proposta não encontrada." };

  const { error } = await supabase.from("propostas").update({ status }).eq("id", propostaId);

  if (error) return { error: "Não foi possível atualizar a proposta." };

  const leadId = proposta.lead_id as string;

  if (status === "recusada") {
    await avancarEtapaLead(leadId, "perdido", supabase, corretor.id, false);
  } else if (status !== "cancelada") {
    await avancarEtapaLead(leadId, "proposta", supabase, corretor.id, false);
  }

  await registrarInteracao(leadId, "proposta", `Status da proposta: ${status}.`);
  await registrarAuditoria(
    leadId,
    status === "cancelada" ? "proposta_cancelada" : "proposta_status_alterado",
    { proposta_id: propostaId, status },
  );

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Status da proposta atualizado." };
}

export async function deleteProposta(propostaId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: proposta } = await supabase
    .from("propostas")
    .select("lead_id, status")
    .eq("id", propostaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!proposta) return { error: "Proposta não encontrada." };

  const { error } = await supabase.from("propostas").delete().eq("id", propostaId);
  if (error) return { error: "Não foi possível excluir." };

  await registrarInteracao(proposta.lead_id as string, "proposta", "Proposta excluída.");
  revalidateAtendimentoPaths(proposta.lead_id as string);
  return { success: true, message: "Proposta excluída." };
}

export type { CreateNegocioInput } from "@/lib/negocios/types";

function validarFinanciamentoNegocio(input: CreateNegocioInput): string | null {
  if (input.forma_pagamento !== "financiado") return null;

  const total =
    (input.valor_recursos_proprios ?? 0) +
    (input.valor_financiado ?? 0) +
    (input.valor_fgts ?? 0);
  const esperado = Math.round(input.valor_fechamento * 100) / 100;
  const soma = Math.round(total * 100) / 100;

  if (soma !== esperado) {
    return "A soma dos valores de financiamento deve ser igual ao valor do negócio.";
  }

  return null;
}

export async function createNegocio(
  leadId: string,
  input: CreateNegocioInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  if (!Number.isFinite(input.valor_fechamento) || input.valor_fechamento <= 0) {
    return { error: "Informe um valor válido para o negócio." };
  }

  const erroFinanciamento = validarFinanciamentoNegocio(input);
  if (erroFinanciamento) return { error: erroFinanciamento };

  const supabase = await createClient();

  if (input.proposta_id) {
    const { data: proposta, error: propostaError } = await supabase
      .from("propostas")
      .select("id, lead_id, status")
      .eq("id", input.proposta_id)
      .eq("corretor_id", corretor.id)
      .maybeSingle();

    if (propostaError || !proposta || proposta.lead_id !== leadId) {
      return { error: "Proposta não encontrada." };
    }

    if (proposta.status !== "aceita") {
      return { error: MSG_NEGOCIO_PROPOSTA_NAO_ACEITA };
    }
  }

  const camposCompletos = await negociosTemCamposCompletos(supabase);
  const row = buildNegocioRow(
    input,
    { corretor_id: corretor.id, lead_id: leadId, status: "fechado" },
    camposCompletos,
  );

  if (!camposCompletos) {
    console.warn(
      "[createNegocio] Migration 20260718200000_negocios_completo pendente — rateio/financiamento salvos em observações.",
    );
  }

  const { data, error } = await supabase
    .from("negocios")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) {
    logSupabaseError("createNegocio", error);
    return { error: "Não foi possível registrar o negócio." };
  }

  await supabase
    .from("leads")
    .update({
      etapa: "venda",
      situacao: "negocio_fechado",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId);

  await registrarInteracao(leadId, "anotacao", "Negócio fechado.");
  await registrarAuditoria(leadId, "negocio_fechado", {
    negocio_id: data.id,
    valor: input.valor_fechamento,
  });

  if (input.imovel_id) {
    const { data: imovel } = await supabase
      .from("imoveis")
      .select("finalidade")
      .eq("id", input.imovel_id)
      .maybeSingle();

    const statusNome = imovel?.finalidade === "locacao" ? "Locado" : "Vendido";
    await atualizarStatusImovelAutomatico(
      input.imovel_id,
      statusNome,
      "Negócio fechado no atendimento",
      { negocio_id: data.id, lead_id: leadId },
    );
  }

  revalidateAtendimentoPaths(leadId);
  revalidatePath("/dashboard/imoveis");
  return { success: true, id: data.id, message: "Negócio fechado registrado." };
}

export async function updateNegocio(
  negocioId: string,
  input: CreateNegocioInput,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  if (!Number.isFinite(input.valor_fechamento) || input.valor_fechamento <= 0) {
    return { error: "Informe um valor válido para o negócio." };
  }

  const erroFinanciamento = validarFinanciamentoNegocio(input);
  if (erroFinanciamento) return { error: erroFinanciamento };

  const supabase = await createClient();
  const { data: negocio, error: buscaError } = await supabase
    .from("negocios")
    .select("id, lead_id, status")
    .eq("id", negocioId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError || !negocio) return { error: "Negociação não encontrada." };
  if (negocio.status === "cancelado") {
    return { error: "Não é possível editar uma negociação cancelada." };
  }

  const camposCompletos = await negociosTemCamposCompletos(supabase);
  const row = buildNegocioRow(input, {}, camposCompletos);

  if (!camposCompletos) {
    console.warn(
      "[updateNegocio] Migration 20260718200000_negocios_completo pendente — rateio/financiamento salvos em observações.",
    );
  }

  const { error } = await supabase.from("negocios").update(row).eq("id", negocioId);

  if (error) {
    logSupabaseError("updateNegocio", error);
    return { error: "Não foi possível atualizar a negociação." };
  }

  const leadId = negocio.lead_id as string;
  await registrarInteracao(leadId, "anotacao", "Negociação atualizada.");
  await registrarAuditoria(leadId, "negocio_atualizado", {
    negocio_id: negocioId,
    valor: input.valor_fechamento,
  });

  revalidateAtendimentoPaths(leadId);
  revalidatePath("/dashboard/imoveis");
  return { success: true, message: "Negociação atualizada." };
}

export async function cancelarNegocio(negocioId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: negocio, error: buscaError } = await supabase
    .from("negocios")
    .select("id, lead_id, imovel_id, status")
    .eq("id", negocioId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError || !negocio) return { error: "Negociação não encontrada." };
  if (negocio.status === "cancelado") {
    return { error: "Esta negociação já está cancelada." };
  }

  const { error } = await supabase
    .from("negocios")
    .update({ status: "cancelado" })
    .eq("id", negocioId);

  if (error) return { error: "Não foi possível cancelar a negociação." };

  const leadId = negocio.lead_id as string;

  await supabase
    .from("leads")
    .update({
      situacao: "em_atendimento",
      etapa: "proposta",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (negocio.imovel_id) {
    await atualizarStatusImovelAutomatico(
      negocio.imovel_id as string,
      "Disponível",
      "Negociação cancelada no atendimento",
      { negocio_id: negocioId, lead_id: leadId },
    );
  }

  await registrarInteracao(leadId, "anotacao", "Negociação cancelada.");
  await registrarAuditoria(leadId, "negocio_cancelado", { negocio_id: negocioId });

  revalidateAtendimentoPaths(leadId);
  revalidatePath("/dashboard/imoveis");
  return { success: true, message: "Negociação cancelada." };
}

export async function deleteNegocio(negocioId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: negocio } = await supabase
    .from("negocios")
    .select("lead_id, imovel_id, status")
    .eq("id", negocioId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!negocio) return { error: "Negociação não encontrada." };

  const { error } = await supabase.from("negocios").delete().eq("id", negocioId);
  if (error) return { error: "Não foi possível excluir a negociação." };

  const leadId = negocio.lead_id as string;

  if (negocio.status === "fechado") {
    await supabase
      .from("leads")
      .update({
        situacao: "em_atendimento",
        etapa: "proposta",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", leadId)
      .eq("corretor_id", corretor.id);

    if (negocio.imovel_id) {
      await atualizarStatusImovelAutomatico(
        negocio.imovel_id as string,
        "Disponível",
        "Negociação excluída no atendimento",
        { negocio_id: negocioId, lead_id: leadId },
      );
    }
  }

  await registrarInteracao(leadId, "anotacao", "Negociação excluída.");
  await registrarAuditoria(leadId, "negocio_excluido", { negocio_id: negocioId });

  revalidateAtendimentoPaths(leadId);
  revalidatePath("/dashboard/imoveis");
  return { success: true, message: "Negociação excluída." };
}

export async function marcarNegocioPerdido(leadId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();

  const { data: propostasAtivas } = await supabase
    .from("propostas")
    .select("imovel_id")
    .eq("lead_id", leadId)
    .eq("corretor_id", corretor.id)
    .not("status", "in", '("cancelada","recusada")');

  await supabase
    .from("leads")
    .update({ etapa: "perdido", atualizado_em: new Date().toISOString() })
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  const imovelIds = new Set(
    (propostasAtivas ?? []).map((p) => p.imovel_id).filter(Boolean) as string[],
  );

  for (const imovelId of imovelIds) {
    await atualizarStatusImovelAutomatico(
      imovelId,
      "Disponível",
      "Negócio perdido no atendimento",
      { lead_id: leadId },
    );
  }

  await registrarInteracao(leadId, "anotacao", "Negócio perdido.");
  await registrarAuditoria(leadId, "negocio_perdido", {});
  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Marcado como negócio perdido." };
}

export async function selecionarImovel(
  leadId: string,
  imovelId: string,
  etiqueta?: string,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();

  const { data: existente, error: existenteError } = await supabase
    .from("lead_imoveis_selecionados")
    .select("id, token_compartilhamento")
    .eq("lead_id", leadId)
    .eq("imovel_id", imovelId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (existenteError) {
    console.error("[selecionarImovel]", {
      message: existenteError.message,
      code: existenteError.code,
      details: existenteError.details,
      hint: existenteError.hint,
    });
    return { error: "Não foi possível selecionar o imóvel." };
  }

  if (existente) {
    revalidateAtendimentoPaths(leadId);
    return {
      success: true,
      token: existente.token_compartilhamento as string,
      message: "Imóvel já estava selecionado.",
    };
  }

  const token = randomUUID();

  const { data, error } = await supabase
    .from("lead_imoveis_selecionados")
    .insert({
      lead_id: leadId,
      imovel_id: imovelId,
      corretor_id: corretor.id,
      token_compartilhamento: token,
    })
    .select("token_compartilhamento")
    .single();

  if (error) {
    console.error("[selecionarImovel]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    if (error.code === "23505") {
      const { data: conflito } = await supabase
        .from("lead_imoveis_selecionados")
        .select("token_compartilhamento")
        .eq("lead_id", leadId)
        .eq("imovel_id", imovelId)
        .eq("corretor_id", corretor.id)
        .maybeSingle();

      if (conflito) {
        revalidateAtendimentoPaths(leadId);
        return {
          success: true,
          token: conflito.token_compartilhamento as string,
          message: "Imóvel já estava selecionado.",
        };
      }
    }

    return { error: "Não foi possível selecionar o imóvel." };
  }

  if (!data) {
    return { error: "Não foi possível selecionar o imóvel." };
  }

  await avancarEtapaLead(leadId, "qualificado", supabase, corretor.id, false);
  await registrarInteracao(
    leadId,
    "anotacao",
    etiqueta ? `Imóvel selecionado (${etiqueta}).` : "Imóvel selecionado no radar.",
  );
  await registrarAuditoria(leadId, "imovel_selecionado", { imovel_id: imovelId });

  revalidateAtendimentoPaths(leadId);
  return {
    success: true,
    token: data.token_compartilhamento as string,
    message: "Imóvel adicionado à seleção.",
  };
}

export async function removerImovelSelecionado(
  leadId: string,
  imovelId: string,
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("lead_imoveis_selecionados")
    .delete()
    .eq("lead_id", leadId)
    .eq("imovel_id", imovelId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível remover o imóvel." };

  await registrarInteracao(leadId, "anotacao", "Imóvel removido da seleção.");
  await registrarAuditoria(leadId, "imovel_removido_selecao", { imovel_id: imovelId });
  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Imóvel removido da seleção." };
}

export async function qualificarLead(leadId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("observacoes, etapa")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!lead) return { error: "Atendimento não encontrado." };

  const observacoes = mergeLeadObservacoesMeta(lead.observacoes as string | null, {
    qualificado: true,
  });

  const payload: Record<string, unknown> = {
    observacoes,
    atualizado_em: new Date().toISOString(),
  };

  if (lead.etapa === "novo") {
    payload.etapa = "contato_feito";
  }

  const { error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[qualificarLead]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { error: "Não foi possível qualificar." };
  }

  await registrarInteracao(leadId, "anotacao", "Lead qualificado.");
  await registrarAuditoria(leadId, "lead_qualificado", {});

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Lead qualificado." };
}

export async function desqualificarLead(leadId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("observacoes, etapa")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!lead) return { error: "Atendimento não encontrado." };

  const observacoes = mergeLeadObservacoesMeta(lead.observacoes as string | null, {
    qualificado: false,
  });

  const payload: Record<string, unknown> = {
    observacoes,
    atualizado_em: new Date().toISOString(),
  };

  if (lead.etapa === "qualificado") {
    payload.etapa = "contato_feito";
  }

  const { error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[desqualificarLead]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { error: "Não foi possível remover a qualificação." };
  }

  await registrarInteracao(leadId, "anotacao", "Qualificação removida.");
  await registrarAuditoria(leadId, "lead_desqualificado", {});

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Qualificação removida." };
}

export async function marcarContatoFeito(leadId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  await avancarEtapaLead(leadId, "contato_feito", supabase, corretor.id, false);
  await registrarInteracao(leadId, "ligacao", "Contato realizado.");
  await registrarAuditoria(leadId, "contato_feito", {});

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Contato registrado." };
}

export async function desmarcarContatoFeito(leadId: string): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("etapa")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!lead) return { error: "Atendimento não encontrado." };
  if (lead.etapa !== "contato_feito") {
    return { error: "Não é possível desfazer o contato nesta etapa." };
  }

  const { error } = await supabase
    .from("leads")
    .update({
      etapa: "novo",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[desmarcarContatoFeito]", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return { error: "Não foi possível desfazer o contato." };
  }

  await registrarInteracao(leadId, "anotacao", "Contato desmarcado.");
  await registrarAuditoria(leadId, "contato_desmarcado", {});

  revalidateAtendimentoPaths(leadId);
  return { success: true, message: "Contato desmarcado." };
}

export async function getImoveisIndicados(lead: Lead) {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  const { meta } = parseLeadObservacoes(lead.observacoes);
  const ids = new Set<string>();
  if (lead.imovel_id) ids.add(lead.imovel_id);
  for (const id of meta.imoveis_indicados ?? []) ids.add(id);

  if (ids.size === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("imoveis")
    .select("*, fotos:imovel_fotos(*)")
    .eq("corretor_id", corretor.id)
    .in("id", Array.from(ids));

  return data ?? [];
}

export async function indicarImovelComAuditoria(
  leadId: string,
  imovelId: string,
): Promise<AtendimentoActionResult> {
  const { linkImovel } = await import("@/lib/actions/leads");
  const result = await linkImovel(leadId, imovelId);
  if (result.success) {
    await registrarInteracao(leadId, "anotacao", "Imóvel de interesse vinculado.");
    await registrarAuditoria(leadId, "imovel_indicado", { imovel_id: imovelId });
    revalidateAtendimentoPaths(leadId);
  }
  return result;
}

export async function addInteracaoFutura(
  leadId: string,
  input: { tipo: string; descricao: string; data: string; titulo?: string },
): Promise<AtendimentoActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const dataAtividade = parseLocalDateTimeInput(input.data);
  if (new Date(dataAtividade) > new Date()) {
    await criarAgendaFutura({
      corretorId: corretor.id,
      leadId,
      tipo: input.tipo,
      titulo: input.titulo ?? input.tipo,
      descricao: input.descricao,
      dataAtividade,
    });
    await registrarAuditoria(leadId, "agenda_criada", { tipo: input.tipo });
    revalidateAtendimentoPaths(leadId);
    return { success: true, message: "Atividade agendada." };
  }

  const { addInteracao } = await import("@/lib/actions/leads");
  return addInteracao(leadId, {
    tipo: input.tipo as TipoInteracao,
    descricao: input.descricao,
    data: dataAtividade,
  });
}

export async function getLeadResponsavelNome(lead: Lead, perfis: { id: string; nome: string }[]) {
  const perfilId = await getLeadPerfilId(lead);
  return perfis.find((p) => p.id === perfilId)?.nome ?? lead.perfil?.nome ?? null;
}
