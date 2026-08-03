"use server";

import { getAgendaHoje, getVisitasProximas24h } from "@/lib/actions/agenda";
import { getDashboardConfig } from "@/lib/actions/dashboard-config";
import { DEFAULT_DASHBOARD_CONFIG } from "@/lib/constants/dashboard";
import {
  buildSparklineBuckets,
  calcChangePercent,
  isDateInRange,
  resolvePeriodRange,
  type DashboardPeriodPreset,
} from "@/lib/dashboard/period";
import { formatOrigemDisplay, getUltimaAtividadeEm, isLeadAtivo } from "@/lib/leads/format";
import { leadMatchesEtapaFilter } from "@/lib/leads/etapa-order";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import {
  createTenantDataClient,
  leadVisivelParaUsuario,
  resolveTenantAccess,
  type TenantDbClient,
} from "@/lib/supabase/tenant-access";
import { createClient } from "@/lib/supabase/server";
import type { DashboardConfig, EtapaLead, FinalidadeImovel, Imovel, Lead, Negocio } from "@/types";

export type DashboardTab = "venda" | "locacao";

export type DashboardKPIFormat = "number" | "currency" | "duration";

export interface DashboardKPIItem {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  changePercent: number | null;
  sparkline: number[];
  format: DashboardKPIFormat;
  href?: string;
}

export interface DashboardFunilItem {
  id: string;
  label: string;
  count: number;
  href: string;
}

export interface DashboardChartSlice {
  label: string;
  value: number;
  color: string;
  href?: string;
}

export interface DashboardBarItem {
  label: string;
  count: number;
  color: string;
  href?: string;
}

export interface DashboardAlertaItem {
  id: string;
  mensagem: string;
  acaoLabel: string;
  href: string;
  tipo: "warning" | "info" | "danger";
}

export interface DashboardData {
  kpis: DashboardKPIItem[];
  funil: DashboardFunilItem[];
  temperatura: DashboardChartSlice[];
  qualidade: DashboardChartSlice[];
  tempoInteracao: DashboardChartSlice[];
  origem: DashboardBarItem[];
  captacoes: DashboardChartSlice[];
  imoveisDesatualizados: DashboardChartSlice[];
  rankingImoveisBairro: DashboardBarItem[];
  bairrosLeads: DashboardBarItem[];
  alertas: DashboardAlertaItem[];
}

export interface GetDashboardDataParams {
  periodPreset: DashboardPeriodPreset;
  customStart?: string;
  customEnd?: string;
  tab: DashboardTab;
}

interface PeriodMetrics {
  leadsAtivos: number;
  leadsNovos: number;
  imoveisAtivos: number;
  tempoMedioPrimeiroContatoMs: number;
  comissaoPrevista: number;
  comissaoRecebida: number;
  sparklineLeadsAtivos: string[];
  sparklineLeadsNovos: string[];
  sparklineImoveisAtivos: string[];
  sparklineTempoContato: string[];
  sparklineComissaoPrevista: string[];
  sparklineComissaoRecebida: string[];
}

type LeadRow = Lead & { imovel?: { titulo?: string | null } | null };
type ImovelRow = Pick<
  Imovel,
  | "id"
  | "status"
  | "finalidade"
  | "bairro"
  | "data_ativacao"
  | "data_desativacao"
  | "data_ultima_atualizacao"
  | "criado_em"
  | "local_chaves"
>;
type InteracaoRow = { lead_id: string; criado_em: string };
type NegocioRow = Pick<
  Negocio,
  "valor_comissao" | "data_prevista_comissao" | "data_recebimento_comissao" | "status" | "lead_id"
> & { lead?: { finalidade_busca?: string | null } | null };

function finalidadeLeadFromTab(tab: DashboardTab): "compra" | "locacao" {
  return tab === "venda" ? "compra" : "locacao";
}

function finalidadeImovelFromTab(tab: DashboardTab): FinalidadeImovel {
  return tab === "venda" ? "venda" : "locacao";
}

function isImovelDisponivel(imovel: ImovelRow): boolean {
  return imovel.status === "disponivel";
}

function getImovelReferenciaAtualizacao(imovel: ImovelRow): string {
  return imovel.data_ultima_atualizacao ?? imovel.criado_em;
}

