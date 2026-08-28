"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { ImovelCardGrid } from "@/components/imoveis/ImovelCardGrid";
import { ImovelPhotoBadge } from "@/components/atendimentos/ImovelPhotoBadge";
import type { ImovelListingBadge } from "@/lib/actions/imoveis";
import { ImovelCardList } from "@/components/imoveis/ImovelCardList";
import { ListingScrollRestore } from "@/components/site/ListingScrollRestore";
import {
  buildDefaultImoveisFilters,
  buildImoveisFilterTags,
  buildInitialImoveisFilters,
  countActiveFilters,
  ImoveisFilters,
  type ImoveisFilterState,
} from "@/components/imoveis/ImoveisFilters";
import {
  ImoveisToolbar,
  type ImoveisSortOption,
  type ImoveisViewMode,
} from "@/components/imoveis/ImoveisToolbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getImovelCodigo, getValorNumerico } from "@/lib/imoveis/format";
import {
  consumeListingStateRestore,
  persistListingSnapshot,
} from "@/lib/imoveis/listing-return-state";
import { contemNormalizado } from "@/lib/utils/normalizar";
import type { Imovel, StatusImovel, StatusImovelSlug } from "@/types";

const VIEW_MODE_STORAGE_KEY = "deskimob-imoveis-view";
const SORT_STORAGE_KEY = "fx-imoveis-sort";

interface ImoveisListingProps {
  imoveis: Imovel[];
  corretorSlug: string;
  statusList: StatusImovel[];
  workflowBadges?: Record<string, ImovelListingBadge>;
  initialBusca?: string;
  initialBairro?: string;
  initialStatusSlug?: StatusImovelSlug;
}

function matchesMinimo(
  valor: number | null | undefined,
  minimo: ImoveisFilterState["quartosMin"],
): boolean {
  if (minimo === "all") {
    return true;
  }

  const min = Number(minimo);
  return (valor ?? 0) >= min;
}

function matchesSearch(imovel: Imovel, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const codigo = getImovelCodigo(imovel);
  const captadorNome = imovel.captador?.nome ?? "";

  return (
    contemNormalizado(codigo, query) ||
    contemNormalizado(imovel.codigo, query) ||
    contemNormalizado(imovel.bairro, query) ||
    contemNormalizado(imovel.logradouro, query) ||
    contemNormalizado(imovel.titulo, query) ||
    contemNormalizado(captadorNome, query)
  );
}

function matchesFilters(imovel: Imovel, filters: ImoveisFilterState): boolean {
  if (filters.finalidade !== "all" && imovel.finalidade !== filters.finalidade) {
    return false;
  }

  if (filters.tipos.length > 0 && !filters.tipos.includes(imovel.tipo)) {
    return false;
  }

  if (
    filters.statusIds.length > 0 &&
    (!imovel.status_imovel_id || !filters.statusIds.includes(imovel.status_imovel_id))
  ) {
    return false;
  }

  if (
    filters.bairros.length > 0 &&
    (!imovel.bairro || !filters.bairros.some((b) => b.toLowerCase() === imovel.bairro?.toLowerCase()))
  ) {
    return false;
  }

  const valor = getValorNumerico(imovel);

  if (filters.valorMin != null) {
    if (valor === null || valor < filters.valorMin) {
      return false;
    }
  }

  if (filters.valorMax != null) {
    if (valor === null || valor > filters.valorMax) {
      return false;
    }
  }

  if (!matchesMinimo(imovel.quartos, filters.quartosMin)) {
    return false;
  }

  if (!matchesMinimo(imovel.banheiros, filters.banheirosMin)) {
    return false;
  }

  if (!matchesMinimo(imovel.vagas, filters.vagasMin)) {
    return false;
  }

  if (filters.caracteristicas.length > 0) {
    const diferenciais = imovel.diferenciais ?? [];
    const hasAll = filters.caracteristicas.every((item) => diferenciais.includes(item));
    if (!hasAll) {
      return false;
    }
  }

  return true;
}

function getPublicacaoDate(imovel: Imovel): number {
  const date = imovel.data_ativacao ?? imovel.criado_em;
  return new Date(date).getTime();
}

function sortImoveis(imoveis: Imovel[], sort: ImoveisSortOption): Imovel[] {
  const sorted = [...imoveis];

  sorted.sort((a, b) => {
    switch (sort) {
      case "valor_desc":
        return (getValorNumerico(b) ?? 0) - (getValorNumerico(a) ?? 0);
      case "valor_asc":
        return (getValorNumerico(a) ?? 0) - (getValorNumerico(b) ?? 0);
      case "publicacao_desc":
        return getPublicacaoDate(b) - getPublicacaoDate(a);
      case "publicacao_asc":
        return getPublicacaoDate(a) - getPublicacaoDate(b);
      case "cadastro_desc":
        return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
      case "cadastro_asc":
        return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
      case "bairro_asc":
        return (a.bairro ?? "").localeCompare(b.bairro ?? "", "pt-BR");
      case "captador_asc":
        return (a.captador?.nome ?? "").localeCompare(b.captador?.nome ?? "", "pt-BR");
      case "area_desc":
        return (b.area_util ?? 0) - (a.area_util ?? 0);
      case "area_asc":
        return (a.area_util ?? 0) - (b.area_util ?? 0);
      default:
        return 0;
    }
  });

  return sorted;
}

