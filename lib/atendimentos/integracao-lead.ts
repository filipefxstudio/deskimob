import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  emailValidoParaBusca,
  findClientePorTelefoneOuEmail,
  normalizeEmail,
  telefonesEquivalentes,
} from "@/lib/pessoas/duplicate";
import { gerarCodigoAtendimento } from "@/lib/actions/atendimentos";
import { fetchPreferenciasInteresseFromImovel } from "@/lib/atendimentos/interesse-from-imovel";
import type { OrigemLead } from "@/types";

export type IntegracaoLeadInput = {
  corretorId: string;
  nome: string;
  telefone: string;
  email?: string | null;
  imovelId?: string | null;
  observacoes?: string | null;
  origem?: OrigemLead;
};

export type IntegracaoLeadResult = {
  leadId: string;
  criado: boolean;
  imovelAdicionado?: boolean;
};

type LeadContatoRow = {
  id: string;
  cliente_id?: string | null;
  telefone?: string | null;
  email?: string | null;
  situacao?: string | null;
  etapa?: string | null;
};

function leadEstaAtivo(lead: { situacao?: string | null; etapa?: string | null }): boolean {
  if (lead.situacao === "descartado" || lead.situacao === "negocio_fechado") {
    return false;
  }
  if (lead.etapa === "venda" || lead.etapa === "fechado" || lead.etapa === "perdido") {
    return false;
  }
  return true;
}

async function buscarLeadAtivoPorContato(
  supabase: SupabaseClient,
  corretorId: string,
  contato: { clienteId?: string; telefone: string; email?: string | null },
): Promise<LeadContatoRow | null> {
  const telefoneLimpo = contato.telefone.replace(/\D/g, "");
  const emailNorm = contato.email ? normalizeEmail(contato.email) : "";

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, cliente_id, telefone, email, situacao, etapa")
    .eq("corretor_id", corretorId)
    .order("criado_em", { ascending: false });

  if (error || !leads?.length) {
    if (error) {
      console.error("[integracao-lead] buscarLeadAtivoPorContato failed", error);
    }
    return null;
  }

  const leadAtivo = (leads as LeadContatoRow[]).find((lead) => {
    if (lead.situacao !== "em_atendimento" && !leadEstaAtivo(lead)) {
      return false;
    }

    if (contato.clienteId && lead.cliente_id === contato.clienteId) {
      return true;
    }

    if (telefoneLimpo.length >= 10 && telefonesEquivalentes(lead.telefone ?? "", telefoneLimpo)) {
      return true;
    }

    if (
      emailValidoParaBusca(emailNorm) &&
      lead.email &&
      normalizeEmail(lead.email) === emailNorm
    ) {
      return true;
    }

    return false;
  });

  return leadAtivo ?? null;
}

async function getImovelCodigo(
  supabase: SupabaseClient,
  imovelId: string,
): Promise<string | null> {
  const { data: imovel } = await supabase
    .from("imoveis")
    .select("codigo, codigo_personalizado")
    .eq("id", imovelId)
    .maybeSingle();

  return imovel?.codigo_personalizado ?? imovel?.codigo ?? null;
}

async function garantirImovelSelecionado(
  supabase: SupabaseClient,
  leadId: string,
  imovelId: string,
  corretorId: string,
  interesseInicial: boolean,
): Promise<boolean> {
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
    return false;
  }

  const { error } = await supabase.from("lead_imoveis_selecionados").insert({
    lead_id: leadId,
    imovel_id: imovelId,
    corretor_id: corretorId,
    interesse_inicial: interesseInicial,
    token_compartilhamento: randomUUID(),
  });

  if (error) {
    console.error("[integracao-lead] garantirImovelSelecionado failed", error);
    return false;
  }

  return true;
}

async function registrarInteracaoIntegracao(
  supabase: SupabaseClient,
  leadId: string,
  corretorId: string,
  descricao: string,
): Promise<void> {
  const criadoEm = new Date().toISOString();

  const { error } = await supabase.from("lead_interacoes").insert({
    lead_id: leadId,
    corretor_id: corretorId,
    tipo: "anotacao",
    conteudo: descricao,
    de: "sistema",
    criado_em: criadoEm,
  });

  if (error) {
    console.error("[integracao-lead] registrarInteracaoIntegracao failed", error);
    return;
  }

  await supabase
    .from("leads")
    .update({
      ultima_mensagem_em: criadoEm,
      atualizado_em: criadoEm,
    })
    .eq("id", leadId);
}

