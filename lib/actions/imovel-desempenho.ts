"use server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { logPostgrestError } from "@/lib/supabase/postgrest-error";
import { createClient } from "@/lib/supabase/server";
import type {
  AuditoriaImovel,
  ImovelDesempenho,
  ImovelDesempenhoFunilItem,
  ImovelDesempenhoOrigemItem,
  ImovelDesempenhoParecerItem,
} from "@/types";

const ETAPA_LABELS: Record<string, string> = {
  novo: "Novo",
  contato_feito: "Contato feito",
  qualificado: "Qualificado",
  visita_agendada: "Visita agendada",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const ORIGEM_LABELS: Record<string, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  portal: "Portal",
  indicacao: "Indicação",
  manual: "Manual",
};

const PARECER_LABELS: Record<string, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
};

export async function getAuditoriaImovel(imovelId: string): Promise<AuditoriaImovel[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("auditoria_imovel")
    .select("*, perfil:perfis(*)")
    .eq("imovel_id", imovelId)
    .eq("corretor_id", corretor.id)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[getAuditoriaImovel] failed", error);
    return [];
  }

  return (data ?? []) as AuditoriaImovel[];
}

export async function getImovelDesempenho(imovelId: string): Promise<ImovelDesempenho | null> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return null;
  }

  const supabase = await createClient();

  const [
    imovelRes,
    leadsDiretosRes,
    selecionadosRes,
    visitasRes,
    propostasRes,
    negociosRes,
  ] = await Promise.all([
    supabase
      .from("imoveis")
      .select("visualizacoes")
      .eq("id", imovelId)
      .eq("corretor_id", corretor.id)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("id, etapa, origem")
      .eq("corretor_id", corretor.id)
      .eq("imovel_id", imovelId),
    supabase
      .from("lead_imoveis_selecionados")
      .select("lead_id, lead:leads(id, etapa, origem)")
      .eq("corretor_id", corretor.id)
      .eq("imovel_id", imovelId),
    supabase
      .from("visitas")
      .select("status, parecer")
      .eq("corretor_id", corretor.id)
      .eq("imovel_id", imovelId),
    supabase
      .from("propostas")
      .select("id")
      .eq("corretor_id", corretor.id)
      .eq("imovel_id", imovelId),
    supabase
      .from("negocios")
      .select("id")
      .eq("corretor_id", corretor.id)
      .eq("imovel_id", imovelId)
      .eq("status", "fechado"),
  ]);

  if (!imovelRes.data) {
    return null;
  }

  type LeadResumo = { id: string; etapa: string; origem: string };
  const leadsMap = new Map<string, LeadResumo>();

  for (const lead of (leadsDiretosRes.data ?? []) as LeadResumo[]) {
    leadsMap.set(lead.id, lead);
  }

  for (const row of selecionadosRes.data ?? []) {
    const lead = row.lead as LeadResumo | LeadResumo[] | null;
    const resolved = Array.isArray(lead) ? lead[0] : lead;
    if (resolved?.id) {
      leadsMap.set(resolved.id, resolved);
    }
  }

  const leads = Array.from(leadsMap.values());
  const visitas = visitasRes.data ?? [];

  const funilMap = new Map<string, number>();
  for (const lead of leads) {
    funilMap.set(lead.etapa, (funilMap.get(lead.etapa) ?? 0) + 1);
  }

  const funil: ImovelDesempenhoFunilItem[] = Object.entries(ETAPA_LABELS).map(
    ([etapa, label]) => ({
      etapa,
      label,
      total: funilMap.get(etapa) ?? 0,
    }),
  );

  const origemMap = new Map<string, number>();
  for (const lead of leads) {
    origemMap.set(lead.origem, (origemMap.get(lead.origem) ?? 0) + 1);
  }

  const origem: ImovelDesempenhoOrigemItem[] = Object.entries(ORIGEM_LABELS).map(
    ([origemKey, label]) => ({
      origem: origemKey,
      label,
      total: origemMap.get(origemKey) ?? 0,
    }),
  ).filter((item) => item.total > 0);

  const parecerMap = new Map<string, number>();
  for (const visita of visitas) {
    if (visita.parecer) {
      parecerMap.set(visita.parecer, (parecerMap.get(visita.parecer) ?? 0) + 1);
    }
  }

  const visitasParecer: ImovelDesempenhoParecerItem[] = Object.entries(PARECER_LABELS).map(
    ([parecer, label]) => ({
      parecer,
      label,
      total: parecerMap.get(parecer) ?? 0,
    }),
  );

  const visitasAgendadas = visitas.filter((v) => v.status === "agendada").length;
  const visitasRealizadas = visitas.filter((v) => v.status === "realizada").length;

  return {
    kpis: {
      totalLeads: leads.length,
      visitasAgendadas,
      visitasRealizadas,
      propostas: propostasRes.data?.length ?? 0,
      negociosFechados: negociosRes.data?.length ?? 0,
      visualizacoes: imovelRes.data.visualizacoes ?? 0,
    },
    funil,
    origem,
    visitasParecer,
  };
}

export async function countImoveisAguardandoAprovacao(): Promise<number> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return 0;
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", corretor.id)
    .eq("status_aprovacao", "aguardando_aprovacao");

  if (!error) {
    return count ?? 0;
  }

  logPostgrestError("countImoveisAguardandoAprovacao", error);

  try {
    const admin = createServiceRoleClient();
    const { count: fallbackCount, error: fallbackError } = await admin
      .from("imoveis")
      .select("id", { count: "exact", head: true })
      .eq("corretor_id", corretor.id)
      .eq("status_aprovacao", "aguardando_aprovacao");

    if (fallbackError) {
      logPostgrestError("countImoveisAguardandoAprovacao:fallback", fallbackError);
      return 0;
    }

    return fallbackCount ?? 0;
  } catch (fallbackError) {
    console.error("[countImoveisAguardandoAprovacao] service role fallback unavailable", fallbackError);
    return 0;
  }
}
