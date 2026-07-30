"use server";

import { revalidatePath } from "next/cache";

import { contemNormalizado } from "@/lib/utils/normalizar";
import { parseLocalDateTimeInput } from "@/lib/dates/format";

import { ETAPAS_LEAD, ETAPAS_LEAD_LEGACY, isEtapaLead } from "@/lib/constants/leads";
import { leadMatchesEtapaFilter } from "@/lib/leads/etapa-order";
import { isLeadAtivo } from "@/lib/leads/format";
import { podeAvancarEtapa } from "@/lib/leads/etapa-order";
import { calcularTempoPrimeiraRespostaIfNeeded } from "@/lib/leads/primeira-resposta";
import {
  mergeLeadObservacoesMeta,
  parseLeadObservacoes,
  serializeLeadObservacoes,
  type PerfilFinanceiroLead,
} from "@/lib/leads/observacoes";
import {
  getMidiasOrigem as getMidiasOrigemConfig,
} from "@/lib/actions/configuracoes";
import {
  verificarDuplicidadeContatoLead,
  verificarPessoaExistente,
} from "@/lib/actions/clientes";
import { erroDuplicidadePessoa } from "@/lib/pessoas/messages";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import {
  createTenantDataClient,
  fetchWithTenantFallback,
  leadVisivelParaUsuario,
  resolveTenantAccess,
  type TenantDbClient,
} from "@/lib/supabase/tenant-access";
import {
  isSchemaMismatchError,
  logPostgrestError,
} from "@/lib/supabase/postgrest-error";
import { createClient } from "@/lib/supabase/server";
import {
  clampListLimit,
  clampListOffset,
} from "@/lib/constants/listings";
import type {
  EtapaLead,
  Lead,
  LeadInteracao,
  MidiaOrigem,
  Perfil,
  TemperaturaLead,
  TipoInteracao,
} from "@/types";

export type LeadActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
  leadId?: string;
};

