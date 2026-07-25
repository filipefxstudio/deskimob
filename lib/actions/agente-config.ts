"use server";

import { processarAgenteIA } from "@/lib/agente";
import { processarAnthropic } from "@/lib/agente/provedores/anthropic";
import { processarGemini } from "@/lib/agente/provedores/gemini";
import { processarOpenAI } from "@/lib/agente/provedores/openai";
import {
  API_KEY_MASK,
  MODELO_PADRAO_POR_PROVEDOR,
  MODELOS_POR_PROVEDOR,
} from "@/lib/constants/agente";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { logPostgrestError } from "@/lib/supabase/postgrest-error";
import { createClient } from "@/lib/supabase/server";
import type {
  AgenteConfig,
  Assinatura,
  Corretor,
  Imovel,
  Lead,
  LeadInteracao,
  PlanoAssinatura,
  ProvedorIA,
  RespostaAgente,
  TomAgente,
} from "@/types";

export type AgenteConfigPublic = Omit<AgenteConfig, "api_key"> & {
  has_api_key: boolean;
};

export type SaveAgenteConfigInput = {
  ativo: boolean;
  nome_agente: string;
  tom: TomAgente;
  provedor: ProvedorIA;
  modelo: string;
  api_key?: string;
  instrucoes_customizadas?: string | null;
  horario_inicio: string;
  horario_fim: string;
  agendar_visitas: boolean;
};

export type ActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
};

function obterPlanoAtivo(assinaturas: Assinatura[] | undefined): PlanoAssinatura {
  const ativa = assinaturas?.find((item) => item.status === "ativo");
  return ativa?.plano ?? "basico";
}

async function fetchAssinaturasForCorretor(corretorId: string): Promise<Assinatura[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("corretor_id", corretorId);

  if (!error) {
    return (data as Assinatura[] | null) ?? [];
  }

  logPostgrestError("fetchAssinaturasForCorretor", error);

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackData, error: fallbackError } = await admin
      .from("assinaturas")
      .select("*")
      .eq("corretor_id", corretorId);

    if (fallbackError) {
      logPostgrestError("fetchAssinaturasForCorretor:fallback", fallbackError);
      return [];
    }

    console.warn("[fetchAssinaturasForCorretor] used service role fallback", { corretorId });
    return (fallbackData as Assinatura[] | null) ?? [];
  } catch (fallbackError) {
    console.error("[fetchAssinaturasForCorretor] service role fallback unavailable", fallbackError);
    return [];
  }
}

async function fetchAgenteConfigRow(corretorId: string): Promise<AgenteConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agente_config")
    .select("*")
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (!error) {
    return (data as AgenteConfig | null) ?? null;
  }

  logPostgrestError("fetchAgenteConfigRow", error);

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackData, error: fallbackError } = await admin
      .from("agente_config")
      .select("*")
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (fallbackError) {
      logPostgrestError("fetchAgenteConfigRow:fallback", fallbackError);
      return null;
    }

    console.warn("[fetchAgenteConfigRow] used service role fallback", { corretorId });
    return (fallbackData as AgenteConfig | null) ?? null;
  } catch (fallbackError) {
    console.error("[fetchAgenteConfigRow] service role fallback unavailable", fallbackError);
    return null;
  }
}

async function verificarCorretorAutorizado(
  corretorId: string,
): Promise<{ corretor: Corretor; plano: PlanoAssinatura } | { error: string }> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  if (corretor.id !== corretorId) {
    return { error: "Acesso não autorizado." };
  }

  const assinaturas = await fetchAssinaturasForCorretor(corretor.id);

  return {
    corretor,
    plano: obterPlanoAtivo(assinaturas),
  };
}

function criarConfigPadrao(corretorId: string): AgenteConfigPublic {
  return {
    id: "",
    corretor_id: corretorId,
    ativo: false,
    nome_agente: "Assistente Virtual",
    tom: "profissional",
    provedor: "openai",
    modelo: MODELO_PADRAO_POR_PROVEDOR.openai,
    instrucoes_customizadas: null,
    horario_inicio: "08:00",
    horario_fim: "22:00",
    agendar_visitas: true,
    has_api_key: false,
  };
}

function normalizarHorario(horario: string): string {
  return horario.slice(0, 5);
}

function sanitizarConfig(
  config: AgenteConfig | null,
  corretorId: string,
): AgenteConfigPublic {
  if (!config) {
    return criarConfigPadrao(corretorId);
  }

  const { api_key: _apiKey, ...resto } = config;

  return {
    ...resto,
    horario_inicio: normalizarHorario(resto.horario_inicio),
    horario_fim: normalizarHorario(resto.horario_fim),
    has_api_key: Boolean(_apiKey),
  };
}

function isApiKeyPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === API_KEY_MASK;
}

export async function getAgenteConfig(
  corretorId: string,
): Promise<AgenteConfigPublic | { error: string }> {
  const auth = await verificarCorretorAutorizado(corretorId);

  if ("error" in auth) {
    return { error: auth.error };
  }

  const data = await fetchAgenteConfigRow(corretorId);
  return sanitizarConfig(data, corretorId);
}

export async function saveAgenteConfig(
  data: SaveAgenteConfigInput,
): Promise<ActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { data: assinaturas, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("corretor_id", corretor.id);

  if (assinaturaError) {
    return { error: "Não foi possível verificar seu plano." };
  }

  const plano = obterPlanoAtivo(assinaturas ?? undefined);

  if (plano !== "profissional") {
    return {
      error: "O agente de IA está disponível apenas no plano Profissional.",
    };
  }

  const modelosValidos = MODELOS_POR_PROVEDOR[data.provedor];

  if (!modelosValidos.includes(data.modelo)) {
    return { error: "Modelo inválido para o provedor selecionado." };
  }

  const { data: existente, error: buscaError } = await supabase
    .from("agente_config")
    .select("id, api_key")
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (buscaError) {
    return { error: "Não foi possível salvar a configuração do agente." };
  }

  const payload: Record<string, string | boolean | null> = {
    corretor_id: corretor.id,
    ativo: data.ativo,
    nome_agente: data.nome_agente.trim() || "Assistente Virtual",
    tom: data.tom,
    provedor: data.provedor,
    modelo: data.modelo,
    instrucoes_customizadas: data.instrucoes_customizadas?.trim() || null,
    horario_inicio: data.horario_inicio,
    horario_fim: data.horario_fim,
    agendar_visitas: data.agendar_visitas,
  };

  if (!isApiKeyPlaceholder(data.api_key)) {
    payload.api_key = data.api_key!.trim();
  } else if (!existente?.api_key && data.ativo) {
    return {
      error: "Informe a chave de API antes de ativar o agente.",
    };
  }

  let dbError;

  if (existente?.id) {
    const { error } = await supabase
      .from("agente_config")
      .update(payload)
      .eq("id", existente.id)
      .eq("corretor_id", corretor.id);

    dbError = error;
  } else {
    const { error } = await supabase.from("agente_config").insert(payload);
    dbError = error;
  }

  if (dbError) {
    return { error: "Não foi possível salvar a configuração do agente." };
  }

  return { success: true, message: "Configurações do agente salvas com sucesso." };
}

export async function testarConexaoIA(
  provedor: ProvedorIA,
  modelo: string,
  apiKey: string,
): Promise<ActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { data: assinaturas, error: assinaturaError } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("corretor_id", corretor.id);

  if (assinaturaError) {
    return { error: "Não foi possível verificar seu plano." };
  }

  if (obterPlanoAtivo(assinaturas ?? undefined) !== "profissional") {
    return { error: "Recurso disponível apenas no plano Profissional." };
  }

  let chave = apiKey.trim();

  if (isApiKeyPlaceholder(chave)) {
    const { data: config, error } = await supabase
      .from("agente_config")
      .select("api_key")
      .eq("corretor_id", corretor.id)
      .maybeSingle();

    if (error || !config?.api_key) {
      return { error: "Informe uma chave de API para testar a conexão." };
    }

    chave = config.api_key;
  }

  const modelosValidos = MODELOS_POR_PROVEDOR[provedor];

  if (!modelosValidos.includes(modelo)) {
    return { error: "Modelo inválido para o provedor selecionado." };
  }

  const configTeste: AgenteConfig = {
    id: "teste",
    corretor_id: corretor.id,
    ativo: true,
    nome_agente: "Teste",
    tom: "profissional",
    provedor,
    modelo,
    api_key: chave,
    horario_inicio: "00:00",
    horario_fim: "23:59",
    agendar_visitas: false,
  };

  const historico: LeadInteracao[] = [];
  const mensagemTeste = "Responda apenas com a palavra OK.";

  try {
    switch (provedor) {
      case "openai":
        await processarOpenAI(
          "Você é um assistente de teste.",
          mensagemTeste,
          historico,
          configTeste,
        );
        break;
      case "anthropic":
        await processarAnthropic(
          "Você é um assistente de teste.",
          mensagemTeste,
          historico,
          configTeste,
        );
        break;
      case "gemini":
        await processarGemini(
          "Você é um assistente de teste.",
          mensagemTeste,
          historico,
          configTeste,
        );
        break;
    }

    return { success: true, message: "Conexão com a IA estabelecida com sucesso." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao testar conexão com a IA.";

    return { error: message };
  }
}

