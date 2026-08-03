"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseLeadObservacoes } from "@/lib/leads/observacoes";
import {
  emailValidoParaBusca,
  findClientePorTelefoneOuEmail,
  findClientesAutocomplete,
  MIN_TELEFONE_BUSCA_AUTOCOMPLETE,
  normalizeEmail,
  sanitizeTelefone,
  telefonesEquivalentes,
} from "@/lib/pessoas/duplicate";
import {
  mensagemLeadAtivoMesmoCorretor,
  mensagemLeadAtivoOutroCorretor,
  mensagemProprietarioIndisponivel,
  mensagemAtendimentoEmAndamento,
  erroDuplicidadePessoa,
} from "@/lib/pessoas/messages";
import type {
  LeadAtivoInfo,
  PessoaAutocompleteItem,
  SelecaoPessoaAtendimentoResult,
  SelecaoPessoaProprietarioResult,
  VerificacaoPessoaExistente,
} from "@/lib/pessoas/types";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logPostgrestError } from "@/lib/supabase/postgrest-error";
import {
  createTenantDataClient,
  registroVisivelPorPerfil,
  resolveTenantAccess,
  type TenantDbClient,
} from "@/lib/supabase/tenant-access";
import { createClient } from "@/lib/supabase/server";
import {
  clampListLimit,
  clampListOffset,
  type ListQueryOptions,
} from "@/lib/constants/listings";
import { contemNormalizado } from "@/lib/utils/normalizar";
import {
  clienteFormSchema,
  type ClienteFormValues,
} from "@/lib/validations/cliente";
import type { Cliente, Imovel, Lead, TipoCliente } from "@/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type ClienteActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
  clienteId?: string;
};

export type ClienteSearchResult = {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  tipo: TipoCliente;
  eh_construtor_investidor: boolean;
  corretor_id: string;
  pode_vincular: boolean;
  aviso?: string;
  /** Quando a correspondência veio de um atendimento sem cadastro em clientes. */
  leadId?: string;
  origem?: "cliente" | "lead";
};

function buildClienteInsert(corretorId: string, data: ClienteFormValues) {
  return {
    corretor_id: corretorId,
    perfil_id: data.perfil_id ?? null,
    nome: data.nome.trim(),
    telefone: data.telefone.trim(),
    email: data.email?.trim() || null,
    cpf: data.cpf?.trim() || null,
    data_nascimento: data.data_nascimento?.trim() || null,
    profissao: data.profissao?.trim() || null,
    estado_civil: data.estado_civil?.trim() || null,
    observacoes: data.observacoes?.trim() || null,
    tipo: data.tipo,
    eh_construtor_investidor: data.eh_construtor_investidor,
  };
}

function buildClienteUpdate(data: ClienteFormValues) {
  return {
    perfil_id: data.perfil_id ?? null,
    nome: data.nome.trim(),
    telefone: data.telefone.trim(),
    email: data.email?.trim() || null,
    cpf: data.cpf?.trim() || null,
    data_nascimento: data.data_nascimento?.trim() || null,
    profissao: data.profissao?.trim() || null,
    estado_civil: data.estado_civil?.trim() || null,
    observacoes: data.observacoes?.trim() || null,
    tipo: data.tipo,
    eh_construtor_investidor: data.eh_construtor_investidor,
    atualizado_em: new Date().toISOString(),
  };
}

function mapClienteInsertError(error: PostgrestError): string {
  if (error.code === "23505") {
    const details = `${error.message} ${error.details ?? ""}`.toLowerCase();

    if (details.includes("clientes_corretor_telefone")) {
      return "Já existe um cliente cadastrado com este telefone.";
    }

    if (details.includes("clientes_corretor_email")) {
      return "Já existe um cliente cadastrado com este e-mail.";
    }
  }

  return "Não foi possível cadastrar o cliente.";
}

async function insertClienteRow(
  corretorId: string,
  payload: ReturnType<typeof buildClienteInsert>,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert(payload)
    .select("id")
    .single();

  if (!error && data) {
    return { id: data.id };
  }

  if (error) {
    logPostgrestError("insertClienteRow", error);
  }

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackData, error: fallbackError } = await admin
      .from("clientes")
      .insert(payload)
      .select("id")
      .single();

    if (!fallbackError && fallbackData) {
      console.warn("[insertClienteRow] used service role fallback", { corretorId });
      return { id: fallbackData.id };
    }

    if (fallbackError) {
      logPostgrestError("insertClienteRow:fallback", fallbackError);
      return { error: mapClienteInsertError(fallbackError) };
    }
  } catch (fallbackError) {
    console.error("[insertClienteRow] service role fallback unavailable", fallbackError);
  }

  return {
    error: error ? mapClienteInsertError(error) : "Não foi possível cadastrar o cliente.",
  };
}