function daysSince(isoDate: string, reference: Date = new Date()): number {
  const diffMs = reference.getTime() - new Date(isoDate).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getUltimaInteracaoLead(
  lead: LeadRow,
  interacoesPorLead: Map<string, string>,
): string {
  const ultimaInteracao = interacoesPorLead.get(lead.id);
  if (ultimaInteracao) return ultimaInteracao;
  return getUltimaAtividadeEm(lead);
}

function computePeriodMetrics(
  leads: LeadRow[],
  imoveis: ImovelRow[],
  interacoesPorLead: Map<string, { first: string; last: string }>,
  negocios: NegocioRow[],
  finalidadeLead: "compra" | "locacao",
  start: Date,
  end: Date,
): PeriodMetrics {
  const leadsFiltered = leads.filter((l) => l.finalidade_busca === finalidadeLead);
  const imoveisFiltered = imoveis.filter((i) =>
    finalidadeLead === "compra" ? i.finalidade === "venda" : i.finalidade === "locacao",
  );

  const leadsAtivosList = leadsFiltered.filter(isLeadAtivo);
  const leadsNovosList = leadsFiltered.filter((l) => isDateInRange(l.criado_em, start, end));
  const imoveisAtivosList = imoveisFiltered.filter(isImovelDisponivel);

  const temposContato: number[] = [];
  const sparklineTempoContato: string[] = [];

  for (const lead of leadsFiltered) {
    if (!isDateInRange(lead.criado_em, start, end)) continue;
    const interacao = interacoesPorLead.get(lead.id);
    if (!interacao) continue;
    const diffMs = new Date(interacao.first).getTime() - new Date(lead.criado_em).getTime();
    if (diffMs >= 0) {
      temposContato.push(diffMs);
      sparklineTempoContato.push(interacao.first);
    }
  }

  const tempoMedioPrimeiroContatoMs =
    temposContato.length > 0
      ? temposContato.reduce((sum, value) => sum + value, 0) / temposContato.length
      : 0;

  let comissaoPrevista = 0;
  let comissaoRecebida = 0;
  const sparklineComissaoPrevista: string[] = [];
  const sparklineComissaoRecebida: string[] = [];

  for (const negocio of negocios) {
    if (negocio.status !== "fechado") continue;
    const valor = negocio.valor_comissao ?? 0;

    if (
      negocio.data_prevista_comissao &&
      !negocio.data_recebimento_comissao &&
      isDateInRange(negocio.data_prevista_comissao, start, end)
    ) {
      comissaoPrevista += valor;
      sparklineComissaoPrevista.push(negocio.data_prevista_comissao);
    }

    if (
      negocio.data_recebimento_comissao &&
      isDateInRange(negocio.data_recebimento_comissao, start, end)
    ) {
      comissaoRecebida += valor;
      sparklineComissaoRecebida.push(negocio.data_recebimento_comissao);
    }
  }

  return {
    leadsAtivos: leadsAtivosList.length,
    leadsNovos: leadsNovosList.length,
    imoveisAtivos: imoveisAtivosList.length,
    tempoMedioPrimeiroContatoMs,
    comissaoPrevista,
    comissaoRecebida,
    sparklineLeadsAtivos: leadsAtivosList.map((l) => getUltimaAtividadeEm(l)),
    sparklineLeadsNovos: leadsNovosList.map((l) => l.criado_em),
    sparklineImoveisAtivos: imoveisAtivosList.map((i) => getImovelReferenciaAtualizacao(i)),
    sparklineTempoContato,
    sparklineComissaoPrevista,
    sparklineComissaoRecebida,
  };
}

function buildKpis(
  current: PeriodMetrics,
  previous: PeriodMetrics,
  periodStart: Date,
  periodEnd: Date,
  finalidadeLead: "compra" | "locacao",
): DashboardKPIItem[] {
  const baseHref = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;

  return [
    {
      id: "leads-ativos",
      label: "Leads ativos",
      value: current.leadsAtivos,
      previousValue: previous.leadsAtivos,
      changePercent: calcChangePercent(current.leadsAtivos, previous.leadsAtivos),
      sparkline: buildSparklineBuckets(current.sparklineLeadsAtivos, periodStart, periodEnd),
      format: "number",
      href: baseHref,
    },
    {
      id: "leads-novos",
      label: "Leads novos",
      value: current.leadsNovos,
      previousValue: previous.leadsNovos,
      changePercent: calcChangePercent(current.leadsNovos, previous.leadsNovos),
      sparkline: buildSparklineBuckets(current.sparklineLeadsNovos, periodStart, periodEnd),
      format: "number",
      href: `${baseHref}&etapa=novo`,
    },
    {
      id: "imoveis-ativos",
      label: "Imóveis ativos",
      value: current.imoveisAtivos,
      previousValue: previous.imoveisAtivos,
      changePercent: calcChangePercent(current.imoveisAtivos, previous.imoveisAtivos),
      sparkline: buildSparklineBuckets(current.sparklineImoveisAtivos, periodStart, periodEnd),
      format: "number",
      href: "/dashboard/imoveis",
    },
    {
      id: "tempo-primeiro-contato",
      label: "Tempo médio 1º contato",
      value: current.tempoMedioPrimeiroContatoMs,
      previousValue: previous.tempoMedioPrimeiroContatoMs,
      changePercent: calcChangePercent(
        current.tempoMedioPrimeiroContatoMs,
        previous.tempoMedioPrimeiroContatoMs,
      ),
      sparkline: buildSparklineBuckets(current.sparklineTempoContato, periodStart, periodEnd),
      format: "duration",
      href: baseHref,
    },
    {
      id: "comissao-prevista",
      label: "Comissão prevista",
      value: current.comissaoPrevista,
      previousValue: previous.comissaoPrevista,
      changePercent: calcChangePercent(current.comissaoPrevista, previous.comissaoPrevista),
      sparkline: buildSparklineBuckets(
        current.sparklineComissaoPrevista,
        periodStart,
        periodEnd,
      ),
      format: "currency",
    },
    {
      id: "comissao-recebida",
      label: "Comissão recebida",
      value: current.comissaoRecebida,
      previousValue: previous.comissaoRecebida,
      changePercent: calcChangePercent(current.comissaoRecebida, previous.comissaoRecebida),
      sparkline: buildSparklineBuckets(
        current.sparklineComissaoRecebida,
        periodStart,
        periodEnd,
      ),
      format: "currency",
    },
  ];
}

function buildFunil(
  leads: LeadRow[],
  finalidadeLead: "compra" | "locacao",
  tab: DashboardTab,
): DashboardFunilItem[] {
  const filtered = leads.filter((l) => l.finalidade_busca === finalidadeLead);
  const base = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;

  const etapaCount = (etapas: EtapaLead[]) =>
    filtered.filter((l) => etapas.includes(l.etapa)).length;

  return [
    {
      id: "leads",
      label: "Leads",
      count: filtered.filter(isLeadAtivo).length,
      href: base,
    },
    {
      id: "contato",
      label: "Contato",
      count: etapaCount(["contato_feito"]),
      href: `${base}&etapa=contato_feito`,
    },
    {
      id: "qualificado",
      label: "Qualificado",
      count: etapaCount(["qualificado"]),
      href: `${base}&etapa=qualificado`,
    },
    {
      id: "visita",
      label: "Visita",
      count: etapaCount(["visita_agendada"]),
      href: `${base}&etapa=visita_agendada`,
    },
    {
      id: "proposta",
      label: "Proposta",
      count: etapaCount(["proposta", "negociacao"]),
      href: `${base}&etapa=proposta`,
    },
    {
      id: "venda",
      label: tab === "venda" ? "Venda" : "Locação",
      count: filtered.filter((l) => leadMatchesEtapaFilter(l, "venda")).length,
      href: `${base}&etapa=venda`,
    },
    {
      id: "perdido",
      label: "Perdido",
      count: etapaCount(["perdido"]),
      href: `${base}&etapa=perdido`,
    },
  ];
}

function buildTemperatura(
  leads: LeadRow[],
  finalidadeLead: "compra" | "locacao",
): DashboardChartSlice[] {
  const ativos = leads.filter(
    (l) => l.finalidade_busca === finalidadeLead && isLeadAtivo(l),
  );
  const base = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;

  const count = (temp: string) => ativos.filter((l) => l.temperatura === temp).length;

  return [
    { label: "Quente", value: count("quente"), color: "#E63946", href: `${base}&temperatura=quente` },
    { label: "Morno", value: count("morno"), color: "#F18F01", href: `${base}&temperatura=morno` },
    { label: "Frio", value: count("frio"), color: "#2E86AB", href: `${base}&temperatura=frio` },
    {
      label: "Indefinido",
      value: count("indefinido"),
      color: "#9CA3AF",
      href: `${base}&temperatura=indefinido`,
    },
  ];
}

function buildQualidade(
  leads: LeadRow[],
  finalidadeLead: "compra" | "locacao",
): DashboardChartSlice[] {
  const filtered = leads.filter((l) => l.finalidade_busca === finalidadeLead);
  const base = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;

  const qualificadosEtapas: EtapaLead[] = [
    "qualificado",
    "visita_agendada",
    "proposta",
    "negociacao",
    "venda",
    "fechado",
  ];

  const qualificados = filtered.filter((l) => qualificadosEtapas.includes(l.etapa)).length;
  const descartados = filtered.filter((l) => l.etapa === "perdido").length;
  const emAtendimento = filtered.filter(
    (l) => l.etapa !== "perdido" && !qualificadosEtapas.includes(l.etapa),
  ).length;

  return [
    {
      label: "Qualificados",
      value: qualificados,
      color: "#2DC653",
      href: `${base}&etapa=qualificado`,
    },
    {
      label: "Descartados",
      value: descartados,
      color: "#E63946",
      href: `${base}&etapa=perdido`,
    },
    {
      label: "Em atendimento",
      value: emAtendimento,
      color: "#2E86AB",
      href: base,
    },
  ];
}

function buildTempoInteracao(
  leads: LeadRow[],
  interacoesPorLead: Map<string, { first: string; last: string }>,
  config: DashboardConfig,
  finalidadeLead: "compra" | "locacao",
): DashboardChartSlice[] {
  const ativos = leads.filter(
    (l) => l.finalidade_busca === finalidadeLead && isLeadAtivo(l),
  );
  const base = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;
  const now = new Date();
  const lastByLead = new Map(
    Array.from(interacoesPorLead.entries()).map(([id, v]) => [id, v.last]),
  );

  let verde = 0;
  let amarelo = 0;
  let vermelho = 0;

  for (const lead of ativos) {
    const ultima = getUltimaInteracaoLead(lead, lastByLead);
    const dias = daysSince(ultima, now);

    if (dias <= config.leads_verde_dias) verde += 1;
    else if (dias <= config.leads_amarelo_dias) amarelo += 1;
    else vermelho += 1;
  }

  return [
    {
      label: `Até ${config.leads_verde_dias} dias`,
      value: verde,
      color: "#2DC653",
      href: base,
    },
    {
      label: `${config.leads_verde_dias + 1}–${config.leads_amarelo_dias} dias`,
      value: amarelo,
      color: "#F18F01",
      href: `${base}&sem_interacao=${config.leads_verde_dias}`,
    },
    {
      label: `+${config.leads_amarelo_dias} dias`,
      value: vermelho,
      color: "#E63946",
      href: `${base}&sem_interacao=${config.leads_amarelo_dias}`,
    },
  ];
}

function buildOrigem(
  leads: LeadRow[],
  finalidadeLead: "compra" | "locacao",
  start: Date,
  end: Date,
): DashboardBarItem[] {
  const ativos = leads.filter(
    (l) =>
      l.finalidade_busca === finalidadeLead &&
      isLeadAtivo(l) &&
      isDateInRange(l.criado_em, start, end),
  );

  const origemMap = new Map<string, number>();
  for (const lead of ativos) {
    const origem = formatOrigemDisplay(lead.origem);
    origemMap.set(origem, (origemMap.get(origem) ?? 0) + 1);
  }

  const colors = ["#1D3557", "#2E86AB", "#F18F01", "#E63946", "#2DC653", "#6C757D", "#457B9D", "#A8DADC"];
  const base = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;

  return Array.from(origemMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count], index) => ({
      label,
      count,
      color: colors[index % colors.length],
      href: base,
    }));
}