function criarLeadTeste(corretorId: string): Lead {
  const agora = new Date().toISOString();

  return {
    id: "teste-agente",
    corretor_id: corretorId,
    nome: "Cliente Teste",
    telefone: "11999999999",
    finalidade_busca: "venda",
    tipo_imovel_busca: "apartamento",
    bairros_interesse: ["Centro", "Jardins"],
    quartos_minimo: 2,
    valor_maximo: 650000,
    etapa: "qualificado",
    temperatura: "indefinido",
    origem: "whatsapp",
    atendido_por: "agente_ia",
    criado_em: agora,
    atualizado_em: agora,
  };
}

function criarImoveisExemplo(corretorId: string): Imovel[] {
  const agora = new Date().toISOString();

  return [
    {
      id: "imovel-teste-1",
      corretor_id: corretorId,
      titulo: "Apartamento 2 quartos no Centro",
      tipo: "apartamento",
      finalidade: "venda",
      status: "disponivel",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      quartos: 2,
      suites: 0,
      banheiros: 1,
      vagas: 1,
      valor_venda: 480000,
      publicado_site: true,
      visualizacoes: 0,
      criado_em: agora,
      atualizado_em: agora,
    },
    {
      id: "imovel-teste-2",
      corretor_id: corretorId,
      titulo: "Casa 3 quartos nos Jardins",
      tipo: "casa",
      finalidade: "venda",
      status: "disponivel",
      bairro: "Jardins",
      cidade: "São Paulo",
      estado: "SP",
      quartos: 3,
      suites: 1,
      banheiros: 3,
      vagas: 2,
      valor_venda: 980000,
      publicado_site: true,
      visualizacoes: 0,
      criado_em: agora,
      atualizado_em: agora,
    },
  ];
}

function criarHistoricoTeste(corretorId: string): LeadInteracao[] {
  const agora = new Date().toISOString();

  return [
    {
      id: "interacao-teste-1",
      lead_id: "teste-agente",
      corretor_id: corretorId,
      tipo: "mensagem_whatsapp",
      conteudo: "Olá, estou procurando um apartamento para comprar.",
      de: "lead",
      criado_em: agora,
    },
    {
      id: "interacao-teste-2",
      lead_id: "teste-agente",
      corretor_id: corretorId,
      tipo: "mensagem_whatsapp",
      conteudo: "Claro! Posso te ajudar. Qual bairro você prefere?",
      de: "agente_ia",
      criado_em: agora,
    },
  ];
}

export async function testarAgente(
  mensagem: string,
): Promise<{ resposta?: RespostaAgente; error?: string }> {
  const texto = mensagem.trim();

  if (!texto) {
    return { error: "Digite uma mensagem para testar o agente." };
  }

  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();

  const [{ data: assinaturas, error: assinaturaError }, { data: configRaw, error: configError }] =
    await Promise.all([
      supabase.from("assinaturas").select("*").eq("corretor_id", corretor.id),
      supabase.from("agente_config").select("*").eq("corretor_id", corretor.id).maybeSingle(),
    ]);

  if (assinaturaError || configError) {
    return { error: "Não foi possível carregar os dados do agente." };
  }

  if (obterPlanoAtivo(assinaturas ?? undefined) !== "profissional") {
    return { error: "Recurso disponível apenas no plano Profissional." };
  }

  const config = configRaw as AgenteConfig | null;

  if (!config?.api_key) {
    return { error: "Configure e salve a chave de API antes de testar o agente." };
  }

  const { data: imoveisDb, error: imoveisError } = await supabase
    .from("imoveis")
    .select("*")
    .eq("corretor_id", corretor.id)
    .eq("status", "disponivel")
    .limit(5);

  if (imoveisError) {
    return { error: "Não foi possível carregar imóveis para o teste." };
  }

  const lead = criarLeadTeste(corretor.id);
  const imoveis =
    imoveisDb && imoveisDb.length > 0
      ? (imoveisDb as Imovel[])
      : criarImoveisExemplo(corretor.id);
  const historico = criarHistoricoTeste(corretor.id);

  const configTeste: AgenteConfig = {
    ...config,
    horario_inicio: "00:00",
    horario_fim: "23:59",
  };

  try {
    const resposta = await processarAgenteIA(
      texto,
      lead,
      corretor,
      configTeste,
      imoveis,
      historico,
    );

    return { resposta };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao processar mensagem com o agente.";

    return { error: message };
  }
}

export async function getPlanoCorretor(
  corretorId: string,
): Promise<PlanoAssinatura | { error: string }> {
  const auth = await verificarCorretorAutorizado(corretorId);

  if ("error" in auth) {
    return { error: auth.error };
  }

  return auth.plano;
}