function resolveLeadPerfilId(lead: {
  perfil_id?: string | null;
  observacoes?: string | null;
}): string | null {
  if (lead.perfil_id) {
    return lead.perfil_id;
  }

  return parseLeadObservacoes(lead.observacoes).meta.perfil_id ?? null;
}

function pertenceAoPerfil(
  perfilId: string | null | undefined,
  perfilAtualId: string,
  verTodos: boolean,
): boolean {
  if (verTodos) {
    return true;
  }

  return perfilId === perfilAtualId;
}

type PessoasAccess = Awaited<ReturnType<typeof resolveTenantAccess>>;

type ClienteDbClient = TenantDbClient;

type LeadPessoaRow = {
  id: string;
  corretor_id: string;
  perfil_id: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
  perfil:
    | { id: string; nome: string; email: string | null; papel: string }
    | { id: string; nome: string; email: string | null; papel: string }[]
    | null;
};

async function resolvePessoasAccess(corretor: Parameters<typeof resolveTenantAccess>[0]) {
  return resolveTenantAccess(corretor);
}

function pessoaVisivelParaUsuario(
  perfilId: string | null | undefined,
  access: PessoasAccess,
): boolean {
  return registroVisivelPorPerfil(perfilId, access);
}

async function fetchClientesAndLeads(
  supabase: ClienteDbClient,
  corretorId: string,
  limit: number,
  offset: number,
): Promise<{ clientes: Cliente[]; leads: LeadPessoaRow[] }> {
  const [clientesRes, leadsRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("*, perfil:perfis(id, nome, email, papel)")
      .eq("corretor_id", corretorId)
      .order("criado_em", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from("leads")
      .select(
        "id, corretor_id, perfil_id, nome, telefone, email, observacoes, criado_em, atualizado_em, perfil:perfis(id, nome, email, papel)",
      )
      .eq("corretor_id", corretorId)
      .order("criado_em", { ascending: false })
      .range(offset, offset + limit - 1),
  ]);

  if (clientesRes.error) {
    console.error("[fetchClientesAndLeads] clientes failed", clientesRes.error);
  }

  if (leadsRes.error) {
    console.error("[fetchClientesAndLeads] leads failed", leadsRes.error);
  }

  return {
    clientes: (clientesRes.data ?? []) as Cliente[],
    leads: (leadsRes.data ?? []) as LeadPessoaRow[],
  };
}

function mergeClientesComLeads(
  clientes: Cliente[],
  leads: LeadPessoaRow[],
  access: PessoasAccess,
): Cliente[] {
  const pessoas: Cliente[] = [...clientes];

  for (const lead of leads) {
    const leadPerfilId = resolveLeadPerfilId(lead);

    if (!pessoaVisivelParaUsuario(leadPerfilId, access)) {
      continue;
    }

    const telefone = lead.telefone?.trim() ?? "";
    if (!telefone) {
      continue;
    }

    const clienteExistente = findClienteByTelefone(pessoas, telefone);

    if (clienteExistente) {
      if (clienteExistente.tipo === "proprietario") {
        clienteExistente.tipo = "ambos";
      }
      continue;
    }

    pessoas.push({
      id: lead.id,
      lead_id: lead.id,
      corretor_id: lead.corretor_id,
      perfil_id: leadPerfilId,
      nome: lead.nome?.trim() || "Sem nome",
      telefone,
      email: lead.email,
      tipo: "lead",
      eh_construtor_investidor: false,
      criado_em: lead.criado_em,
      atualizado_em: lead.atualizado_em,
      perfil: Array.isArray(lead.perfil)
        ? (lead.perfil[0] as Cliente["perfil"])
        : ((lead.perfil as Cliente["perfil"]) ?? null),
    });
  }

  return pessoas.sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
  );
}

function findClienteByTelefone(clientes: Cliente[], telefone: string): Cliente | undefined {
  return clientes.find((cliente) => telefonesEquivalentes(cliente.telefone, telefone));
}

export async function verificarPessoaExistente(
  corretorId: string,
  telefone?: string,
  email?: string,
  clienteIdIgnorar?: string,
  leadIdIgnorar?: string,
): Promise<VerificacaoPessoaExistente> {
  const supabase = await createClient();
  const match = await findClientePorTelefoneOuEmail(
    supabase,
    corretorId,
    { telefone, email },
    clienteIdIgnorar,
    leadIdIgnorar,
  );

  if (!match) {
    return { existe: false };
  }

  return {
    existe: true,
    cliente: match.cliente,
    motivo: match.motivo,
  };
}

function leadEstaAtivo(lead: {
  situacao?: string | null;
  etapa?: string | null;
}): boolean {
  if (lead.situacao === "descartado" || lead.situacao === "negocio_fechado") {
    return false;
  }
  if (lead.etapa === "venda" || lead.etapa === "fechado" || lead.etapa === "perdido") {
    return false;
  }
  return true;
}

