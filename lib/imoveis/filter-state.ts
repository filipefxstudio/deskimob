import { STATUS_NOME_TO_SLUG } from "@/lib/constants/imoveis";
import type { FinalidadeImovel, StatusImovel, StatusImovelSlug, TipoImovel } from "@/types";

export type MinimoNumericoFilter = "all" | "1" | "2" | "3" | "4";

export interface ImoveisFilterState {
  finalidade: FinalidadeImovel | "all";
  tipos: TipoImovel[];
  statusIds: string[];
  valorMin: number | null;
  valorMax: number | null;
  bairros: string[];
  quartosMin: MinimoNumericoFilter;
  banheirosMin: MinimoNumericoFilter;
  vagasMin: MinimoNumericoFilter;
  caracteristicas: string[];
}

export const defaultImoveisFilters: ImoveisFilterState = {
  finalidade: "all",
  tipos: [],
  statusIds: [],
  valorMin: null,
  valorMax: null,
  bairros: [],
  quartosMin: "all",
  banheirosMin: "all",
  vagasMin: "all",
  caracteristicas: [],
};

export function getDisponivelStatusId(statusList: StatusImovel[]): string | null {
  return (
    statusList.find((status) => STATUS_NOME_TO_SLUG[status.nome] === "disponivel")?.id ?? null
  );
}

export function getStatusIdBySlug(
  statusList: StatusImovel[],
  slug: StatusImovelSlug,
): string | null {
  return statusList.find((status) => STATUS_NOME_TO_SLUG[status.nome] === slug)?.id ?? null;
}

export function buildDefaultImoveisFilters(statusList: StatusImovel[]): ImoveisFilterState {
  const disponivelId = getDisponivelStatusId(statusList);

  return {
    ...defaultImoveisFilters,
    statusIds: disponivelId ? [disponivelId] : [],
  };
}

export function buildInitialImoveisFilters(
  statusList: StatusImovel[],
  options?: { bairro?: string; statusSlug?: StatusImovelSlug },
): ImoveisFilterState {
  let filters = buildDefaultImoveisFilters(statusList);

  if (options?.statusSlug) {
    const statusId = getStatusIdBySlug(statusList, options.statusSlug);
    if (statusId) {
      filters = { ...filters, statusIds: [statusId] };
    }
  }

  if (options?.bairro) {
    filters = { ...filters, bairros: [options.bairro] };
  }

  return filters;
}

export function isDefaultStatusFilter(
  statusIds: string[],
  statusList: StatusImovel[],
): boolean {
  const disponivelId = getDisponivelStatusId(statusList);

  if (!disponivelId) {
    return statusIds.length === 0;
  }

  return statusIds.length === 1 && statusIds[0] === disponivelId;
}