export interface LeadsFilterParams {
  temperatura?: TemperaturaLead;
  etapa?: EtapaLead;
  origem?: string;
  finalidade_busca?: string;
  perfil_id?: string;
  sem_interacao_dias?: number;
  finalidade?: "compra" | "locacao";
  ativos_apenas?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateLeadInput {
  nome: string;
  telefone: string;
  email?: string;
  finalidade_busca?: string;
  tipo_imovel_busca?: string;
  bairros_interesse?: string[];
  quartos_minimo?: number;
  valor_minimo?: number;
  valor_maximo?: number;
  prazo_decisao?: string;
  midia_nome?: string;
  observacoes?: string;
  perfil_id?: string;
}

export interface UpdateLeadInput {
  nome?: string;
  telefone?: string;
  email?: string;
  finalidade_busca?: string;
  tipo_imovel_busca?: string;
  bairros_interesse?: string[];
  quartos_minimo?: number | null;
  valor_minimo?: number | null;
  valor_maximo?: number | null;
  prazo_decisao?: string | null;
  etapa?: EtapaLead;
  temperatura?: TemperaturaLead;
  observacoes?: string;
  perfil_id?: string | null;
  perfil_financeiro?: PerfilFinanceiroLead;
  qualificado?: boolean;
}

export interface PropostaInput {
  imovel_id: string;
  valor: number;
  status: string;
  observacoes?: string;
}

export interface InteracaoInput {
  tipo: TipoInteracao;
  descricao: string;
  data?: string;
  contarPrimeiraResposta?: boolean;
}

function sanitizeTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

function mapMidiaToOrigem(midiaNome?: string): string {
  if (!midiaNome?.trim()) {
    return "manual";
  }

  const normalized = midiaNome.trim().toLowerCase();

  if (normalized.includes("whatsapp")) {
    return "whatsapp";
  }

  if (normalized.includes("site")) {
    return "site";
  }

  if (normalized.includes("indica")) {
    return "indicacao";
  }

  return midiaNome.trim();
}

function applyClientSideFilters(leads: Lead[], filters?: LeadsFilterParams): Lead[] {
  if (!filters) {
    return leads;
  }

  return leads.filter((lead) => {
    if (filters.ativos_apenas !== false && !isLeadAtivo(lead)) {
      return false;
    }

    if (filters.temperatura && lead.temperatura !== filters.temperatura) {
      return false;
    }

    if (filters.etapa && !leadMatchesEtapaFilter(lead, filters.etapa)) {
      return false;
    }

    if (filters.finalidade_busca && lead.finalidade_busca !== filters.finalidade_busca) {
      return false;
    }

    if (filters.finalidade && lead.finalidade_busca !== filters.finalidade) {
      return false;
    }

    if (filters.origem) {
      const origemMatch =
        lead.origem === filters.origem ||
        lead.origem.toLowerCase() === filters.origem.toLowerCase();
      if (!origemMatch) {
        return false;
      }
    }

    if (filters.perfil_id) {
      const leadPerfilId = lead.perfil_id ?? parseLeadObservacoes(lead.observacoes).meta.perfil_id;
      if (leadPerfilId !== filters.perfil_id) {
        return false;
      }
    }

    if (filters.sem_interacao_dias !== undefined && filters.sem_interacao_dias > 0) {
      const ultima =
        lead.ultima_mensagem_em ?? lead.atualizado_em ?? lead.criado_em;
      const limite = new Date();
      limite.setDate(limite.getDate() - filters.sem_interacao_dias);
      if (new Date(ultima) > limite) {
        return false;
      }
    }

    return true;
  });
}

export async function getMidiasOrigem(): Promise<MidiaOrigem[]> {
  return getMidiasOrigemConfig();
}

const LEADS_LIST_SELECT_TIERS = [
  "*, imovel:imoveis!leads_imovel_id_fkey(*), perfil:perfis!perfil_id(id, nome)",
  "*, imovel:imoveis!leads_imovel_id_fkey(*)",
  "*",
] as const;

function applyLeadsQueryFilters<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  filters?: LeadsFilterParams,
): T {
  let next = query;

  if (filters?.temperatura) {
    next = next.eq("temperatura", filters.temperatura);
  }

  if (filters?.etapa) {
    next = next.eq("etapa", filters.etapa);
  }

  if (filters?.finalidade_busca) {
    next = next.eq("finalidade_busca", filters.finalidade_busca);
  }

  if (filters?.finalidade) {
    next = next.eq("finalidade_busca", filters.finalidade);
  }

  return next;
}

async function enrichLeadsWithPerfis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  leads: Lead[],
): Promise<Lead[]> {
  const perfilIds = new Set<string>();

  for (const lead of leads) {
    if (lead.perfil) {
      continue;
    }

    const perfilId = lead.perfil_id ?? parseLeadObservacoes(lead.observacoes).meta.perfil_id;
    if (perfilId) {
      perfilIds.add(perfilId);
    }
  }

  if (perfilIds.size === 0) {
    return leads;
  }

  const { data: perfis, error } = await supabase
    .from("perfis")
    .select("id, nome")
    .eq("corretor_id", corretorId)
    .in("id", Array.from(perfilIds));

  if (error) {
    logPostgrestError("getLeads.enrichPerfis", error);
    return leads;
  }

  const perfilById = new Map(
    (perfis ?? []).map((perfil) => [perfil.id, perfil as Pick<Perfil, "id" | "nome">]),
  );

  return leads.map((lead) => {
    if (lead.perfil) {
      return lead;
    }

    const perfilId = lead.perfil_id ?? parseLeadObservacoes(lead.observacoes).meta.perfil_id;
    const perfil = perfilId ? perfilById.get(perfilId) : undefined;

    return perfil ? { ...lead, perfil: perfil as Perfil } : lead;
  });
}