async function buscarLeadsPorContato(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  contato: { clienteId?: string; telefone?: string; email?: string | null },
): Promise<LeadAtivoInfo[]> {
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, cliente_id, telefone, email, codigo_atendimento, situacao, etapa, perfil_id, atualizado_em, motivo_descarte_id, motivo_descarte_texto, perfil:perfis(id, nome), motivo:motivos_descarte(nome)",
    )
    .eq("corretor_id", corretorId)
    .order("criado_em", { ascending: false });

  if (error || !leads?.length) {
    if (error) {
      console.error("[buscarLeadsPorContato] failed", error);
    }
    return [];
  }

  return leads
    .filter((lead) => {
      if (contato.clienteId && lead.cliente_id === contato.clienteId) {
        return true;
      }
      if (contato.telefone && telefonesEquivalentes(lead.telefone ?? "", contato.telefone)) {
        return true;
      }
      if (
        contato.email &&
        lead.email &&
        normalizeEmail(lead.email) === normalizeEmail(contato.email)
      ) {
        return true;
      }
      return false;
    })
    .map((lead) => {
      const perfil = Array.isArray(lead.perfil) ? lead.perfil[0] : lead.perfil;
      const motivo = Array.isArray(lead.motivo) ? lead.motivo[0] : lead.motivo;

      return {
        id: lead.id,
        codigo_atendimento: lead.codigo_atendimento,
        situacao: lead.situacao,
        etapa: lead.etapa,
        perfil_id: lead.perfil_id,
        perfil_nome: perfil?.nome ?? null,
        descartado_em: lead.situacao === "descartado" ? lead.atualizado_em : null,
        motivo_descarte: motivo?.nome ?? lead.motivo_descarte_texto ?? null,
      };
    });
}

export async function buscarPessoasAutocomplete(
  telefone?: string,
  email?: string,
): Promise<PessoaAutocompleteItem[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return [];
  }

  const telefoneLimpo = telefone ? sanitizeTelefone(telefone) : "";
  const emailNorm = email ? normalizeEmail(email) : "";

  if (
    telefoneLimpo.length < MIN_TELEFONE_BUSCA_AUTOCOMPLETE &&
    !emailValidoParaBusca(emailNorm)
  ) {
    return [];
  }

  const supabase = await createClient();
  let matches = await findClientesAutocomplete(supabase, corretor.id, {
    telefone,
    email,
  });

  if (matches.length === 0) {
    const admin = await createTenantDataClient();

    if (admin) {
      const fallbackMatches = await findClientesAutocomplete(admin, corretor.id, {
        telefone,
        email,
      });

      if (fallbackMatches.length > 0) {
        console.warn("[buscarPessoasAutocomplete] used service role fallback", {
          corretorId: corretor.id,
        });
        matches = fallbackMatches;
      }
    }
  }

  if (!matches.length) {
    console.warn("[buscarPessoasAutocomplete] nenhum resultado", {
      telefone: telefoneLimpo,
      email: emailNorm,
    });
  }

  return matches.map((match) => ({
    id: match.id,
    nome: match.nome,
    telefone: match.telefone,
    email: match.email,
    eh_construtor_investidor: match.eh_construtor_investidor ?? false,
    leadId: match.leadId,
    origem: match.origem,
  }));
}

async function resolverPessoaAtendimento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  pessoaRef: string | PessoaAutocompleteItem,
): Promise<PessoaAutocompleteItem | null> {
  if (typeof pessoaRef === "string") {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nome, telefone, email, eh_construtor_investidor")
      .eq("id", pessoaRef)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (!cliente) {
      return null;
    }

    return {
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      email: cliente.email,
      eh_construtor_investidor: cliente.eh_construtor_investidor ?? false,
      origem: "cliente",
    };
  }

  if (pessoaRef.id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nome, telefone, email, eh_construtor_investidor")
      .eq("id", pessoaRef.id)
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (cliente) {
      return {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        eh_construtor_investidor: cliente.eh_construtor_investidor ?? false,
        leadId: pessoaRef.leadId,
        origem: "cliente",
      };
    }
  }

  return pessoaRef;
}

