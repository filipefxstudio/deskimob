"use client";

import { Filter, LayoutGrid, List, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ImoveisViewMode = "grid" | "list";

export type ImoveisSortOption =
  | "valor_desc"
  | "valor_asc"
  | "publicacao_desc"
  | "publicacao_asc"
  | "cadastro_desc"
  | "cadastro_asc"
  | "bairro_asc"
  | "captador_asc"
  | "area_desc"
  | "area_asc";

export const IMOVEIS_SORT_OPTIONS: { value: ImoveisSortOption; label: string }[] = [
  { value: "valor_desc", label: "Valor (maior)" },
  { value: "valor_asc", label: "Valor (menor)" },
  { value: "publicacao_desc", label: "Publicação (mais recente)" },
  { value: "publicacao_asc", label: "Publicação (mais antigo)" },
  { value: "cadastro_desc", label: "Cadastro (mais recente)" },
  { value: "cadastro_asc", label: "Cadastro (mais antigo)" },
  { value: "bairro_asc", label: "Bairro (A-Z)" },
  { value: "captador_asc", label: "Captador (A-Z)" },
  { value: "area_desc", label: "Área útil (maior)" },
  { value: "area_asc", label: "Área útil (menor)" },
];

interface ImoveisToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeFilterCount: number;
  filtersOpen: boolean;
  onFiltersToggle: () => void;
  viewMode: ImoveisViewMode;
  onViewModeChange: (mode: ImoveisViewMode) => void;
  sort: ImoveisSortOption;
  onSortChange: (sort: ImoveisSortOption) => void;
}

export function ImoveisToolbar({
  search,
  onSearchChange,
  activeFilterCount,
  filtersOpen,
  onFiltersToggle,
  viewMode,
  onViewModeChange,
  sort,
  onSortChange,
}: ImoveisToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por código, bairro, rua ou título..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
          aria-label="Buscar imóveis"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={filtersOpen ? "secondary" : "outline"}
          onClick={onFiltersToggle}
          aria-expanded={filtersOpen}
          aria-controls="imoveis-filters-panel"
        >
          <Filter className="size-4" data-icon="inline-start" />
          Filtros
          {activeFilterCount > 0 ? (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>

        <Select value={sort} onValueChange={(value) => onSortChange(value as ImoveisSortOption)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Ordenar por">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {IMOVEIS_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-lg border border-border p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onViewModeChange("grid")}
            className={cn(viewMode === "grid" && "bg-muted")}
            aria-label="Visualização em grade"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onViewModeChange("list")}
            className={cn(viewMode === "list" && "bg-muted")}
            aria-label="Visualização em lista"
            aria-pressed={viewMode === "list"}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