function buildCaptacoes(
  imoveis: ImovelRow[],
  finalidadeImovel: FinalidadeImovel,
  start: Date,
  end: Date,
): DashboardChartSlice[] {
  const filtered = imoveis.filter((i) => i.finalidade === finalidadeImovel);

  const ativados = filtered.filter(
    (i) => i.data_ativacao && isDateInRange(i.data_ativacao, start, end),
  ).length;

  const desativados = filtered.filter(
    (i) => i.data_desativacao && isDateInRange(i.data_desativacao, start, end),
  ).length;

  return [
    { label: "Ativados", value: ativados, color: "#2DC653" },
    { label: "Desativados", value: desativados, color: "#E63946" },
  ];
}

function buildImoveisDesatualizados(
  imoveis: ImovelRow[],
  finalidadeImovel: FinalidadeImovel,
  config: DashboardConfig,
): DashboardChartSlice[] {
  const disponiveis = imoveis.filter(
    (i) => i.finalidade === finalidadeImovel && isImovelDisponivel(i),
  );
  const now = new Date();

  let verde = 0;
  let amarelo = 0;
  let vermelho = 0;

  for (const imovel of disponiveis) {
    const referencia = getImovelReferenciaAtualizacao(imovel);
    const dias = daysSince(referencia, now);

    if (dias <= config.imoveis_verde_dias) verde += 1;
    else if (dias <= config.imoveis_amarelo_dias) amarelo += 1;
    else vermelho += 1;
  }

  return [
    {
      label: `Até ${config.imoveis_verde_dias} dias`,
      value: verde,
      color: "#2DC653",
      href: "/dashboard/imoveis",
    },
    {
      label: `${config.imoveis_verde_dias + 1}–${config.imoveis_amarelo_dias} dias`,
      value: amarelo,
      color: "#F18F01",
      href: "/dashboard/imoveis",
    },
    {
      label: `+${config.imoveis_amarelo_dias} dias`,
      value: vermelho,
      color: "#E63946",
      href: "/dashboard/imoveis",
    },
  ];
}