async function fetchLeadsRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  filters?: LeadsFilterParams,
): Promise<Lead[]> {
  const limit = clampListLimit(filters?.limit);
  const offset = clampListOffset(filters?.offset);

  for (let tier = 0; tier < LEADS_LIST_SELECT_TIERS.length; tier += 1) {
    const { data, error } = await applyLeadsQueryFilters(
      supabase
        .from("leads")
        .select(LEADS_LIST_SELECT_TIERS[tier] as "*")
        .eq("corretor_id", corretorId)
        .order("criado_em", { ascending: false })
        .range(offset, offset + limit - 1),
      filters,
    );

    if (!error) {
      const leads = (data ?? []) as Lead[];
      const usedPerfilEmbed = tier === 0;
      return usedPerfilEmbed ? leads : enrichLeadsWithPerfis(supabase, corretorId, leads);
    }

    const hasFallback = tier < LEADS_LIST_SELECT_TIERS.length - 1;
    if (hasFallback && isSchemaMismatchError(error)) {
      logPostgrestError(`getLeads.tier${tier}`, error);
      continue;
    }

    logPostgrestError("getLeads", error);
    return [];
  }

  return [];
}

export async function getLeads(filters?: LeadsFilterParams): Promise<Lead[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const access = await resolveTenantAccess(corretor);
  const leads = await fetchWithTenantFallback(
    corretor.id,
    (client) => fetchLeadsRows(client, corretor.id, filters),
    (rows) => rows.length === 0,
  );

  const leadsVisiveis = access.verTodos
    ? leads
    : leads.filter((lead) => leadVisivelParaUsuario(lead, access));

  return applyClientSideFilters(leadsVisiveis, filters);
}

const LEAD_DETAIL_SELECT_TIERS = [
  "*, imovel:imoveis!leads_imovel_id_fkey(*), interacoes:lead_interacoes(*)",
  "*, imovel:imoveis!leads_imovel_id_fkey(*)",
  "*",
] as const;

async function fetchLeadByIdRow(
  supabase: TenantDbClient,
  corretorId: string,
  id: string,
): Promise<Lead | null> {
  for (let tier = 0; tier < LEAD_DETAIL_SELECT_TIERS.length; tier += 1) {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_DETAIL_SELECT_TIERS[tier] as "*")
      .eq("id", id)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (!error && data) {
      const [lead] = await enrichLeadsWithPerfis(supabase, corretorId, [data as Lead]);
      const result = lead ?? (data as Lead);

      if (result.interacoes) {
        result.interacoes.sort(
          (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
        );
      }

      return result;
    }

    const hasFallback = tier < LEAD_DETAIL_SELECT_TIERS.length - 1;
    if (hasFallback && error && isSchemaMismatchError(error)) {
      logPostgrestError(`fetchLeadByIdRow.tier${tier}`, error);
      continue;
    }

    if (error) {
      logPostgrestError("fetchLeadByIdRow", error);
    }

    break;
  }

  return null;
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  const access = await resolveTenantAccess(corretor);
  const supabase = await createClient();
  let lead = await fetchLeadByIdRow(supabase, corretor.id, id);

  if (!lead) {
    const admin = await createTenantDataClient();
    if (admin) {
      lead = await fetchLeadByIdRow(admin, corretor.id, id);
      if (lead) {
        console.warn("[getLeadById] authenticated query returned empty; used service role fallback", {
          corretorId: corretor.id,
          leadId: id,
        });
      }
    }
  }

  if (!lead) {
    return null;
  }

  if (!access.verTodos && !leadVisivelParaUsuario(lead, access)) {
    return null;
  }

  return lead;
}

