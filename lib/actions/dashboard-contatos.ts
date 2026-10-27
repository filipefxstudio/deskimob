"use server";

import { calcChangePercent, resolvePeriodRange, type DashboardPeriodPreset } from "@/lib/dashboard/period";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";
import type { DashboardTab } from "@/lib/actions/dashboard";

export interface DashboardContatoDiaItem {
  dia: string;
  label: string;
  total: number;
}

export interface DashboardContatoFaixaItem {
  id: string;
  label: string;
  count: number;
  percent: number;
  alerta?: boolean;
}

export interface DashboardContatoPorCorretorItem {
  perfilId: string | null;
  nome: string;
  leadsContatados: number;
  tempoMedioMs: number | null;
}

export interface DashboardContatoMetricas {
  leadsContatados: number;
  leadsContatadosAnterior: number;
  changePercent: number | null;
  serieDiaria: DashboardContatoDiaItem[];
  tempoMedioMs: number | null;
  tempoMedianoMs: number | null;
  intervalosTotal: number;
  faixas: DashboardContatoFaixaItem[];
  porCorretor: DashboardContatoPorCorretorItem[];
  verTabelaCorretores: boolean;
}

function finalidadeFromTab(tab: DashboardTab): "compra" | "locacao" {
  return tab === "venda" ? "compra" : "locacao";
}

function formatDiaLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!day || !month) return isoDate;
  return `${day}/${month}`;
}

function emptyMetricas(): DashboardContatoMetricas {
  return {
    leadsContatados: 0,
    leadsContatadosAnterior: 0,
    changePercent: 0,
    serieDiaria: [],
    tempoMedioMs: null,
    tempoMedianoMs: null,
    intervalosTotal: 0,
    faixas: [],
    porCorretor: [],
    verTabelaCorretores: false,
  };
}

type RpcRow = {
  leads_contatados?: number;
  leads_contatados_anterior?: number;
  serie_diaria?: { dia: string; total: number }[];
  tempo_medio_ms?: number | null;
  tempo_mediano_ms?: number | null;
  intervalos_total?: number;
  faixas?: {
    ate_24h?: number;
    de_1_a_3_dias?: number;
    de_3_a_7_dias?: number;
    mais_7_dias?: number;
  };
  por_corretor?: {
    perfil_id?: string | null;
    nome?: string;
    leads_contatados?: number;
    tempo_medio_ms?: number | null;
  }[];
  ver_tabela_corretores?: boolean;
};

export async function fetchDashboardContatoMetricas(
  tab: DashboardTab,
  params: {
    periodPreset: DashboardPeriodPreset;
    customStart?: string;
    customEnd?: string;
    perfilFiltro?: string;
  },
): Promise<DashboardContatoMetricas> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return emptyMetricas();
  }

  const { start, end, previousStart, previousEnd } = resolvePeriodRange(
    params.periodPreset,
    params.customStart,
    params.customEnd,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_contato_metricas", {
    p_corretor_id: corretor.id,
    p_periodo_inicio: start.toISOString(),
    p_periodo_fim: end.toISOString(),
    p_periodo_anterior_inicio: previousStart.toISOString(),
    p_periodo_anterior_fim: previousEnd.toISOString(),
    p_finalidade: finalidadeFromTab(tab),
    p_perfil_filtro: params.perfilFiltro ?? null,
  });

  if (error) {
    console.error("[fetchDashboardContatoMetricas]", error);
    return emptyMetricas();
  }

  const row = (data ?? {}) as RpcRow;
  const leadsContatados = row.leads_contatados ?? 0;
  const leadsContatadosAnterior = row.leads_contatados_anterior ?? 0;

  const faixaDefs = [
    { id: "ate_24h", label: "Até 24h", key: "ate_24h" as const },
    { id: "de_1_a_3", label: "1 a 3 dias", key: "de_1_a_3_dias" as const },
    { id: "de_3_a_7", label: "3 a 7 dias", key: "de_3_a_7_dias" as const },
    { id: "mais_7", label: "Mais de 7 dias", key: "mais_7_dias" as const, alerta: true },
  ];

  const faixasRaw = row.faixas ?? {};
  const faixaTotal = faixaDefs.reduce(
    (sum, def) => sum + (faixasRaw[def.key] ?? 0),
    0,
  );

  const faixas: DashboardContatoFaixaItem[] = faixaDefs.map((def) => {
    const count = faixasRaw[def.key] ?? 0;
    return {
      id: def.id,
      label: def.label,
      count,
      percent: faixaTotal > 0 ? (count / faixaTotal) * 100 : 0,
      alerta: def.alerta,
    };
  });

  const serieDiaria = (row.serie_diaria ?? []).map((item) => ({
    dia: item.dia,
    label: formatDiaLabel(String(item.dia)),
    total: item.total ?? 0,
  }));

  return {
    leadsContatados,
    leadsContatadosAnterior,
    changePercent: calcChangePercent(leadsContatados, leadsContatadosAnterior),
    serieDiaria,
    tempoMedioMs: row.tempo_medio_ms ?? null,
    tempoMedianoMs: row.tempo_mediano_ms ?? null,
    intervalosTotal: row.intervalos_total ?? 0,
    faixas,
    porCorretor: (row.por_corretor ?? []).map((item) => ({
      perfilId: item.perfil_id ?? null,
      nome: item.nome?.trim() || "Sem nome",
      leadsContatados: item.leads_contatados ?? 0,
      tempoMedioMs: item.tempo_medio_ms ?? null,
    })),
    verTabelaCorretores: Boolean(row.ver_tabela_corretores),
  };
}
