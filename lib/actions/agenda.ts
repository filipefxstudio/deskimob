"use server";

import { revalidatePath } from "next/cache";

import {
  registrarAuditoria,
  registrarInteracao,
  updateVisita,
} from "@/lib/actions/atendimentos";
import { getTipoCompromisso } from "@/lib/constants/agenda";
import { formatDateTimeBrasilia, parseLocalDateTimeInput } from "@/lib/dates/format";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import {
  fetchWithTenantFallback,
  registroVisivelPorPerfil,
  resolveTenantAccess,
  type TenantDbClient,
} from "@/lib/supabase/tenant-access";
import { createClient } from "@/lib/supabase/server";
import type { Agenda, StatusAgenda, TipoAgenda, TipoInteracao } from "@/types";

export type AgendaActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
  id?: string;
};

export interface AgendaFilterParams {
  inicio?: string;
  fim?: string;
  status?: StatusAgenda;
}

async function fetchAgendaItemsRows(
  supabase: TenantDbClient,
  corretorId: string,
  filters?: AgendaFilterParams,
): Promise<Agenda[]> {
  let query = supabase
    .from("agenda")
    .select("*, lead:leads(id, nome), imovel:imoveis(id, titulo, codigo)")
    .eq("corretor_id", corretorId)
    .order("data_atividade", { ascending: true });

  if (filters?.inicio) {
    query = query.gte("data_atividade", filters.inicio);
  }
  if (filters?.fim) {
    query = query.lte("data_atividade", filters.fim);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[fetchAgendaItemsRows]", error);
    return [];
  }

  return (data ?? []) as Agenda[];
}

function filterAgendaItems(items: Agenda[], access: Awaited<ReturnType<typeof resolveTenantAccess>>): Agenda[] {
  if (access.verTodos) {
    return items;
  }

  return items.filter((item) => registroVisivelPorPerfil(item.perfil_id, access));
}

export async function getAgendaItems(filters?: AgendaFilterParams): Promise<Agenda[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  const access = await resolveTenantAccess(corretor);
  const items = await fetchWithTenantFallback(
    corretor.id,
    (client) => fetchAgendaItemsRows(client, corretor.id, filters),
    (rows) => rows.length === 0,
  );

  return filterAgendaItems(items, access);
}

export async function getAgendaHoje(): Promise<Agenda[]> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  return getAgendaItems({
    inicio: hoje.toISOString(),
    fim: amanha.toISOString(),
    status: "pendente",
  });
}

async function fetchVisitasProximas24hRows(
  supabase: TenantDbClient,
  corretorId: string,
  agora: Date,
  limite: Date,
) {
  const { data, error } = await supabase
    .from("visitas")
    .select("*, lead:leads(id, nome), imovel:imoveis(id, titulo, codigo)")
    .eq("corretor_id", corretorId)
    .eq("status", "agendada")
    .gte("data_visita", agora.toISOString())
    .lte("data_visita", limite.toISOString())
    .order("data_visita", { ascending: true });

  if (error) {
    console.error("[fetchVisitasProximas24hRows]", error);
    return [];
  }

  return data ?? [];
}

export async function getVisitasProximas24h() {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  const agora = new Date();
  const limite = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

  return fetchWithTenantFallback(
    corretor.id,
    (client) => fetchVisitasProximas24hRows(client, corretor.id, agora, limite),
    (rows) => rows.length === 0,
  );
}

export interface CreateAgendaInput {
  tipo: TipoAgenda;
  titulo: string;
  descricao?: string;
  data_atividade: string;
  lead_id?: string;
  imovel_id?: string;
  perfil_id?: string;
  lembrete_email?: boolean;
}