export async function avaliarSelecaoPessoaAtendimento(
  pessoaRef: string | PessoaAutocompleteItem,
  perfilAtualId?: string | null,
): Promise<SelecaoPessoaAtendimentoResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { tipo: "bloqueado", mensagem: "Sessão expirada." };
  }

  const supabase = await createClient();
  const pessoa = await resolverPessoaAtendimento(supabase, corretor.id, pessoaRef);

  if (!pessoa) {
    return { tipo: "bloqueado", mensagem: "Pessoa não encontrada." };
  }

  const leads = await buscarLeadsPorContato(supabase, corretor.id, {
    clienteId: pessoa.id || undefined,
    telefone: pessoa.telefone,
    email: pessoa.email,
  });
  const leadEmAtendimento = leads.find(
    (lead) => lead.situacao === "em_atendimento" || leadEstaAtivo(lead),
  );
  const leadDescartado = leads.find((lead) => lead.situacao === "descartado");

  if (leadEmAtendimento) {
    const mesmoResponsavel =
      !leadEmAtendimento.perfil_id ||
      !perfilAtualId ||
      leadEmAtendimento.perfil_id === perfilAtualId;

    if (mesmoResponsavel) {
      return {
        tipo: "bloqueado",
        mensagem: mensagemAtendimentoEmAndamento(),
        leadId: leadEmAtendimento.id,
        cliente: pessoa,
      };
    }

    return {
      tipo: "bloqueado",
      mensagem: mensagemLeadAtivoOutroCorretor(leadEmAtendimento.perfil_nome ?? "outro corretor"),
      leadId: leadEmAtendimento.id,
      cliente: pessoa,
    };
  }

  if (leadDescartado) {
    return {
      tipo: "descartado",
      cliente: pessoa,
      atendimentoAnterior: leadDescartado,
    };
  }

  return { tipo: "permitido", cliente: pessoa };
}

export async function verificarContatoNovoAtendimento(
  telefone: string,
  email?: string,
): Promise<{
  sessaoExpirada?: boolean;
  pessoa?: PessoaAutocompleteItem;
  avaliacao?: SelecaoPessoaAtendimentoResult;
}> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { sessaoExpirada: true };
  }

  const verificacao = await verificarPessoaExistente(corretor.id, telefone, email);
  if (!verificacao.existe || !verificacao.cliente) {
    return {};
  }

  const pessoa: PessoaAutocompleteItem = {
    id: verificacao.cliente.id,
    nome: verificacao.cliente.nome,
    telefone: verificacao.cliente.telefone,
    email: verificacao.cliente.email,
    eh_construtor_investidor: verificacao.cliente.eh_construtor_investidor ?? false,
    origem: verificacao.cliente.id ? "cliente" : "lead",
  };

  const avaliacao = await avaliarSelecaoPessoaAtendimento(pessoa);
  return { pessoa, avaliacao };
}

async function fetchClienteForProprietarioSelection(
  supabase: ClienteDbClient,
  clienteId: string,
): Promise<ClienteSearchRow | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, nome, telefone, email, tipo, eh_construtor_investidor, corretor_id, perfil_id",
    )
    .eq("id", clienteId)
    .maybeSingle();

  if (error) {
    console.error("[fetchClienteForProprietarioSelection] failed", error);
    return null;
  }

  return (data as ClienteSearchRow | null) ?? null;
}

export async function avaliarSelecaoPessoaProprietario(
  clienteId: string,
): Promise<SelecaoPessoaProprietarioResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { tipo: "bloqueado", mensagem: "Sessão expirada." };
  }

  const supabase = await createClient();
  let cliente = await fetchClienteForProprietarioSelection(supabase, clienteId);

  if (!cliente) {
    const admin = await createTenantDataClient();

    if (admin) {
      cliente = await fetchClienteForProprietarioSelection(admin, clienteId);

      if (cliente) {
        console.warn("[avaliarSelecaoPessoaProprietario] used service role fallback", {
          corretorId: corretor.id,
          clienteId,
        });
      }
    }
  }

  if (!cliente) {
    return { tipo: "bloqueado", mensagem: "Pessoa não encontrada." };
  }

  const pessoa: PessoaAutocompleteItem = {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    email: cliente.email,
    eh_construtor_investidor: cliente.eh_construtor_investidor ?? false,
  };

  if (cliente.eh_construtor_investidor) {
    return { tipo: "permitido", cliente: pessoa };
  }

  if (cliente.corretor_id !== corretor.id) {
    return {
      tipo: "bloqueado",
      mensagem: mensagemProprietarioIndisponivel(),
      cliente: pessoa,
    };
  }

  return { tipo: "permitido", cliente: pessoa };
}

export async function verificarDuplicidadeContatoForm(input: {
  telefone?: string;
  email?: string;
  clienteIdIgnorar?: string;
  leadIdIgnorar?: string;
}): Promise<{ duplicado: boolean; mensagem?: string }> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { duplicado: false };
  }

  const duplicidadeLead = await verificarDuplicidadeContatoLead(
    input.telefone,
    input.email,
    input.leadIdIgnorar,
    input.clienteIdIgnorar,
  );

  if (duplicidadeLead.bloqueado) {
    return { duplicado: true, mensagem: duplicidadeLead.mensagem };
  }

  const duplicidade = await verificarPessoaExistente(
    corretor.id,
    input.telefone,
    input.email,
    input.clienteIdIgnorar,
    input.leadIdIgnorar,
  );

  if (duplicidade.existe && duplicidade.cliente && duplicidade.motivo) {
    return {
      duplicado: true,
      mensagem: erroDuplicidadePessoa(duplicidade.motivo, duplicidade.cliente.nome),
    };
  }

  return { duplicado: false };
}

