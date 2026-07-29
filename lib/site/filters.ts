import type { FinalidadeImovel, TipoImovel } from "@/types";

import type {
  ImoveisPublicosFilters,
  OrdenacaoImoveisPublicos,
} from "@/lib/site/imovel-filters";

export const PUBLIC_IMOVEIS_PAGE_SIZE = 30;

const TIPOS: TipoImovel[] = [
  "apartamento",
  "casa",
  "terreno",
  "comercial",
  "cobertura",
  "studio",
];

const FINALIDADES: FinalidadeImovel[] = ["venda", "locacao"];

const ORDENACOES: OrdenacaoImoveisPublicos[] = [
  "recentes",
  "menor_preco",
  "maior_preco",
  "maior_area",
];

function getParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function getParamList(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string[] {
  const raw = searchParams[key];
  if (!raw) {
    return [];
  }

  const joined = Array.isArray(raw) ? raw.join(",") : raw;
  return joined
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

function parseMinCount(value: string | undefined): number | undefined {
  const parsed = parseNumber(value);
  if (parsed == null || parsed < 1 || parsed > 4) {
    return undefined;
  }
  return parsed;
}

function parseTipo(value: string | undefined): TipoImovel | undefined {
  if (!value) {
    return undefined;
  }
  return TIPOS.includes(value as TipoImovel) ? (value as TipoImovel) : undefined;
}

function parseTipos(values: string[]): TipoImovel[] {
  return values.filter((value): value is TipoImovel => TIPOS.includes(value as TipoImovel));
}

function parseFinalidade(value: string | undefined): FinalidadeImovel | undefined {
  if (!value) {
    return undefined;
  }
  return FINALIDADES.includes(value as FinalidadeImovel)
    ? (value as FinalidadeImovel)
    : undefined;
}

function parseFinalidades(values: string[]): FinalidadeImovel[] {
  return values.filter((value): value is FinalidadeImovel =>
    FINALIDADES.includes(value as FinalidadeImovel),
  );
}

function parseOrdenacao(value: string | undefined): OrdenacaoImoveisPublicos | undefined {
  if (!value) {
    return undefined;
  }
  return ORDENACOES.includes(value as OrdenacaoImoveisPublicos)
    ? (value as OrdenacaoImoveisPublicos)
    : undefined;
}

export function parseImoveisSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ImoveisPublicosFilters {
  const tiposFromList = parseTipos(getParamList(searchParams, "tipos"));
  const legacyTipo = parseTipo(getParam(searchParams, "tipo"));
  const finalidadesFromList = parseFinalidades(getParamList(searchParams, "finalidades"));
  const legacyFinalidade = parseFinalidade(getParam(searchParams, "finalidade"));

  return {
    tipo: legacyTipo,
    tipos: tiposFromList.length > 0 ? tiposFromList : legacyTipo ? [legacyTipo] : undefined,
    finalidade: legacyFinalidade,
    finalidades:
      finalidadesFromList.length > 0
        ? finalidadesFromList
        : legacyFinalidade
          ? [legacyFinalidade]
          : undefined,
    bairro: getParam(searchParams, "bairro"),
    bairros: getParamList(searchParams, "bairros").length
      ? getParamList(searchParams, "bairros")
      : getParam(searchParams, "bairro")
        ? [getParam(searchParams, "bairro")!]
        : undefined,
    cidades: getParamList(searchParams, "cidades"),
    codigo: getParam(searchParams, "codigo")?.trim() || undefined,
    valorMin: parseNumber(getParam(searchParams, "valorMin")),
    valorMax: parseNumber(getParam(searchParams, "valorMax")),
    areaMin: parseNumber(getParam(searchParams, "areaMin")),
    areaMax: parseNumber(getParam(searchParams, "areaMax")),
    quartosMin: parseMinCount(getParam(searchParams, "quartosMin")),
    banheirosMin: parseMinCount(getParam(searchParams, "banheirosMin")),
    suitesMin: parseMinCount(getParam(searchParams, "suitesMin")),
    vagasMin: parseMinCount(getParam(searchParams, "vagasMin")),
    caracteristicas: getParamList(searchParams, "caracteristicas"),
    ordenacao: parseOrdenacao(getParam(searchParams, "ordenacao")),
    pagina: parsePage(getParam(searchParams, "pagina")),
  };
}

export function buildImoveisSearchParams(
  filters: ImoveisPublicosFilters,
  options?: { pagina?: number },
): URLSearchParams {
  const params = new URLSearchParams();

  const finalidades =
    filters.finalidades?.length
      ? filters.finalidades
      : filters.finalidade
        ? [filters.finalidade]
        : [];

  if (finalidades.length === 1) {
    params.set("finalidade", finalidades[0]);
  } else if (finalidades.length > 1) {
    params.set("finalidades", finalidades.join(","));
  }

  const tipos = filters.tipos?.length ? filters.tipos : filters.tipo ? [filters.tipo] : [];
  if (tipos.length > 0) {
    params.set("tipos", tipos.join(","));
  }

  if (filters.cidades?.length) {
    params.set("cidades", filters.cidades.join(","));
  }

  if (filters.bairros?.length) {
    params.set("bairros", filters.bairros.join(","));
  } else if (filters.bairro) {
    params.set("bairros", filters.bairro);
  }

  if (filters.codigo) {
    params.set("codigo", filters.codigo);
  }

  if (filters.valorMin != null) {
    params.set("valorMin", String(filters.valorMin));
  }

  if (filters.valorMax != null) {
    params.set("valorMax", String(filters.valorMax));
  }

  if (filters.areaMin != null) {
    params.set("areaMin", String(filters.areaMin));
  }

  if (filters.areaMax != null) {
    params.set("areaMax", String(filters.areaMax));
  }

  if (filters.quartosMin != null) {
    params.set("quartosMin", String(filters.quartosMin));
  }

  if (filters.banheirosMin != null) {
    params.set("banheirosMin", String(filters.banheirosMin));
  }

  if (filters.suitesMin != null) {
    params.set("suitesMin", String(filters.suitesMin));
  }

  if (filters.vagasMin != null) {
    params.set("vagasMin", String(filters.vagasMin));
  }

  if (filters.caracteristicas?.length) {
    params.set("caracteristicas", filters.caracteristicas.join(","));
  }

  if (filters.ordenacao && filters.ordenacao !== "recentes") {
    params.set("ordenacao", filters.ordenacao);
  }

  const pagina = options?.pagina ?? filters.pagina ?? 1;
  if (pagina > 1) {
    params.set("pagina", String(pagina));
  }

  return params;
}