export async function createLead(input: CreateLeadInput): Promise<LeadActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const nome = input.nome.trim();
  const telefone = input.telefone.trim();

  if (!nome) {
    return { error: "Informe o nome do lead." };
  }

  if (!telefone) {
    return { error: "Informe o telefone do lead." };
  }

  const supabase = await createClient();

  const duplicidadeLead = await verificarDuplicidadeContatoLead(telefone, input.email);
  if (duplicidadeLead.bloqueado) {
    return { error: duplicidadeLead.mensagem ?? "Essa pessoa já está cadastrada." };
  }

  const duplicidade = await verificarPessoaExistente(corretor.id, telefone, input.email);
  if (duplicidade.existe && duplicidade.cliente && duplicidade.motivo) {
    return { error: erroDuplicidadePessoa(duplicidade.motivo, duplicidade.cliente.nome) };
  }

  const observacoes = input.perfil_id
    ? mergeLeadObservacoesMeta(input.observacoes ?? null, {
        perfil_id: input.perfil_id,
      })
    : input.observacoes?.trim() || null;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      corretor_id: corretor.id,
      nome,
      telefone,
      email: input.email?.trim() || null,
      finalidade_busca: input.finalidade_busca || null,
      tipo_imovel_busca: input.tipo_imovel_busca?.trim() || null,
      bairros_interesse: input.bairros_interesse?.length
        ? input.bairros_interesse
        : null,
      quartos_minimo: input.quartos_minimo ?? null,
      valor_minimo: input.valor_minimo ?? null,
      valor_maximo: input.valor_maximo ?? null,
      prazo_decisao: input.prazo_decisao?.trim() || null,
      origem: mapMidiaToOrigem(input.midia_nome),
      etapa: "novo",
      temperatura: "indefinido",
      atendido_por: "corretor",
      observacoes,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createLead] failed", error);
    return { error: "Não foi possível criar o lead." };
  }

  revalidatePath("/dashboard/atendimentos");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
  return { success: true, leadId: data.id, message: "Lead criado com sucesso." };
}