export async function verificarDuplicidadeContatoLead(
  telefone?: string,
  email?: string,
  leadIdIgnorar?: string,
  clienteIdIgnorar?: string,
): Promise<{ bloqueado: boolean; mensagem?: string; leadId?: string }> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { bloqueado: true, mensagem: "Sessão expirada." };
  }

  const duplicidade = await verificarPessoaExistente(
    corretor.id,
    telefone,
    email,
    clienteIdIgnorar,
    leadIdIgnorar,
  );
  if (duplicidade.existe && duplicidade.cliente?.id) {
    const avaliacao = await avaliarSelecaoPessoaAtendimento(duplicidade.cliente.id);
    if (avaliacao.tipo === "bloqueado") {
      return {
        bloqueado: true,
        mensagem: avaliacao.mensagem,
        leadId: avaliacao.leadId,
      };
    }
  }

  const supabase = await createClient();
  const telefoneLimpo = telefone ? sanitizeTelefone(telefone) : "";
  const emailNorm = email ? normalizeEmail(email) : "";

  const { data: leads } = await supabase
    .from("leads")
    .select("id, telefone, email, situacao, etapa, perfil_id, perfil:perfis(nome)")
    .eq("corretor_id", corretor.id);

  const leadDuplicado = (leads ?? []).find((lead) => {
    if (leadIdIgnorar && lead.id === leadIdIgnorar) {
      return false;
    }
    if (!leadEstaAtivo(lead)) {
      return false;
    }
    if (telefoneLimpo.length >= 10 && telefonesEquivalentes(lead.telefone ?? "", telefoneLimpo)) {
      return true;
    }
    if (emailValidoParaBusca(emailNorm) && lead.email && normalizeEmail(lead.email) === emailNorm) {
      return true;
    }
    return false;
  });

  if (!leadDuplicado) {
    return { bloqueado: false };
  }

  const perfil = Array.isArray(leadDuplicado.perfil)
    ? leadDuplicado.perfil[0]
    : leadDuplicado.perfil;

  return {
    bloqueado: true,
    mensagem: mensagemLeadAtivoMesmoCorretor(),
    leadId: leadDuplicado.id,
  };
}

export async function getClientes(options?: ListQueryOptions): Promise<Cliente[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const limit = clampListLimit(options?.limit);
  const offset = clampListOffset(options?.offset);
  const access = await resolvePessoasAccess(corretor);

  const supabase = await createClient();
  let { clientes, leads } = await fetchClientesAndLeads(supabase, corretor.id, limit, offset);

  if (clientes.length === 0 && leads.length === 0) {
    const admin = await createTenantDataClient();
    if (admin) {
      const fallback = await fetchClientesAndLeads(admin, corretor.id, limit, offset);

      if (fallback.clientes.length > 0 || fallback.leads.length > 0) {
        console.warn("[getClientes] authenticated query returned empty; used service role fallback", {
          corretorId: corretor.id,
        });
        clientes = fallback.clientes;
        leads = fallback.leads;
      }
    }
  }

  const clientesFiltrados = clientes.filter((cliente) =>
    pessoaVisivelParaUsuario(cliente.perfil_id, access),
  );

  return mergeClientesComLeads(clientesFiltrados, leads, access);
}

async function fetchClienteByIdRow(
  supabase: ClienteDbClient,
  corretorId: string,
  id: string,
): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*, perfil:perfis(id, nome, email, papel)")
    .eq("id", id)
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (error) {
    console.error("[fetchClienteByIdRow] failed", error);
    return null;
  }

  return (data as Cliente | null) ?? null;
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  const supabase = await createClient();
  const row = await fetchClienteByIdRow(supabase, corretor.id, id);

  if (row) {
    return row;
  }

  const admin = await createTenantDataClient();
  if (!admin) {
    return null;
  }

  const fallbackRow = await fetchClienteByIdRow(admin, corretor.id, id);

  if (fallbackRow) {
    console.warn("[getClienteById] authenticated query returned empty; used service role fallback", {
      corretorId: corretor.id,
      clienteId: id,
    });
  }

  return fallbackRow;
}

export async function getImoveisByClienteId(clienteId: string): Promise<Imovel[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const fetchRows = async (supabase: ClienteDbClient) => {
    const { data, error } = await supabase
      .from("imoveis")
      .select("*, fotos:imovel_fotos(*)")
      .eq("corretor_id", corretor.id)
      .eq("cliente_id", clienteId)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("[getImoveisByClienteId] failed", error);
      return [] as Imovel[];
    }

    return (data ?? []) as Imovel[];
  };

  const supabase = await createClient();
  const rows = await fetchRows(supabase);

  if (rows.length > 0) {
    return rows;
  }

  const admin = await createTenantDataClient();
  if (!admin) {
    return rows;
  }

  return fetchRows(admin);
}