export async function createAgendaItem(
  input: CreateAgendaInput,
): Promise<AgendaActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const titulo = input.titulo.trim();
  if (!titulo) return { error: "Informe o título da atividade." };

  let dataAtividadeUtc: string;
  try {
    dataAtividadeUtc = parseLocalDateTimeInput(input.data_atividade);
  } catch {
    return { error: "Data ou hora inválida." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda")
    .insert({
      corretor_id: corretor.id,
      tipo: input.tipo,
      titulo,
      descricao: input.descricao?.trim() || null,
      data_atividade: dataAtividadeUtc,
      lead_id: input.lead_id ?? null,
      imovel_id: input.imovel_id ?? null,
      perfil_id: input.perfil_id ?? null,
      lembrete_email: input.lembrete_email ?? false,
      status: "pendente",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createAgendaItem]", error);
    return { error: "Não foi possível criar a atividade." };
  }

  if (input.lead_id) {
    await registrarInteracao(
      input.lead_id,
      interacaoTipoFromAgenda(input.tipo),
      formatAgendamentoInteracaoTexto(input.tipo, dataAtividadeUtc),
      { origem: "sistema" },
    );
    await registrarAuditoria(input.lead_id, "agenda_criada", {
      agenda_id: data.id,
      tipo: input.tipo,
    });
    revalidatePath(`/dashboard/atendimentos/${input.lead_id}`);
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  return { success: true, id: data.id, message: "Atividade criada." };
}

export async function searchLeadsForAgenda(query: string) {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, telefone, codigo_atendimento")
    .eq("corretor_id", corretor.id)
    .or(
      `nome.ilike.%${trimmed}%,codigo_atendimento.ilike.%${trimmed}%,telefone.ilike.%${trimmed}%`,
    )
    .order("nome", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[searchLeadsForAgenda]", error);
    return [];
  }

  return data ?? [];
}

export async function updateAgendaStatus(
  agendaId: string,
  status: StatusAgenda,
): Promise<AgendaActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .update({ status })
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível atualizar a atividade." };

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  return { success: true, message: "Atividade atualizada." };
}

export async function deleteAgendaItem(agendaId: string): Promise<AgendaActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda")
    .delete()
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível excluir a atividade." };

  revalidatePath("/dashboard/agenda");
  return { success: true, message: "Atividade excluída." };
}

export async function getAgendaLembretesPendentes() {
  const agora = new Date();
  const limite = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agenda")
    .select("*, lead:leads(nome, email), corretor:corretores(nome, email)")
    .eq("status", "pendente")
    .eq("lembrete_email", true)
    .eq("lembrete_enviado", false)
    .gte("data_atividade", agora.toISOString())
    .lte("data_atividade", limite.toISOString());

  if (error) {
    console.error("[getAgendaLembretesPendentes]", error);
    return [];
  }

  return data ?? [];
}

export async function marcarLembreteEnviado(agendaId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("agenda")
    .update({ lembrete_enviado: true })
    .eq("id", agendaId);
}

function formatAgendamentoInteracaoTexto(tipo: TipoAgenda, dataAtividadeUtc: string): string {
  const tipoInfo = getTipoCompromisso(tipo);
  const dataFmt = formatDateTimeBrasilia(dataAtividadeUtc).replace(", ", " às ");
  return `Atividade agendada: ${tipoInfo.nome} em ${dataFmt}`;
}

function interacaoTipoFromAgenda(tipo: TipoAgenda): TipoInteracao {
  switch (tipo) {
    case "ligacao":
      return "ligacao";
    case "whatsapp":
    case "lembrete":
      return "mensagem_whatsapp";
    case "email":
    case "tarefa":
      return "email";
    case "visita":
      return "visita";
    default:
      return "anotacao";
  }
}

export interface MarcarAgendaRealizadoInput {
  observacoes?: string;
  parecer?: string;
  vai_gerar_proposta?: string;
}