export function ImoveisListing({
  imoveis,
  corretorSlug,
  statusList,
  workflowBadges = {},
  initialBusca = "",
  initialBairro = "",
  initialStatusSlug,
}: ImoveisListingProps) {
  const [search, setSearch] = useState(initialBusca);
  const [filters, setFilters] = useState<ImoveisFilterState>(() =>
    buildInitialImoveisFilters(statusList, {
      bairro: initialBairro || undefined,
      statusSlug: initialStatusSlug,
    }),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ImoveisViewMode>("grid");
  const [sort, setSort] = useState<ImoveisSortOption>("cadastro_desc");

  useEffect(() => {
    const restored = consumeListingStateRestore();
    if (restored) {
      setSearch(restored.search);
      setFilters(restored.filters);
      setFiltersOpen(restored.filtersOpen);
      setViewMode(restored.viewMode);
      setSort(restored.sort);
      return;
    }

    if (initialBusca) {
      setSearch(initialBusca);
    }

    if (initialBairro || initialStatusSlug) {
      setFilters(
        buildInitialImoveisFilters(statusList, {
          bairro: initialBairro || undefined,
          statusSlug: initialStatusSlug,
        }),
      );
      setFiltersOpen(true);
    }

    const storedView = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (storedView === "grid" || storedView === "list") {
      setViewMode(storedView);
    }

    const storedSort = localStorage.getItem(SORT_STORAGE_KEY) as ImoveisSortOption | null;
    if (storedSort) {
      setSort(storedSort);
    }
  }, [initialBusca, initialBairro, initialStatusSlug, statusList]);

  useEffect(() => {
    persistListingSnapshot({ search, filters, sort, viewMode, filtersOpen });
  }, [search, filters, sort, viewMode, filtersOpen]);

  function handleViewModeChange(mode: ImoveisViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  function handleSortChange(nextSort: ImoveisSortOption) {
    setSort(nextSort);
    localStorage.setItem(SORT_STORAGE_KEY, nextSort);
  }

  function handleClearFilters() {
    setFilters(buildDefaultImoveisFilters(statusList));
  }

  const bairros = useMemo(() => {
    const unique = new Set<string>();
    for (const imovel of imoveis) {
      if (imovel.bairro) {
        unique.add(imovel.bairro);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [imoveis]);

  const filterTags = useMemo(
    () => buildImoveisFilterTags(filters, statusList),
    [filters, statusList],
  );

  const filteredImoveis = useMemo(
    () =>
      sortImoveis(
        imoveis.filter(
          (imovel) => matchesSearch(imovel, search) && matchesFilters(imovel, filters),
        ),
        sort,
      ),
    [imoveis, search, filters, sort],
  );

  const activeFilterCount = countActiveFilters(filters, statusList);

  if (imoveis.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comece seu portfólio</CardTitle>
          <CardDescription>
            Cadastre seu primeiro imóvel para exibir no site e receber leads qualificados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/imoveis/novo">
              <Plus data-icon="inline-start" />
              Cadastrar imóvel
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ListingScrollRestore />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Imóveis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {imoveis.length} {imoveis.length === 1 ? "imóvel" : "imóveis"} no portfólio
          </p>
        </div>

        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/imoveis/novo">
            <Plus data-icon="inline-start" />
            Novo imóvel
          </Link>
        </Button>
      </div>

      <ImoveisToolbar
        search={search}
        onSearchChange={setSearch}
        activeFilterCount={activeFilterCount}
        filtersOpen={filtersOpen}
        onFiltersToggle={() => setFiltersOpen((open) => !open)}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        sort={sort}
        onSortChange={handleSortChange}
        onClearFilters={handleClearFilters}
      />

      {filterTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {filterTags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={() => setFilters(tag.onRemove())}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs hover:bg-muted"
            >
              {tag.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}

      {filtersOpen ? (
        <ImoveisFilters
          filters={filters}
          onChange={setFilters}
          onClear={handleClearFilters}
          bairros={bairros}
          statusList={statusList}
        />
      ) : null}

      {filteredImoveis.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum imóvel encontrado com os filtros aplicados.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <ImovelCardGrid
          imoveis={filteredImoveis}
          corretorSlug={corretorSlug}
          statusList={statusList}
          getCardBadge={(imovel) => {
            const badge = workflowBadges[imovel.id];
            if (!badge) return null;
            return (
              <ImovelPhotoBadge
                variant={badge === "negocio_fechado" ? "negocio_fechado" : "proposta"}
              />
            );
          }}
        />
      ) : (
        <ImovelCardList
          imoveis={filteredImoveis}
          corretorSlug={corretorSlug}
          statusList={statusList}
          getCardBadge={(imovel) => {
            const badge = workflowBadges[imovel.id];
            if (!badge) return null;
            return (
              <ImovelPhotoBadge
                variant={badge === "negocio_fechado" ? "negocio_fechado" : "proposta"}
              />
            );
          }}
        />
      )}
    </div>
  );
}