function buildRankingImoveisBairro(
  imoveis: ImovelRow[],
  finalidadeImovel: FinalidadeImovel,
): DashboardBarItem[] {
  const disponiveis = imoveis.filter(
    (i) => i.finalidade === finalidadeImovel && isImovelDisponivel(i) && i.bairro,
  );

  const bairroMap = new Map<string, number>();
  for (const imovel of disponiveis) {
    const bairro = imovel.bairro!.trim();
    bairroMap.set(bairro, (bairroMap.get(bairro) ?? 0) + 1);
  }

  const colors = ["#1D3557", "#2E86AB", "#F18F01", "#E63946", "#2DC653"];

  return Array.from(bairroMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count], index) => ({
      label,
      count,
      color: colors[index % colors.length],
      href: `/dashboard/imoveis?bairro=${encodeURIComponent(label)}`,
    }));
}

function buildBairrosLeads(
  leads: LeadRow[],
  finalidadeLead: "compra" | "locacao",
): DashboardBarItem[] {
  const ativos = leads.filter(
    (l) => l.finalidade_busca === finalidadeLead && isLeadAtivo(l),
  );

  const bairroMap = new Map<string, number>();
  for (const lead of ativos) {
    for (const bairro of lead.bairros_interesse ?? []) {
      const nome = bairro.trim();
      if (!nome) continue;
      bairroMap.set(nome, (bairroMap.get(nome) ?? 0) + 1);
    }
  }

  const colors = ["#457B9D", "#2E86AB", "#F18F01", "#E63946", "#6C757D"];
  const base = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;

  return Array.from(bairroMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count], index) => ({
      label,
      count,
      color: colors[index % colors.length],
      href: base,
    }));
}