export async function marcarAgendaRealizado(
  agendaId: string,
  input?: MarcarAgendaRealizadoInput,
): Promise<AgendaActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: item, error: fetchError } = await supabase
    .from("agenda")
    .select("id, lead_id, visita_id, tipo, titulo, status")
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !item) return { error: "Atividade não encontrada." };
  if (item.status === "concluida") return { error: "Atividade já concluída." };

  const { error } = await supabase
    .from("agenda")
    .update({ status: "concluida" })
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível marcar como realizado." };

  const tipo = item.tipo as TipoAgenda;
  const leadId = item.lead_id as string | null;
  const observacoes = input?.observacoes?.trim();

  if (tipo === "visita" && item.visita_id) {
    const visitaResult = await updateVisita(item.visita_id as string, {
      status: "realizada",
      parecer: input?.parecer,
      vai_gerar_proposta: input?.vai_gerar_proposta,
      observacoes,
    });
    if (visitaResult.error) return visitaResult;
  } else if (leadId) {
    const descricao =
      observacoes ||
      `Atividade "${item.titulo}" marcada como realizada.`;
    await registrarInteracao(leadId, interacaoTipoFromAgenda(tipo), descricao);
    await registrarAuditoria(leadId, "agenda_realizada", {
      agenda_id: agendaId,
      tipo,
    });
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/dashboard/atendimentos/${leadId}`);
  return { success: true, message: "Atividade marcada como realizada." };
}

export async function cancelarAgendaItem(
  agendaId: string,
  motivo?: string,
): Promise<AgendaActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: item, error: fetchError } = await supabase
    .from("agenda")
    .select("id, lead_id, visita_id, tipo, titulo, status")
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !item) return { error: "Atividade não encontrada." };
  if (item.status === "cancelada") return { error: "Atividade já cancelada." };

  const { error } = await supabase
    .from("agenda")
    .update({ status: "cancelada" })
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível cancelar a atividade." };

  const leadId = item.lead_id as string | null;
  const motivoTexto = motivo?.trim();

  if (item.visita_id) {
    await updateVisita(item.visita_id as string, { status: "cancelada", observacoes: motivoTexto });
  }

  if (leadId) {
    const descricao = motivoTexto
      ? `Atividade "${item.titulo}" cancelada: ${motivoTexto}`
      : `Atividade "${item.titulo}" cancelada.`;
    await registrarInteracao(leadId, "anotacao", descricao);
    await registrarAuditoria(leadId, "agenda_cancelada", { agenda_id: agendaId });
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/dashboard/atendimentos/${leadId}`);
  return { success: true, message: "Atividade cancelada." };
}

export interface EditarAgendaInput {
  titulo?: string;
  descricao?: string;
  data_atividade?: string;
  tipo?: TipoAgenda;
}

export async function editarAgendaItem(
  agendaId: string,
  input: EditarAgendaInput,
): Promise<AgendaActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { data: item, error: fetchError } = await supabase
    .from("agenda")
    .select("id, lead_id, visita_id, titulo")
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !item) return { error: "Atividade não encontrada." };

  const payload: Record<string, unknown> = {};
  if (input.titulo !== undefined) {
    const titulo = input.titulo.trim();
    if (!titulo) return { error: "Informe o título." };
    payload.titulo = titulo;
  }
  if (input.descricao !== undefined) payload.descricao = input.descricao.trim() || null;
  if (input.tipo !== undefined) payload.tipo = input.tipo;
  if (input.data_atividade) {
    try {
      payload.data_atividade = parseLocalDateTimeInput(input.data_atividade);
    } catch {
      return { error: "Data ou hora inválida." };
    }
  }

  if (Object.keys(payload).length === 0) {
    return { error: "Nenhuma alteração informada." };
  }

  const { error } = await supabase
    .from("agenda")
    .update(payload)
    .eq("id", agendaId)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível editar a atividade." };

  if (item.visita_id && input.data_atividade) {
    await supabase
      .from("visitas")
      .update({ data_visita: payload.data_atividade as string })
      .eq("id", item.visita_id)
      .eq("corretor_id", corretor.id);
  }

  const leadId = item.lead_id as string | null;
  if (leadId) {
    await registrarInteracao(
      leadId,
      "anotacao",
      `Atividade "${item.titulo}" editada.`,
    );
    await registrarAuditoria(leadId, "agenda_editada", { agenda_id: agendaId, ...payload });
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard");
  if (leadId) revalidatePath(`/dashboard/atendimentos/${leadId}`);
  return { success: true, message: "Atividade atualizada." };
}

export async function getTiposCompromisso() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipos_compromisso")
    .select("nome, icone, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error || !data?.length) return null;
  return data;
}
