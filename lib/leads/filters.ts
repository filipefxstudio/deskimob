import { leadMatchesTipoImovelBusca } from "@/lib/atendimentos/tipo-imovel-busca";
import type { LeadsViewMode } from "@/lib/constants/config";
import { leadMatchesMidiaOrigemFilter } from "@/lib/leads/midia-origem";
import { parseLeadObservacoes } from "@/lib/leads/observacoes";
import { leadMatchesEtapaFilter } from "@/lib/leads/etapa-order";
import {
  getUltimaAtividadeEm,
  isLeadAtivo,
  isLeadQualificado,
  isLeadVisivelFunil,
} from "@/lib/leads/format";
import { contemNormalizado, normalizar } from "@/lib/utils/normalizar";
import type { Lead, SituacaoLead } from "@/types";
import type { EtapaLead, TemperaturaLead } from "@/types";

export interface LeadsInteresseFilterState {
  imovelId: string | null;
  tipoImovel: string;
  bairros: string[];
  quartosMin: number | null;
  suitesMin: number | null;
  banheirosMin: number | null;
  vagasMin: number | null;
  valorMin: number | null;
  valorMax: number | null;
  prazoDecisao: string;
}

export interface LeadsFilterState {
  temperatura: TemperaturaLead | "all";
  etapa: EtapaLead | "all";
  origem: string;
  finalidade: "all" | "compra" | "locacao";
  perfilId: string;
  semInteracaoDias: number | null;
  situacao: SituacaoLead | "all" | "todas";
  apenasQualificados: boolean;
  interesse: LeadsInteresseFilterState;
}

export const defaultLeadsInteresseFilters: LeadsInteresseFilterState = {
  imovelId: null,
  tipoImovel: "",
  bairros: [],
  quartosMin: null,
  suitesMin: null,
  banheirosMin: null,
  vagasMin: null,
  valorMin: null,
  valorMax: null,
  prazoDecisao: "",
};

export const defaultLeadsFilters: LeadsFilterState = {
  temperatura: "all",
  etapa: "all",
  origem: "all",
  finalidade: "all",
  perfilId: "all",
  semInteracaoDias: null,
  situacao: "all",
  apenasQualificados: false,
  interesse: { ...defaultLeadsInteresseFilters },
};

function numeroFiltroAtivo(valor?: number | null): boolean {
  return valor != null && valor > 0;
}

function bairrosInteresseCompativel(leadBairros: string[], filtroBairros: string[]): boolean {
  return filtroBairros.some((filtro) => {
    const alvo = normalizar(filtro);
    return leadBairros.some((bairro) => {
      const normalizado = normalizar(bairro);
      return normalizado.includes(alvo) || alvo.includes(normalizado);
    });
  });
}

function matchesInteresseFilters(lead: Lead, interesse: LeadsInteresseFilterState): boolean {
  if (interesse.imovelId && lead.imovel_id !== interesse.imovelId) {
    return false;
  }

  if (interesse.tipoImovel) {
    if (!leadMatchesTipoImovelBusca(lead.tipo_imovel_busca, interesse.tipoImovel)) {
      return false;
    }
  }

  if (interesse.bairros.length > 0) {
    const leadBairros = lead.bairros_interesse ?? [];
    if (leadBairros.length === 0 || !bairrosInteresseCompativel(leadBairros, interesse.bairros)) {
      return false;
    }
  }

  if (numeroFiltroAtivo(interesse.quartosMin)) {
    if (!lead.quartos_minimo || lead.quartos_minimo < interesse.quartosMin!) {
      return false;
    }
  }

  if (numeroFiltroAtivo(interesse.suitesMin)) {
    if (!lead.suites_minimas || lead.suites_minimas < interesse.suitesMin!) {
      return false;
    }
  }

  if (numeroFiltroAtivo(interesse.banheirosMin)) {
    if (!lead.banheiros_minimos || lead.banheiros_minimos < interesse.banheirosMin!) {
      return false;
    }
  }

  if (numeroFiltroAtivo(interesse.vagasMin)) {
    if (!lead.vagas_minimas || lead.vagas_minimas < interesse.vagasMin!) {
      return false;
    }
  }

  if (numeroFiltroAtivo(interesse.valorMin)) {
    const referencia = lead.valor_maximo ?? lead.valor_minimo;
    if (referencia == null || referencia < interesse.valorMin!) {
      return false;
    }
  }

  if (numeroFiltroAtivo(interesse.valorMax)) {
    const referencia = lead.valor_minimo ?? lead.valor_maximo;
    if (referencia == null || referencia > interesse.valorMax!) {
      return false;
    }
  }

  if (interesse.prazoDecisao.trim()) {
    if (!contemNormalizado(lead.prazo_decisao, interesse.prazoDecisao)) {
      return false;
    }
  }

  return true;
}