function buildAlertas(
  leads: LeadRow[],
  imoveis: ImovelRow[],
  imovelIdsComFoto: Set<string>,
  config: DashboardConfig,
  finalidadeLead: "compra" | "locacao",
  finalidadeImovel: FinalidadeImovel,
  interacoesPorLead: Map<string, { first: string; last: string }>,
  agendaHojeCount: number,
  visitas24hCount: number,
): DashboardAlertaItem[] {
  const alertas: DashboardAlertaItem[] = [];
  const base = `/dashboard/atendimentos?finalidade=${finalidadeLead}`;
  const lastByLead = new Map(
    Array.from(interacoesPorLead.entries()).map(([id, v]) => [id, v.last]),
  );

  if (agendaHojeCount > 0) {
    alertas.push({
      id: "agenda-hoje",
      mensagem: `${agendaHojeCount} atividade${agendaHojeCount === 1 ? "" : "s"} pendente${agendaHojeCount === 1 ? "" : "s"} hoje`,
      acaoLabel: "Ver agenda",
      href: "/dashboard/agenda",
      tipo: "info",
    });
  }

  if (visitas24hCount > 0) {
    alertas.push({
      id: "visitas-24h",
      mensagem: `${visitas24hCount} visita${visitas24hCount === 1 ? "" : "s"} nas próximas 24h`,
      acaoLabel: "Ver agenda",
      href: "/dashboard/agenda",
      tipo: "warning",
    });
  }

  const leadsSemContato = leads.filter((l) => {
    if (l.finalidade_busca !== finalidadeLead || !isLeadAtivo(l)) return false;
    const ultima = getUltimaInteracaoLead(l, lastByLead);
    return daysSince(ultima) > config.leads_amarelo_dias;
  }).length;

  if (leadsSemContato > 0) {
    alertas.push({
      id: "leads-sem-contato",
      mensagem: `${leadsSemContato} lead${leadsSemContato === 1 ? "" : "s"} sem contato há mais de ${config.leads_amarelo_dias} dias`,
      acaoLabel: "Ver atendimentos",
      href: `${base}&sem_interacao=${config.leads_amarelo_dias}`,
      tipo: "warning",
    });
  }

  const imoveisFiltrados = imoveis.filter((i) => i.finalidade === finalidadeImovel);
  const semFoto = imoveisFiltrados.filter((i) => !imovelIdsComFoto.has(i.id)).length;

  if (semFoto > 0) {
    alertas.push({
      id: "sem-foto",
      mensagem: `${semFoto} imóve${semFoto === 1 ? "l sem foto" : "is sem foto"}`,
      acaoLabel: "Ver imóveis",
      href: "/dashboard/imoveis",
      tipo: "info",
    });
  }

  const imoveisDesatualizados = imoveisFiltrados.filter((i) => {
    if (!isImovelDisponivel(i)) return false;
    return daysSince(getImovelReferenciaAtualizacao(i)) > config.imoveis_amarelo_dias;
  }).length;

  if (imoveisDesatualizados > 0) {
    alertas.push({
      id: "imoveis-desatualizados",
      mensagem: `${imoveisDesatualizados} imóve${imoveisDesatualizados === 1 ? "l desatualizado" : "is desatualizados"} há +${config.imoveis_amarelo_dias} dias`,
      acaoLabel: "Ver imóveis",
      href: "/dashboard/imoveis",
      tipo: "danger",
    });
  }

  return alertas;
}