export async function getLeadsByClienteTelefone(telefone: string): Promise<Lead[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const digits = sanitizeTelefone(telefone);
  if (!digits) {
    return [];
  }

  const fetchRows = async (supabase: ClienteDbClient) => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("corretor_id", corretor.id)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("[getLeadsByClienteTelefone] failed", error);
      return [] as Lead[];
    }

    return ((data ?? []) as Lead[]).filter((lead) => {
      const leadDigits = sanitizeTelefone(lead.telefone ?? "");
      return leadDigits === digits || leadDigits.endsWith(digits) || digits.endsWith(leadDigits);
    });
  };

  const supabase = await createClient();
  const rows = await fetchRows(supabase);

  if (rows.length > 0) {
    return rows;
  }

  const admin = await createTenantDataClient();
  if (!admin) {
    return rows;
  }

  return fetchRows(admin);
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,()]/g, "\\$&");
}

type ClienteSearchRow = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  tipo: string;
  eh_construtor_investidor: boolean;
  corretor_id: string;
  perfil_id: string | null;
};

async function fetchClientesSearchRows(
  supabase: ClienteDbClient,
  corretorId: string,
  trimmed: string,
  digits: string,
): Promise<ClienteSearchRow[]> {
  let dbQuery = supabase
    .from("clientes")
    .select(
      "id, nome, telefone, email, tipo, eh_construtor_investidor, corretor_id, perfil_id",
    )
    .eq("corretor_id", corretorId)
    .order("nome", { ascending: true })
    .limit(50);

  const nomePattern = escapeIlikePattern(trimmed);

  if (digits.length >= 4) {
    const telefonePattern = escapeIlikePattern(digits);
    dbQuery = dbQuery.or(
      `telefone.ilike.%${telefonePattern}%,nome.ilike.%${nomePattern}%`,
    );
  } else {
    dbQuery = dbQuery.ilike("nome", `%${nomePattern}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("[fetchClientesSearchRows] failed", error);
    return [];
  }

  return (data ?? []) as ClienteSearchRow[];
}

export async function searchClientes(query: string): Promise<ClienteSearchResult[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const access = await resolvePessoasAccess(corretor);
  const digits = sanitizeTelefone(trimmed);

  const supabase = await createClient();
  let rows = await fetchClientesSearchRows(supabase, corretor.id, trimmed, digits);

  if (rows.length === 0) {
    const admin = await createTenantDataClient();

    if (admin) {
      const fallbackRows = await fetchClientesSearchRows(admin, corretor.id, trimmed, digits);

      if (fallbackRows.length > 0) {
        console.warn("[searchClientes] used service role fallback", { corretorId: corretor.id });
        rows = fallbackRows;
      }
    }
  }

  const filtered = rows.filter((cliente) => {
    if (!pessoaVisivelParaUsuario(cliente.perfil_id, access)) {
      return false;
    }

    if (contemNormalizado(cliente.nome, trimmed)) {
      return true;
    }

    if (digits.length >= 4) {
      const telefoneDigits = sanitizeTelefone(cliente.telefone ?? "");
      return (
        telefoneDigits.includes(digits) ||
        digits.includes(telefoneDigits) ||
        telefonesEquivalentes(cliente.telefone ?? "", digits)
      );
    }

    return false;
  });

  return filtered.slice(0, 10).map((cliente) => mapClienteRowToSearchResult(cliente, corretor.id));
}

type LeadSearchRow = {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cliente_id: string | null;
  perfil_id: string | null;
};

async function fetchLeadsSearchRows(
  supabase: ClienteDbClient,
  corretorId: string,
  trimmed: string,
  digits: string,
): Promise<LeadSearchRow[]> {
  const emailNorm = trimmed.includes("@") ? normalizeEmail(trimmed) : "";
  const buscaPorTelefone = digits.length >= MIN_TELEFONE_BUSCA_AUTOCOMPLETE;
  const buscaPorEmail = emailValidoParaBusca(emailNorm);

  let dbQuery = supabase
    .from("leads")
    .select("id, nome, telefone, email, cliente_id, perfil_id")
    .eq("corretor_id", corretorId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (buscaPorEmail && !buscaPorTelefone) {
    dbQuery = dbQuery.ilike("email", `%${escapeIlikePattern(emailNorm)}%`);
  } else if (!buscaPorTelefone) {
    dbQuery = dbQuery.ilike("nome", `%${escapeIlikePattern(trimmed)}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("[fetchLeadsSearchRows] failed", error);
    return [];
  }

  return ((data ?? []) as LeadSearchRow[]).filter((lead) => {
    const telefone = lead.telefone?.trim() ?? "";
    if (!telefone) {
      return false;
    }

    if (contemNormalizado(lead.nome, trimmed)) {
      return true;
    }

    if (buscaPorTelefone) {
      const telefoneDigits = sanitizeTelefone(telefone);
      return (
        telefoneDigits.includes(digits) ||
        digits.includes(telefoneDigits) ||
        telefonesEquivalentes(telefone, digits)
      );
    }

    if (buscaPorEmail && lead.email) {
      return normalizeEmail(lead.email).includes(emailNorm);
    }

    return false;
  });
}

function mapClienteRowToSearchResult(
  cliente: ClienteSearchRow,
  corretorId: string,
  extras?: { leadId?: string; origem?: "cliente" | "lead" },
): ClienteSearchResult {
  const isOwn = cliente.corretor_id === corretorId;
  let pode_vincular = isOwn;
  let aviso: string | undefined;

  if (!isOwn) {
    if (cliente.eh_construtor_investidor) {
      pode_vincular = true;
      aviso = "Construtor/investidor — vinculação permitida.";
    } else {
      pode_vincular = false;
      aviso = mensagemProprietarioIndisponivel();
    }
  }

  return {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    email: cliente.email,
    tipo: (extras?.origem === "lead" ? "lead" : cliente.tipo) as TipoCliente,
    eh_construtor_investidor: cliente.eh_construtor_investidor,
    corretor_id: cliente.corretor_id,
    pode_vincular: extras?.origem === "lead" ? true : pode_vincular,
    aviso: extras?.origem === "lead" ? "Lead em atendimento — será vinculado ao imóvel." : aviso,
    leadId: extras?.leadId,
    origem: extras?.origem ?? "cliente",
  };
}

function dedupeSearchResults(results: ClienteSearchResult[]): ClienteSearchResult[] {
  const seen = new Set<string>();
  const deduped: ClienteSearchResult[] = [];

  for (const item of results) {
    const key = item.id || (item.leadId ? `lead:${item.leadId}` : "");
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export async function buscarPessoasParaProprietario(
  query: string,
): Promise<ClienteSearchResult[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const access = await resolvePessoasAccess(corretor);
  const digits = sanitizeTelefone(trimmed);

  const supabase = await createClient();
  let clienteRows = await fetchClientesSearchRows(supabase, corretor.id, trimmed, digits);
  let leadRows = await fetchLeadsSearchRows(supabase, corretor.id, trimmed, digits);

  if (clienteRows.length === 0 || leadRows.length === 0) {
    const admin = await createTenantDataClient();

    if (admin) {
      if (clienteRows.length === 0) {
        clienteRows = await fetchClientesSearchRows(admin, corretor.id, trimmed, digits);
      }
      if (leadRows.length === 0) {
        leadRows = await fetchLeadsSearchRows(admin, corretor.id, trimmed, digits);
      }
    }
  }

  const clienteIds = new Set(clienteRows.map((row) => row.id));
  const resultados: ClienteSearchResult[] = [];

  for (const cliente of clienteRows) {
    if (!pessoaVisivelParaUsuario(cliente.perfil_id, access)) {
      continue;
    }

    if (
      !contemNormalizado(cliente.nome, trimmed) &&
      !(digits.length >= MIN_TELEFONE_BUSCA_AUTOCOMPLETE &&
        (sanitizeTelefone(cliente.telefone ?? "").includes(digits) ||
          telefonesEquivalentes(cliente.telefone ?? "", digits)))
    ) {
      continue;
    }

    resultados.push(mapClienteRowToSearchResult(cliente, corretor.id));
  }

  for (const lead of leadRows) {
    if (!pessoaVisivelParaUsuario(lead.perfil_id, access)) {
      continue;
    }

    if (lead.cliente_id && clienteIds.has(lead.cliente_id)) {
      continue;
    }

    const telefone = lead.telefone?.trim() ?? "";
    resultados.push(
      mapClienteRowToSearchResult(
        {
          id: lead.cliente_id ?? "",
          nome: lead.nome?.trim() || "Sem nome",
          telefone,
          email: lead.email,
          tipo: "lead",
          eh_construtor_investidor: false,
          corretor_id: corretor.id,
          perfil_id: lead.perfil_id,
        },
        corretor.id,
        { leadId: lead.id, origem: "lead" },
      ),
    );
  }

  return dedupeSearchResults(resultados).slice(0, 10);
}

async function ensureClienteFromLead(leadId: string): Promise<{ clienteId: string } | { error: string }> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const fetchLead = async (supabase: ClienteDbClient) => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, nome, telefone, email, cliente_id")
      .eq("id", leadId)
      .eq("corretor_id", corretor.id)
      .maybeSingle();

    if (error) {
      console.error("[ensureClienteFromLead] failed", error);
      return null;
    }

    return data;
  };

  const supabase = await createClient();
  let lead = await fetchLead(supabase);

  if (!lead) {
    const admin = await createTenantDataClient();
    if (admin) {
      lead = await fetchLead(admin);
    }
  }

  if (!lead) {
    return { error: "Atendimento não encontrado." };
  }

  if (lead.cliente_id) {
    return { clienteId: lead.cliente_id };
  }

  const telefone = lead.telefone?.trim() ?? "";
  if (!telefone) {
    return { error: "Este atendimento não possui telefone para vincular." };
  }

  const duplicidade = await verificarPessoaExistente(
    corretor.id,
    telefone,
    lead.email ?? undefined,
    undefined,
    leadId,
  );

  if (duplicidade.existe && duplicidade.cliente?.id) {
    const clienteId = duplicidade.cliente.id;
    await supabase.from("leads").update({ cliente_id: clienteId }).eq("id", leadId);
    return { clienteId };
  }

  const perfil = await getPerfilForUser(corretor.id);
  const insertResult = await insertClienteRow(corretor.id, {
    corretor_id: corretor.id,
    perfil_id: perfil?.id ?? null,
    nome: lead.nome?.trim() || "Sem nome",
    telefone,
    email: lead.email?.trim() || null,
    cpf: null,
    data_nascimento: null,
    profissao: null,
    estado_civil: null,
    observacoes: null,
    tipo: "ambos",
    eh_construtor_investidor: false,
  });

  if ("error" in insertResult) {
    return { error: insertResult.error };
  }

  await supabase
    .from("leads")
    .update({ cliente_id: insertResult.id })
    .eq("id", leadId);

  return { clienteId: insertResult.id };
}

export async function vincularPessoaComoProprietario(input: {
  clienteId?: string;
  leadId?: string;
}): Promise<SelecaoPessoaProprietarioResult> {
  let clienteId = input.clienteId?.trim() || null;

  if (!clienteId && input.leadId) {
    const ensured = await ensureClienteFromLead(input.leadId);
    if ("error" in ensured) {
      return { tipo: "bloqueado", mensagem: ensured.error };
    }
    clienteId = ensured.clienteId;
  }

  if (!clienteId) {
    return { tipo: "bloqueado", mensagem: "Pessoa não encontrada." };
  }

  return avaliarSelecaoPessoaProprietario(clienteId);
}

export async function createCliente(
  rawData: ClienteFormValues,
): Promise<ClienteActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const parsed = clienteFormSchema.safeParse(rawData);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Dados inválidos." };
  }

  const duplicidade = await verificarPessoaExistente(
    corretor.id,
    parsed.data.telefone,
    parsed.data.email,
  );

  if (duplicidade.existe && duplicidade.cliente && duplicidade.motivo) {
    return {
      error: erroDuplicidadePessoa(duplicidade.motivo, duplicidade.cliente.nome),
    };
  }

  let perfilId = parsed.data.perfil_id ?? null;

  if (!perfilId) {
    const perfil = await getPerfilForUser(corretor.id);
    perfilId = perfil?.id ?? null;
  }

  const insertResult = await insertClienteRow(
    corretor.id,
    buildClienteInsert(corretor.id, { ...parsed.data, perfil_id: perfilId }),
  );

  if ("error" in insertResult) {
    console.error("[createCliente] failed", insertResult.error);
    return { error: insertResult.error };
  }

  revalidatePath("/dashboard/clientes");

  return { success: true, clienteId: insertResult.id };
}