export async function updateLead(
  leadId: string,
  input: UpdateLeadInput,
): Promise<LeadActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  if (
    input.etapa &&
    (!isEtapaLead(input.etapa) ||
      (!ETAPAS_LEAD.includes(input.etapa) && !ETAPAS_LEAD_LEGACY.includes(input.etapa)))
  ) {
    return { error: "Etapa inválida." };
  }

  const supabase = await createClient();
  const { data: existente, error: buscaError } = await supabase
    .from("leads")
    .select("observacoes")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError || !existente) {
    return { error: "Lead não encontrado." };
  }

  if (input.telefone !== undefined || input.email !== undefined) {
    const telefoneCheck = input.telefone ?? undefined;
    const emailCheck = input.email ?? undefined;

    const duplicidadeLead = await verificarDuplicidadeContatoLead(
      telefoneCheck,
      emailCheck,
      leadId,
    );
    if (duplicidadeLead.bloqueado) {
      return { error: duplicidadeLead.mensagem ?? "Contato já cadastrado." };
    }

    const duplicidade = await verificarPessoaExistente(
      corretor.id,
      telefoneCheck,
      emailCheck,
    );
    if (duplicidade.existe && duplicidade.cliente && duplicidade.motivo) {
      return { error: erroDuplicidadePessoa(duplicidade.motivo, duplicidade.cliente.nome) };
    }
  }

  const updatePayload: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
  };

  if (input.nome !== undefined) updatePayload.nome = input.nome.trim();
  if (input.telefone !== undefined) updatePayload.telefone = input.telefone.trim();
  if (input.email !== undefined) updatePayload.email = input.email.trim() || null;
  if (input.finalidade_busca !== undefined) {
    updatePayload.finalidade_busca = input.finalidade_busca || null;
  }
  if (input.tipo_imovel_busca !== undefined) {
    updatePayload.tipo_imovel_busca = input.tipo_imovel_busca.trim() || null;
  }
  if (input.bairros_interesse !== undefined) {
    updatePayload.bairros_interesse = input.bairros_interesse.length
      ? input.bairros_interesse
      : null;
  }
  if (input.quartos_minimo !== undefined) updatePayload.quartos_minimo = input.quartos_minimo;
  if (input.valor_minimo !== undefined) updatePayload.valor_minimo = input.valor_minimo;
  if (input.valor_maximo !== undefined) updatePayload.valor_maximo = input.valor_maximo;
  if (input.prazo_decisao !== undefined) {
    updatePayload.prazo_decisao = input.prazo_decisao?.trim() || null;
  }
  if (input.etapa !== undefined) {
    const { data: etapaAtualRow } = await supabase
      .from("leads")
      .select("etapa")
      .eq("id", leadId)
      .eq("corretor_id", corretor.id)
      .maybeSingle();

    const etapaAtual = (etapaAtualRow?.etapa ?? "novo") as EtapaLead;
    if (!podeAvancarEtapa(etapaAtual, input.etapa)) {
      return { error: "Não é possível retroceder a etapa do atendimento." };
    }
    updatePayload.etapa = input.etapa;
  }
  if (input.temperatura !== undefined) updatePayload.temperatura = input.temperatura;

  if (input.qualificado !== undefined) {
    updatePayload.etapa = input.qualificado ? "qualificado" : "contato_feito";
  }

  let observacoesAtual = existente.observacoes as string | null;

  if (
    input.perfil_id !== undefined ||
    input.perfil_financeiro !== undefined ||
    input.observacoes !== undefined
  ) {
    const { meta, texto } = parseLeadObservacoes(observacoesAtual);

    if (input.perfil_id !== undefined) {
      meta.perfil_id = input.perfil_id;
    }

    if (input.perfil_financeiro !== undefined) {
      meta.perfil_financeiro = input.perfil_financeiro;
    }

    const novoTexto =
      input.observacoes !== undefined ? input.observacoes : texto;

    observacoesAtual = serializeLeadObservacoes(meta, novoTexto);
    updatePayload.observacoes = observacoesAtual;
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", leadId)
    .eq("corretor_id", corretor.id);

  if (updateError) {
    console.error("[updateLead] failed", updateError);
    return { error: "Não foi possível atualizar o lead." };
  }

  revalidatePath("/dashboard/atendimentos");
  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/atendimentos/${leadId}`);
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { success: true, message: "Lead atualizado." };
}

export async function updateLeadEtapa(
  leadId: string,
  etapa: EtapaLead,
): Promise<LeadActionResult> {
  return updateLead(leadId, { etapa });
}

export async function addInteracao(
  leadId: string,
  input: InteracaoInput,
): Promise<LeadActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const descricao = input.descricao.trim();
  if (!descricao) {
    return { error: "Informe a descrição da interação." };
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (leadError || !lead) {
    return { error: "Lead não encontrado." };
  }

  const criadoEm = input.data?.trim()
    ? parseLocalDateTimeInput(input.data)
    : new Date().toISOString();

  const { error } = await supabase.from("lead_interacoes").insert({
    lead_id: leadId,
    corretor_id: corretor.id,
    tipo: input.tipo,
    conteudo: descricao,
    de: "corretor",
    criado_em: criadoEm,
  });

  if (error) {
    console.error("[addInteracao] failed", error);
    return { error: "Não foi possível registrar a interação." };
  }

  await supabase
    .from("leads")
    .update({
      ultima_mensagem_em: criadoEm,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (input.contarPrimeiraResposta !== false) {
    await calcularTempoPrimeiraRespostaIfNeeded(leadId, criadoEm, supabase);
  }

  revalidatePath(`/dashboard/atendimentos/${leadId}`);
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/atendimentos");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
  return { success: true, message: "Interação registrada." };
}

export async function registerProposta(
  leadId: string,
  input: PropostaInput,
): Promise<LeadActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (leadError || !lead) {
    return { error: "Lead não encontrado." };
  }

  const conteudo = JSON.stringify({
    imovel_id: input.imovel_id,
    valor: input.valor,
    status: input.status,
    observacoes: input.observacoes?.trim() || null,
  });

  const agora = new Date().toISOString();

  const { error } = await supabase.from("lead_interacoes").insert({
    lead_id: leadId,
    corretor_id: corretor.id,
    tipo: "proposta",
    conteudo,
    de: "corretor",
    criado_em: agora,
  });

  if (error) {
    console.error("[registerProposta] failed", error);
    return { error: "Não foi possível registrar a proposta." };
  }

  await supabase
    .from("leads")
    .update({
      etapa: "proposta",
      ultima_mensagem_em: agora,
      atualizado_em: agora,
    })
    .eq("id", leadId);

  revalidatePath(`/dashboard/atendimentos/${leadId}`);
  revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/atendimentos");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
  return { success: true, message: "Proposta registrada." };
}

export async function linkImovel(
  leadId: string,
  imovelId: string,
): Promise<LeadActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();

  const { data: imovel, error: imovelError } = await supabase
    .from("imoveis")
    .select("id")
    .eq("id", imovelId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (imovelError || !imovel) {
    return { error: "Imóvel não encontrado." };
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("observacoes, imovel_id")
    .eq("id", leadId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (leadError || !lead) {
    return { error: "Lead não encontrado." };
  }

  const { meta } = parseLeadObservacoes(lead.observacoes as string | null);
  const indicados = new Set(meta.imoveis_indicados ?? []);

  if (lead.imovel_id) {
    indicados.add(lead.imovel_id);
  }

  indicados.add(imovelId);

  const observacoes = mergeLeadObservacoesMeta(lead.observacoes as string | null, {
    imoveis_indicados: Array.from(indicados),
  });

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      imovel_id: imovelId,
      observacoes,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (updateError) {
    console.error("[linkImovel] failed", updateError);
    return { error: "Não foi possível vincular o imóvel." };
  }

  revalidatePath(`/dashboard/atendimentos/${leadId}`);
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { success: true, message: "Imóvel indicado." };
}

const IMOVEIS_STATUS_EXCLUIDOS_BUSCA = '("vendido","locado")';
const IMOVEIS_DESATIVADOS_BUSCA = new Set(["desativado", "desativado_temporariamente"]);
const IMOVEL_BUSCA_MAX_DESATIVADOS = 3;

const IMOVEL_SEARCH_RELATIONS =
  ", cliente:clientes(nome), proprietarios:imovel_proprietarios(cliente:clientes(nome))";

const IMOVEL_SEARCH_SELECT =
  `id, titulo, codigo, bairro, logradouro, cidade, finalidade, status, tipo, valor_venda, valor_locacao, quartos, suites, banheiros, vagas, fotos:imovel_fotos(id, url, ordem)${IMOVEL_SEARCH_RELATIONS}`;

const IMOVEL_SEARCH_SELECT_NO_FOTOS =
  `id, titulo, codigo, bairro, logradouro, cidade, finalidade, status, tipo, valor_venda, valor_locacao, quartos, suites, banheiros, vagas${IMOVEL_SEARCH_RELATIONS}`;

type ImovelSearchRow = {
  id: string;
  titulo: string | null;
  codigo: string | null;
  bairro: string | null;
  logradouro: string | null;
  cidade: string | null;
  finalidade: string | null;
  status: string | null;
  tipo: string | null;
  valor_venda: number | null;
  valor_locacao: number | null;
  quartos: number | null;
  suites: number | null;
  banheiros: number | null;
  vagas: number | null;
  fotos?: { id: string; url: string; ordem: number }[];
  cliente?: { nome: string | null } | null;
  proprietarios?: { cliente?: { nome: string | null } | null }[];
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,()]/g, "\\$&");
}

function buildImovelSearchOrFilter(trimmed: string): string {
  const pattern = escapeIlikePattern(trimmed);

  return [
    `titulo.ilike.%${pattern}%`,
    `codigo.ilike.%${pattern}%`,
    `bairro.ilike.%${pattern}%`,
    `logradouro.ilike.%${pattern}%`,
    `cidade.ilike.%${pattern}%`,
  ].join(",");
}

function imovelMatchesSearchQuery(imovel: ImovelSearchRow, trimmed: string): boolean {
  const nomesProprietarios: string[] = [];

  if (imovel.cliente?.nome) {
    nomesProprietarios.push(imovel.cliente.nome);
  }

  for (const proprietario of imovel.proprietarios ?? []) {
    if (proprietario.cliente?.nome) {
      nomesProprietarios.push(proprietario.cliente.nome);
    }
  }

  const campos = [
    imovel.titulo,
    imovel.codigo,
    imovel.bairro,
    imovel.logradouro,
    imovel.cidade,
    ...nomesProprietarios,
  ];

  return campos.some((campo) => contemNormalizado(campo, trimmed));
}

function imovelEstaDesativado(imovel: ImovelSearchRow): boolean {
  return IMOVEIS_DESATIVADOS_BUSCA.has(imovel.status ?? "");
}

function limitImovelSearchResults(
  rows: ImovelSearchRow[],
  limit = 10,
  maxDesativados = IMOVEL_BUSCA_MAX_DESATIVADOS,
): ImovelSearchRow[] {
  const ativos = rows.filter((row) => !imovelEstaDesativado(row));
  const desativados = rows.filter((row) => imovelEstaDesativado(row));
  const picked: ImovelSearchRow[] = [];

  for (const row of ativos) {
    if (picked.length >= limit) {
      break;
    }
    picked.push(row);
  }

  let desativadosAdicionados = 0;

  for (const row of desativados) {
    if (picked.length >= limit || desativadosAdicionados >= maxDesativados) {
      break;
    }

    picked.push(row);
    desativadosAdicionados += 1;
  }

  return picked;
}

function mergeImovelSearchRows(...groups: ImovelSearchRow[][]): ImovelSearchRow[] {
  const byId = new Map<string, ImovelSearchRow>();

  for (const group of groups) {
    for (const imovel of group) {
      byId.set(imovel.id, imovel);
    }
  }

  return Array.from(byId.values());
}

async function fetchImoveisByIds(
  supabase: TenantDbClient,
  corretorId: string,
  ids: string[],
  withFotos: boolean,
): Promise<ImovelSearchRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const select = withFotos ? IMOVEL_SEARCH_SELECT : IMOVEL_SEARCH_SELECT_NO_FOTOS;

  const { data, error } = await supabase
    .from("imoveis")
    .select(select as "*")
    .eq("corretor_id", corretorId)
    .not("status", "in", IMOVEIS_STATUS_EXCLUIDOS_BUSCA)
    .in("id", ids.slice(0, 50))
    .order("atualizado_em", { ascending: false });

  if (error) {
    console.error("[fetchImoveisByIds] failed", { withFotos, error });

    if (withFotos) {
      return fetchImoveisByIds(supabase, corretorId, ids, false);
    }

    return [];
  }

  return (data ?? []) as ImovelSearchRow[];
}

async function fetchImoveisSearchRowsWithFilter(
  supabase: TenantDbClient,
  corretorId: string,
  trimmed: string,
  withFotos: boolean,
): Promise<ImovelSearchRow[]> {
  const select = withFotos ? IMOVEL_SEARCH_SELECT : IMOVEL_SEARCH_SELECT_NO_FOTOS;

  const { data, error } = await supabase
    .from("imoveis")
    .select(select as "*")
    .eq("corretor_id", corretorId)
    .not("status", "in", IMOVEIS_STATUS_EXCLUIDOS_BUSCA)
    .or(buildImovelSearchOrFilter(trimmed))
    .order("atualizado_em", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[fetchImoveisSearchRowsWithFilter] failed", { withFotos, error });

    if (withFotos) {
      return fetchImoveisSearchRowsWithFilter(supabase, corretorId, trimmed, false);
    }

    return [];
  }

  return (data ?? []) as ImovelSearchRow[];
}

async function fetchImoveisSearchRowsForScan(
  supabase: TenantDbClient,
  corretorId: string,
  withFotos: boolean,
): Promise<ImovelSearchRow[]> {
  const select = withFotos ? IMOVEL_SEARCH_SELECT : IMOVEL_SEARCH_SELECT_NO_FOTOS;

  const { data, error } = await supabase
    .from("imoveis")
    .select(select as "*")
    .eq("corretor_id", corretorId)
    .not("status", "in", IMOVEIS_STATUS_EXCLUIDOS_BUSCA)
    .order("atualizado_em", { ascending: false })
    .limit(400);

  if (error) {
    console.error("[fetchImoveisSearchRowsForScan] failed", { withFotos, error });

    if (withFotos) {
      return fetchImoveisSearchRowsForScan(supabase, corretorId, false);
    }

    return [];
  }

  return (data ?? []) as ImovelSearchRow[];
}

async function fetchClienteIdsByProprietarioNome(
  supabase: TenantDbClient,
  corretorId: string,
  trimmed: string,
): Promise<string[]> {
  const pattern = `%${escapeIlikePattern(trimmed)}%`;

  const { data: clientesIlike, error } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("corretor_id", corretorId)
    .ilike("nome", pattern)
    .limit(30);

  if (error) {
    console.error("[fetchClienteIdsByProprietarioNome] failed", error);
    return [];
  }

  let matching = (clientesIlike ?? []).filter((cliente) =>
    contemNormalizado(cliente.nome, trimmed),
  );

  if (matching.length === 0) {
    const { data: clientesScan, error: scanError } = await supabase
      .from("clientes")
      .select("id, nome")
      .eq("corretor_id", corretorId)
      .order("nome", { ascending: true })
      .limit(400);

    if (scanError) {
      console.error("[fetchClienteIdsByProprietarioNome] scan failed", scanError);
      return [];
    }

    matching = (clientesScan ?? []).filter((cliente) =>
      contemNormalizado(cliente.nome, trimmed),
    );
  }

  return matching.map((cliente) => cliente.id);
}

async function fetchImovelIdsByProprietarioNome(
  supabase: TenantDbClient,
  corretorId: string,
  trimmed: string,
): Promise<string[]> {
  const clienteIds = await fetchClienteIdsByProprietarioNome(supabase, corretorId, trimmed);

  if (clienteIds.length === 0) {
    return [];
  }

  const imovelIds = new Set<string>();

  const [{ data: directImoveis }, { data: proprietarioLinks }] = await Promise.all([
    supabase
      .from("imoveis")
      .select("id")
      .eq("corretor_id", corretorId)
      .in("cliente_id", clienteIds)
      .limit(50),
    supabase
      .from("imovel_proprietarios")
      .select("imovel_id")
      .in("cliente_id", clienteIds)
      .limit(50),
  ]);

  for (const row of directImoveis ?? []) {
    imovelIds.add(row.id);
  }

  const linkedIds = (proprietarioLinks ?? []).map((row) => row.imovel_id);

  if (linkedIds.length > 0) {
    const { data: linkedImoveis } = await supabase
      .from("imoveis")
      .select("id")
      .eq("corretor_id", corretorId)
      .in("id", linkedIds);

    for (const row of linkedImoveis ?? []) {
      imovelIds.add(row.id);
    }
  }

  return Array.from(imovelIds);
}

async function searchImoveisForLeadRows(
  corretorId: string,
  trimmed: string,
): Promise<ImovelSearchRow[]> {
  const runSearch = async (client: TenantDbClient) => {
    const [textFiltered, imovelIdsPorProprietario] = await Promise.all([
      fetchImoveisSearchRowsWithFilter(client, corretorId, trimmed, true),
      fetchImovelIdsByProprietarioNome(client, corretorId, trimmed),
    ]);

    const byProprietario =
      imovelIdsPorProprietario.length > 0
        ? await fetchImoveisByIds(client, corretorId, imovelIdsPorProprietario, true)
        : [];

    const directMatches = mergeImovelSearchRows(textFiltered, byProprietario).filter((imovel) =>
      imovelMatchesSearchQuery(imovel, trimmed),
    );

    if (directMatches.length > 0) {
      return directMatches;
    }

    const scanned = await fetchImoveisSearchRowsForScan(client, corretorId, true);
    return scanned.filter((imovel) => imovelMatchesSearchQuery(imovel, trimmed));
  };

  return fetchWithTenantFallback(
    corretorId,
    runSearch,
    (rows) => rows.length === 0,
  );
}

export async function searchImoveisForLead(query: string) {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const rows = await searchImoveisForLeadRows(corretor.id, trimmed);
  return limitImovelSearchResults(rows, 10);
}

export async function getPerfisForLeads() {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const { getPerfisEquipe } = await import("@/lib/actions/configuracoes");
  const perfis = await getPerfisEquipe();

  return perfis
    .filter((p) => p.ativo)
    .map((p) => ({ id: p.id, nome: p.nome, ativo: p.ativo }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
