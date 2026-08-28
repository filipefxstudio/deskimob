import {
  buildDefaultImoveisFilters,
  getStatusIdBySlug,
  type ImoveisFilterState,
} from "@/lib/imoveis/filter-state";
import {
  IMOVEIS_SORT_VALUES,
  type ImoveisSortOption,
  type ImoveisViewMode,
} from "@/lib/imoveis/sort-options";
import { TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import type { StatusImovel, StatusImovelSlug, TipoImovel } from "@/types";

export interface DashboardImoveisListingState {
  search: string;
  filters: ImoveisFilterState;
  sort: ImoveisSortOption;
  viewMode: ImoveisViewMode;
  filtersOpen: boolean;
}

function getParam(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value || undefined;
}

function getParamList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseMinimo(value: string | undefined): ImoveisFilterState["quartosMin"] {
  if (!value || value === "all") {
    return "all";
  }

  if (value === "1" || value === "2" || value === "3" || value === "4") {
    return value;
  }

  return "all";
}

function parseFinalidade(value: string | undefined): ImoveisFilterState["finalidade"] {
  if (value === "venda" || value === "locacao") {
    return value;
  }

  return "all";
}

function parseTipos(values: string[]): TipoImovel[] {
  return values.filter((value): value is TipoImovel =>
    TIPOS_IMOVEL.some((item) => item.value === value),
  );
}

function parseSort(value: string | undefined): ImoveisSortOption {
  if (value && IMOVEIS_SORT_VALUES.has(value as ImoveisSortOption)) {
    return value as ImoveisSortOption;
  }

  return "cadastro_desc";
}

function parseViewMode(value: string | undefined): ImoveisViewMode {
  return value === "list" ? "list" : "grid";
}

function resolveStatusIds(
  params: URLSearchParams,
  statusList: StatusImovel[],
): string[] {
  const fromIds = getParamList(params, "statusIds");
  if (fromIds.length > 0) {
    const validIds = new Set(statusList.map((status) => status.id));
    return fromIds.filter((id) => validIds.has(id));
  }

  const legacySlug = getParam(params, "status") as StatusImovelSlug | undefined;
  if (legacySlug) {
    const statusId = getStatusIdBySlug(statusList, legacySlug);
    return statusId ? [statusId] : [];
  }

  return buildDefaultImoveisFilters(statusList).statusIds;
}

export function parseDashboardImoveisListingState(
  searchParams: URLSearchParams | string,
  statusList: StatusImovel[],
): DashboardImoveisListingState {
  const params =
    typeof searchParams === "string"
      ? new URLSearchParams(searchParams)
      : searchParams;

  const legacyBairro = getParam(params, "bairro");
  const bairros = getParamList(params, "bairros");
  const resolvedBairros =
    bairros.length > 0 ? bairros : legacyBairro ? [legacyBairro] : [];

  const filters: ImoveisFilterState = {
    ...buildDefaultImoveisFilters(statusList),
    finalidade: parseFinalidade(getParam(params, "finalidade")),
    tipos: parseTipos(getParamList(params, "tipos")),
    statusIds: resolveStatusIds(params, statusList),
    valorMin: parseNumber(getParam(params, "valorMin")),
    valorMax: parseNumber(getParam(params, "valorMax")),
    bairros: resolvedBairros,
    quartosMin: parseMinimo(getParam(params, "quartosMin")),
    banheirosMin: parseMinimo(getParam(params, "banheirosMin")),
    vagasMin: parseMinimo(getParam(params, "vagasMin")),
    caracteristicas: getParamList(params, "caracteristicas"),
  };

  const hasAdvancedFilters =
    filters.finalidade !== "all" ||
    filters.tipos.length > 0 ||
    filters.valorMin != null ||
    filters.valorMax != null ||
    filters.bairros.length > 0 ||
    filters.quartosMin !== "all" ||
    filters.banheirosMin !== "all" ||
    filters.vagasMin !== "all" ||
    filters.caracteristicas.length > 0;

  return {
    search: getParam(params, "busca") ?? "",
    filters,
    sort: parseSort(getParam(params, "sort")),
    viewMode: parseViewMode(getParam(params, "view")),
    filtersOpen: params.get("filtros") === "1" || hasAdvancedFilters,
  };
}

function appendListParam(params: URLSearchParams, key: string, values: string[]): void {
  if (values.length > 0) {
    params.set(key, values.join(","));
  }
}

export function buildDashboardImoveisListingParams(
  state: DashboardImoveisListingState,
  statusList: StatusImovel[],
): URLSearchParams {
  const params = new URLSearchParams();
  const defaultFilters = buildDefaultImoveisFilters(statusList);

  if (state.search.trim()) {
    params.set("busca", state.search.trim());
  }

  if (state.filters.finalidade !== "all") {
    params.set("finalidade", state.filters.finalidade);
  }

  appendListParam(params, "tipos", state.filters.tipos);

  const defaultStatusKey = defaultFilters.statusIds.join(",");
  const currentStatusKey = state.filters.statusIds.join(",");
  if (currentStatusKey && currentStatusKey !== defaultStatusKey) {
    appendListParam(params, "statusIds", state.filters.statusIds);
  }

  appendListParam(params, "bairros", state.filters.bairros);

  if (state.filters.valorMin != null) {
    params.set("valorMin", String(state.filters.valorMin));
  }

  if (state.filters.valorMax != null) {
    params.set("valorMax", String(state.filters.valorMax));
  }

  if (state.filters.quartosMin !== "all") {
    params.set("quartosMin", state.filters.quartosMin);
  }

  if (state.filters.banheirosMin !== "all") {
    params.set("banheirosMin", state.filters.banheirosMin);
  }

  if (state.filters.vagasMin !== "all") {
    params.set("vagasMin", state.filters.vagasMin);
  }

  appendListParam(params, "caracteristicas", state.filters.caracteristicas);

  if (state.sort !== "cadastro_desc") {
    params.set("sort", state.sort);
  }

  if (state.viewMode !== "grid") {
    params.set("view", state.viewMode);
  }

  if (state.filtersOpen) {
    params.set("filtros", "1");
  }

  return params;
}

export function buildDashboardImoveisListingHref(
  state: DashboardImoveisListingState,
  statusList: StatusImovel[],
): string {
  const params = buildDashboardImoveisListingParams(state, statusList);
  const query = params.toString();
  return query ? `/dashboard/imoveis?${query}` : "/dashboard/imoveis";
}

export type { ImoveisFilterState, ImoveisSortOption, ImoveisViewMode };