type DashboardRawData = {
  leads: LeadRow[];
  imoveis: ImovelRow[];
  interacoes: InteracaoRow[];
  negociosAll: NegocioRow[];
  fotos: { imovel_id: string }[];
};

async function fetchDashboardRawData(
  supabase: TenantDbClient,
  corretorId: string,
): Promise<DashboardRawData> {
  const [leadsResult, imoveisResult, interacoesResult, negociosResult] = await Promise.all([
    supabase
      .from("leads")
      .select("*, imovel:imoveis!leads_imovel_id_fkey(titulo)")
      .eq("corretor_id", corretorId),
    supabase
      .from("imoveis")
      .select(
        "id, status, finalidade, bairro, data_ativacao, data_desativacao, data_ultima_atualizacao, criado_em, local_chaves",
      )
      .eq("corretor_id", corretorId),
    supabase
      .from("lead_interacoes")
      .select("lead_id, criado_em")
      .eq("corretor_id", corretorId)
      .order("criado_em", { ascending: true }),
    supabase
      .from("negocios")
      .select(
        "valor_comissao, data_prevista_comissao, data_recebimento_comissao, status, lead_id, lead:leads(finalidade_busca)",
      )
      .eq("corretor_id", corretorId)
      .eq("status", "fechado"),
  ]);

  if (leadsResult.error) {
    console.error("[fetchDashboardRawData] leads failed", leadsResult.error);
  }
  if (imoveisResult.error) {
    console.error("[fetchDashboardRawData] imoveis failed", imoveisResult.error);
  }
  if (interacoesResult.error) {
    console.error("[fetchDashboardRawData] interacoes failed", interacoesResult.error);
  }
  if (negociosResult.error) {
    console.error("[fetchDashboardRawData] negocios failed", negociosResult.error);
  }

  const imoveis = (imoveisResult.data ?? []) as ImovelRow[];
  const imovelIds = imoveis.map((imovel) => imovel.id);
  let fotos: { imovel_id: string }[] = [];

  if (imovelIds.length > 0) {
    const fotosResult = await supabase
      .from("imovel_fotos")
      .select("imovel_id")
      .in("imovel_id", imovelIds);

    if (fotosResult.error) {
      console.error("[fetchDashboardRawData] fotos failed", fotosResult.error);
    } else {
      fotos = fotosResult.data ?? [];
    }
  }

  return {
    leads: (leadsResult.data ?? []) as LeadRow[],
    imoveis,
    interacoes: (interacoesResult.data ?? []) as InteracaoRow[],
    negociosAll: (negociosResult.data ?? []) as NegocioRow[],
    fotos,
  };
}