export async function processarLeadIntegracao(
  supabase: SupabaseClient,
  input: IntegracaoLeadInput,
): Promise<IntegracaoLeadResult> {
  const telefone = input.telefone.trim();
  const email = input.email?.trim() || null;
  const origem = input.origem ?? "site";

  const pessoaExistente = await findClientePorTelefoneOuEmail(supabase, input.corretorId, {
    telefone,
    email: email ?? undefined,
  });

  const clienteId = pessoaExistente?.cliente.id || undefined;
  const nome =
    pessoaExistente?.cliente.nome?.trim() || input.nome.trim();
  const telefoneFinal = pessoaExistente?.cliente.telefone?.trim() || telefone;
  const emailFinal = pessoaExistente?.cliente.email?.trim() || email;

  const leadAtivo = await buscarLeadAtivoPorContato(supabase, input.corretorId, {
    clienteId,
    telefone: telefoneFinal,
    email: emailFinal,
  });

  if (leadAtivo) {
    let imovelAdicionado = false;

    if (input.imovelId) {
      imovelAdicionado = await garantirImovelSelecionado(
        supabase,
        leadAtivo.id,
        input.imovelId,
        input.corretorId,
        false,
      );

      const codigoImovel = await getImovelCodigo(supabase, input.imovelId);
      const codigoLabel = codigoImovel ? `#${codigoImovel}` : "informado";

      await registrarInteracaoIntegracao(
        supabase,
        leadAtivo.id,
        input.corretorId,
        `Lead entrou em contato novamente e manifestou interesse pelo imóvel de código ${codigoLabel}.`,
      );
    } else if (input.observacoes?.trim()) {
      await registrarInteracaoIntegracao(
        supabase,
        leadAtivo.id,
        input.corretorId,
        "Lead entrou em contato novamente pelo site.",
      );
    }

    return {
      leadId: leadAtivo.id,
      criado: false,
      imovelAdicionado,
    };
  }

  const codigo = await gerarCodigoAtendimento(input.corretorId);
  const agora = new Date().toISOString();

  const preferenciasImovel = input.imovelId
    ? await fetchPreferenciasInteresseFromImovel(supabase, input.corretorId, input.imovelId)
    : null;

  const { data: novoLead, error } = await supabase
    .from("leads")
    .insert({
      corretor_id: input.corretorId,
      cliente_id: clienteId ?? null,
      nome,
      telefone: telefoneFinal,
      email: emailFinal,
      imovel_id: input.imovelId ?? null,
      codigo_atendimento: codigo,
      situacao: "em_atendimento",
      origem,
      etapa: "novo",
      temperatura: "indefinido",
      atendido_por: "corretor",
      data_entrada: agora,
      observacoes: input.observacoes?.trim() || null,
      finalidade_busca: preferenciasImovel?.finalidade_busca ?? null,
      tipo_imovel_busca: preferenciasImovel?.tipo_imovel_busca ?? null,
      bairros_interesse: preferenciasImovel?.bairros_interesse.length
        ? preferenciasImovel.bairros_interesse
        : null,
      quartos_minimo: preferenciasImovel?.quartos_minimo ?? null,
      suites_minimas: preferenciasImovel?.suites_minimas ?? null,
      banheiros_minimos: preferenciasImovel?.banheiros_minimos ?? null,
      vagas_minimas: preferenciasImovel?.vagas_minimas ?? null,
      valor_minimo: preferenciasImovel?.valor_minimo ?? null,
      valor_maximo: preferenciasImovel?.valor_maximo ?? null,
    })
    .select("id")
    .single();

  if (error || !novoLead) {
    console.error("[integracao-lead] insert failed", error);
    throw new Error("Não foi possível registrar o lead.");
  }

  await registrarInteracaoIntegracao(
    supabase,
    novoLead.id,
    input.corretorId,
    `Atendimento ${codigo} criado via integração (${origem}).`,
  );

  let imovelAdicionado = false;
  if (input.imovelId) {
    imovelAdicionado = await garantirImovelSelecionado(
      supabase,
      novoLead.id,
      input.imovelId,
      input.corretorId,
      true,
    );
  }

  return {
    leadId: novoLead.id,
    criado: true,
    imovelAdicionado,
  };
}
