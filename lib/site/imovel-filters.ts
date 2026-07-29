import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

import { PUBLIC_IMOVEIS_PAGE_SIZE } from "@/lib/site/filters";
import type { FinalidadeImovel, Imovel, TipoImovel } from "@/types";

export type OrdenacaoImoveisPublicos =
  | "recentes"
  | "menor_preco"
  | "maior_preco"
  | "maior_area";

export const ORDENACAO_IMOVEIS_OPTIONS: {
  value: OrdenacaoImoveisPublicos;
  label: string;
}[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor_preco", label: "Menor preço" },
  { value: "maior_preco", label: "Maior preço" },
  { value: "maior_area", label: "Maior área" },
];

export interface ImoveisPublicosFilters {
  tipo?: TipoImovel;
  tipos?: TipoImovel[];
  finalidade?: FinalidadeImovel;
  finalidades?: FinalidadeImovel[];
  bairro?: string;
  bairros?: string[];
  cidades?: string[];
  codigo?: string;
  valorMin?: number;
  valorMax?: number;
  areaMin?: number;
  areaMax?: number;
  quartosMin?: number;
  banheirosMin?: number;
  suitesMin?: number;
  vagasMin?: number;
  caracteristicas?: string[];
  ordenacao?: OrdenacaoImoveisPublicos;
  pagina?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ImoveisQuery = PostgrestFilterBuilder<any, any, any, any[], "imoveis", unknown, "GET">;

function resolveFinalidades(filters: ImoveisPublicosFilters): FinalidadeImovel[] {
  if (filters.finalidades?.length) {
    return filters.finalidades;
  }

  return filters.finalidade ? [filters.finalidade] : [];
}

function resolveSingleFinalidade(filters: ImoveisPublicosFilters): FinalidadeImovel | undefined {
  const finalidades = resolveFinalidades(filters);
  return finalidades.length === 1 ? finalidades[0] : undefined;
}

export function applyImoveisPublicosFilters(
  query: ImoveisQuery,
  filters: ImoveisPublicosFilters,
  options?: { skipBairros?: boolean },
): ImoveisQuery {
  const tipos = filters.tipos?.length ? filters.tipos : filters.tipo ? [filters.tipo] : [];

  if (tipos.length === 1) {
    query = query.eq("tipo", tipos[0]);
  } else if (tipos.length > 1) {
    query = query.in("tipo", tipos);
  }

  const finalidades = resolveFinalidades(filters);

  if (finalidades.length === 1) {
    query = query.eq("finalidade", finalidades[0]);
  } else if (finalidades.length > 1) {
    query = query.in("finalidade", finalidades);
  }

  if (!options?.skipBairros) {
    const bairros = filters.bairros?.length
      ? filters.bairros
      : filters.bairro
        ? [filters.bairro]
        : [];

    if (bairros.length === 1) {
      query = query.ilike("bairro", `%${bairros[0]}%`);
    } else if (bairros.length > 1) {
      query = query.in("bairro", bairros);
    }
  }

  if (filters.cidades?.length === 1) {
    query = query.ilike("cidade", `%${filters.cidades[0]}%`);
  } else if (filters.cidades && filters.cidades.length > 1) {
    query = query.in("cidade", filters.cidades);
  }

  if (filters.codigo) {
    const codigo = filters.codigo.trim();
    query = query.or(`codigo.ilike.%${codigo}%,codigo_personalizado.ilike.%${codigo}%`);
  }

  if (filters.quartosMin != null) {
    query = query.gte("quartos", filters.quartosMin);
  }

  if (filters.banheirosMin != null) {
    query = query.gte("banheiros", filters.banheirosMin);
  }

  if (filters.suitesMin != null) {
    query = query.gte("suites", filters.suitesMin);
  }

  if (filters.vagasMin != null) {
    query = query.gte("vagas", filters.vagasMin);
  }

  if (filters.areaMin != null) {
    query = query.gte("area_total", filters.areaMin);
  }

  if (filters.areaMax != null) {
    query = query.lte("area_total", filters.areaMax);
  }

  if (filters.caracteristicas?.length) {
    query = query.contains("diferenciais", filters.caracteristicas);
  }

  const finalidadeUnica = resolveSingleFinalidade(filters);

  if (filters.valorMin !== undefined) {
    if (finalidadeUnica === "locacao") {
      query = query.gte("valor_locacao", filters.valorMin);
    } else if (finalidadeUnica === "venda") {
      query = query.gte("valor_venda", filters.valorMin);
    } else {
      query = query.or(
        `valor_venda.gte.${filters.valorMin},valor_locacao.gte.${filters.valorMin}`,
      );
    }
  }

  if (filters.valorMax !== undefined) {
    if (finalidadeUnica === "locacao") {
      query = query.lte("valor_locacao", filters.valorMax);
    } else if (finalidadeUnica === "venda") {
      query = query.lte("valor_venda", filters.valorMax);
    } else {
      query = query.or(
        `valor_venda.lte.${filters.valorMax},valor_locacao.lte.${filters.valorMax}`,
      );
    }
  }

  return query;
}

function resolvePriceColumn(finalidade?: FinalidadeImovel): "valor_venda" | "valor_locacao" {
  return finalidade === "locacao" ? "valor_locacao" : "valor_venda";
}

export function applyImoveisPublicosOrdenacao(
  query: ImoveisQuery,
  filters: ImoveisPublicosFilters,
): ImoveisQuery {
  const ordenacao = filters.ordenacao ?? "recentes";
  const finalidade = resolveSingleFinalidade(filters);

  switch (ordenacao) {
    case "menor_preco":
      return query.order(resolvePriceColumn(finalidade), {
        ascending: true,
        nullsFirst: false,
      });
    case "maior_preco":
      return query.order(resolvePriceColumn(finalidade), {
        ascending: false,
        nullsFirst: false,
      });
    case "maior_area":
      return query.order("area_total", { ascending: false, nullsFirst: false });
    case "recentes":
    default:
      return query.order("atualizado_em", { ascending: false });
  }
}

export { PUBLIC_IMOVEIS_PAGE_SIZE };