function filterDashboardRawData(
  raw: DashboardRawData,
  access: Awaited<ReturnType<typeof resolveTenantAccess>>,
): DashboardRawData {
  if (access.verTodos) {
    return raw;
  }

  const leads = raw.leads.filter((lead) =>
    leadVisivelParaUsuario(
      {
        perfil_id: lead.perfil_id,
        observacoes: lead.observacoes,
      },
      access,
    ),
  );
  const visibleLeadIds = new Set(leads.map((lead) => lead.id));

  return {
    leads,
    imoveis: raw.imoveis,
    interacoes: raw.interacoes.filter((interacao) => visibleLeadIds.has(interacao.lead_id)),
    negociosAll: raw.negociosAll.filter(
      (negocio) => negocio.lead_id && visibleLeadIds.has(negocio.lead_id),
    ),
    fotos: raw.fotos,
  };
}

function buildInteracoesPorLead(
  interacoes: InteracaoRow[],
): Map<string, { first: string; last: string }> {
  const interacoesPorLead = new Map<string, { first: string; last: string }>();
  for (const interacao of interacoes) {
    const existing = interacoesPorLead.get(interacao.lead_id);
    if (!existing) {
      interacoesPorLead.set(interacao.lead_id, {
        first: interacao.criado_em,
        last: interacao.criado_em,
      });
    } else {
      existing.last = interacao.criado_em;
    }
  }

  return interacoesPorLead;
}

type DashboardSharedContext = {
  filteredRaw: DashboardRawData;
  dashboardConfig: DashboardConfig;
  agendaHojeCount: number;
  visitas24hCount: number;
  periodPreset: DashboardPeriodPreset;
  customStart?: string;
  customEnd?: string;
};

function buildDashboardDataForTab(
  tab: DashboardTab,
  context: DashboardSharedContext,
): DashboardData {
  const { periodPreset, customStart, customEnd, filteredRaw, dashboardConfig } = context;
  const { start, end, previousStart, previousEnd } = resolvePeriodRange(
    periodPreset,
    customStart,
    customEnd,
  );

  const finalidadeLead = finalidadeLeadFromTab(tab);
  const finalidadeImovel = finalidadeImovelFromTab(tab);

  const leads = filteredRaw.leads;
  const imoveis = filteredRaw.imoveis;
  const interacoes = filteredRaw.interacoes;
  const negociosAll = filteredRaw.negociosAll;
  const negocios = negociosAll.filter(
    (n) => n.lead?.finalidade_busca === finalidadeLead,
  );
  const fotos = filteredRaw.fotos;
  const imovelIdsComFoto = new Set(fotos.map((f) => f.imovel_id));
  const interacoesPorLead = buildInteracoesPorLead(interacoes);

  const currentMetrics = computePeriodMetrics(
    leads,
    imoveis,
    interacoesPorLead,
    negocios,
    finalidadeLead,
    start,
    end,
  );

  const previousMetrics = computePeriodMetrics(
    leads,
    imoveis,
    interacoesPorLead,
    negocios,
    finalidadeLead,
    previousStart,
    previousEnd,
  );

  return {
    kpis: buildKpis(currentMetrics, previousMetrics, start, end, finalidadeLead),
    funil: buildFunil(leads, finalidadeLead, tab),
    temperatura: buildTemperatura(leads, finalidadeLead),
    qualidade: buildQualidade(leads, finalidadeLead),
    tempoInteracao: buildTempoInteracao(
      leads,
      interacoesPorLead,
      dashboardConfig,
      finalidadeLead,
    ),
    origem: buildOrigem(leads, finalidadeLead, start, end),
    captacoes: buildCaptacoes(imoveis, finalidadeImovel, start, end),
    imoveisDesatualizados: buildImoveisDesatualizados(
      imoveis,
      finalidadeImovel,
      dashboardConfig,
    ),
    rankingImoveisBairro: buildRankingImoveisBairro(imoveis, finalidadeImovel),
    bairrosLeads: buildBairrosLeads(leads, finalidadeLead),
    alertas: buildAlertas(
      leads,
      imoveis,
      imovelIdsComFoto,
      dashboardConfig,
      finalidadeLead,
      finalidadeImovel,
      interacoesPorLead,
      context.agendaHojeCount,
      context.visitas24hCount,
    ),
  };
}