export function matchesLeadsFilters(
  lead: Lead,
  filters: LeadsFilterState,
  viewMode: LeadsViewMode = "kanban",
): boolean {
  if (filters.situacao === "todas") {
    // Sem filtro por situação — exibe ativos, descartados e negócios fechados.
  } else if (filters.situacao !== "all") {
    const leadSituacao = lead.situacao ?? "em_atendimento";
    if (leadSituacao !== filters.situacao) {
      return false;
    }
  } else if (viewMode === "kanban") {
    if (!isLeadVisivelFunil(lead)) {
      return false;
    }
  } else if (!isLeadAtivo(lead)) {
    return false;
  }

  if (filters.apenasQualificados && !isLeadQualificado(lead)) {
    return false;
  }

  if (filters.temperatura !== "all" && lead.temperatura !== filters.temperatura) {
    return false;
  }

  if (filters.etapa !== "all" && !leadMatchesEtapaFilter(lead, filters.etapa)) {
    return false;
  }

  if (filters.finalidade !== "all" && lead.finalidade_busca !== filters.finalidade) {
    return false;
  }

  if (filters.origem !== "all") {
    if (!leadMatchesMidiaOrigemFilter(lead, filters.origem)) {
      return false;
    }
  }

  if (filters.perfilId !== "all") {
    const leadPerfilId = lead.perfil_id ?? parseLeadObservacoes(lead.observacoes).meta.perfil_id;
    if (leadPerfilId !== filters.perfilId) return false;
  }

  if (filters.semInteracaoDias !== null) {
    const limite = new Date();
    limite.setDate(limite.getDate() - filters.semInteracaoDias);
    if (new Date(getUltimaAtividadeEm(lead)) > limite) return false;
  }

  if (!matchesInteresseFilters(lead, filters.interesse)) {
    return false;
  }

  return true;
}

export function countActiveLeadsFilters(filters: LeadsFilterState): number {
  let count = 0;
  if (filters.temperatura !== "all") count += 1;
  if (filters.etapa !== "all") count += 1;
  if (filters.origem !== "all") count += 1;
  if (filters.finalidade !== "all") count += 1;
  if (filters.perfilId !== "all") count += 1;
  if (filters.semInteracaoDias !== null) count += 1;
  if (filters.situacao !== "all") count += 1;
  if (filters.apenasQualificados) count += 1;

  const { interesse } = filters;
  if (interesse.imovelId) count += 1;
  if (interesse.tipoImovel) count += 1;
  if (interesse.bairros.length > 0) count += 1;
  if (numeroFiltroAtivo(interesse.quartosMin)) count += 1;
  if (numeroFiltroAtivo(interesse.suitesMin)) count += 1;
  if (numeroFiltroAtivo(interesse.banheirosMin)) count += 1;
  if (numeroFiltroAtivo(interesse.vagasMin)) count += 1;
  if (numeroFiltroAtivo(interesse.valorMin)) count += 1;
  if (numeroFiltroAtivo(interesse.valorMax)) count += 1;
  if (interesse.prazoDecisao.trim()) count += 1;

  return count;
}

export function hasActiveInteresseFilters(interesse: LeadsInteresseFilterState): boolean {
  return (
    Boolean(interesse.imovelId) ||
    Boolean(interesse.tipoImovel) ||
    interesse.bairros.length > 0 ||
    numeroFiltroAtivo(interesse.quartosMin) ||
    numeroFiltroAtivo(interesse.suitesMin) ||
    numeroFiltroAtivo(interesse.banheirosMin) ||
    numeroFiltroAtivo(interesse.vagasMin) ||
    numeroFiltroAtivo(interesse.valorMin) ||
    numeroFiltroAtivo(interesse.valorMax) ||
    Boolean(interesse.prazoDecisao.trim())
  );
}