export async function createClienteFromImovel(
  data: {
    nome: string;
    telefone: string;
    email?: string;
    atender_como_lead: boolean;
    eh_construtor_investidor: boolean;
  },
): Promise<ClienteActionResult> {
  return createCliente({
    nome: data.nome,
    telefone: data.telefone,
    email: data.email ?? "",
    cpf: "",
    data_nascimento: "",
    profissao: "",
    estado_civil: "",
    observacoes: "",
    tipo: data.atender_como_lead ? "ambos" : "proprietario",
    eh_construtor_investidor: data.eh_construtor_investidor,
    perfil_id: null,
  });
}

export async function updateCliente(
  id: string,
  rawData: ClienteFormValues,
): Promise<ClienteActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const parsed = clienteFormSchema.safeParse(rawData);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { error: firstIssue?.message ?? "Dados inválidos." };
  }

  const duplicidade = await verificarPessoaExistente(
    corretor.id,
    parsed.data.telefone,
    parsed.data.email,
    id,
  );

  if (duplicidade.existe && duplicidade.cliente && duplicidade.motivo) {
    return {
      error: erroDuplicidadePessoa(duplicidade.motivo, duplicidade.cliente.nome),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update(buildClienteUpdate(parsed.data))
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[updateCliente] failed", error);
    return { error: "Não foi possível atualizar o cliente." };
  }

  revalidatePath("/dashboard/clientes");
  revalidatePath(`/dashboard/clientes/${id}`);

  return { success: true, clienteId: id };
}

export async function createClienteAndRedirect(
  rawData: ClienteFormValues,
): Promise<ClienteActionResult> {
  const result = await createCliente(rawData);

  if (result.error || !result.clienteId) {
    return result;
  }

  redirect(`/dashboard/clientes/${result.clienteId}`);
}

export async function deleteCliente(id: string): Promise<ClienteActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    console.error("[deleteCliente] failed", error);
    return { error: "Não foi possível excluir o cliente." };
  }

  revalidatePath("/dashboard/clientes");

  return { success: true };
}