async function fetchFilteredDashboardRaw(corretorId: string): Promise<DashboardRawData | null> {
  const corretor = await getCorretorForUser();
  if (!corretor) return null;

  const access = await resolveTenantAccess(corretor);
  const supabase = await createClient();
  let raw = await fetchDashboardRawData(supabase, corretorId);

  if (raw.leads.length === 0 && raw.imoveis.length === 0) {
    const admin = await createTenantDataClient();
    if (admin) {
      const fallback = await fetchDashboardRawData(admin, corretorId);
      if (fallback.leads.length > 0 || fallback.imoveis.length > 0) {
        console.warn(
          "[getDashboardData] authenticated query returned empty; used service role fallback",
          { corretorId },
        );
        raw = fallback;
      }
    }
  }

  return filterDashboardRawData(raw, access);
}

export async function getDashboardData(
  params: GetDashboardDataParams,
): Promise<DashboardData | null> {
  const corretor = await getCorretorForUser();
  if (!corretor) return null;

  const filteredRaw = await fetchFilteredDashboardRaw(corretor.id);
  if (!filteredRaw) return null;

  const [
    config,
    agendaHoje,
    visitas24h,
  ] = await Promise.all([
    getDashboardConfig(),
    getAgendaHoje(),
    getVisitasProximas24h(),
  ]);

  const dashboardConfig =
    config ??
    ({
      id: "fallback",
      corretor_id: corretor.id,
      ...DEFAULT_DASHBOARD_CONFIG,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    } satisfies DashboardConfig);

  return buildDashboardDataForTab(params.tab, {
    filteredRaw,
    dashboardConfig,
    agendaHojeCount: agendaHoje.length,
    visitas24hCount: visitas24h.length,
    periodPreset: params.periodPreset,
    customStart: params.customStart,
    customEnd: params.customEnd,
  });
}

export async function getDashboardDataBothTabs(params: Omit<GetDashboardDataParams, "tab">) {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { venda: null, locacao: null };
  }

  const filteredRaw = await fetchFilteredDashboardRaw(corretor.id);
  if (!filteredRaw) {
    return { venda: null, locacao: null };
  }

  const [
    config,
    agendaHoje,
    visitas24h,
  ] = await Promise.all([
    getDashboardConfig(),
    getAgendaHoje(),
    getVisitasProximas24h(),
  ]);

  const dashboardConfig =
    config ??
    ({
      id: "fallback",
      corretor_id: corretor.id,
      ...DEFAULT_DASHBOARD_CONFIG,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    } satisfies DashboardConfig);

  const sharedContext = {
    filteredRaw,
    dashboardConfig,
    agendaHojeCount: agendaHoje.length,
    visitas24hCount: visitas24h.length,
    periodPreset: params.periodPreset,
    customStart: params.customStart,
    customEnd: params.customEnd,
  };

  return {
    venda: buildDashboardDataForTab("venda", sharedContext),
    locacao: buildDashboardDataForTab("locacao", sharedContext),
  };
}

/** @deprecated Use getDashboardData */
export async function getDashboardStatsBothTabs(_diasAlertaInatividade = 7) {
  return getDashboardDataBothTabs({ periodPreset: "mes" });
}

/** @deprecated Use getDashboardData */
export async function getDashboardStats(
  tab: DashboardTab,
  _diasAlertaInatividade = 7,
): Promise<DashboardData | null> {
  return getDashboardData({ periodPreset: "mes", tab });
}
