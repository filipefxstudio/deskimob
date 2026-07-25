"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { CheckboxFilterDropdown } from "@/components/imoveis/CheckboxFilterDropdown";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARACTERISTICAS_CHECKLIST } from "@/lib/constants/caracteristicas-checklist";
import {
  FINALIDADES_IMOVEL,
  STATUS_NOME_TO_SLUG,
  TIPOS_IMOVEL,
} from "@/lib/constants/imoveis";
import { cn } from "@/lib/utils";
import type { FinalidadeImovel, StatusImovel, StatusImovelSlug, TipoImovel } from "@/types";

type MinimoNumericoFilter = "all" | "1" | "2" | "3" | "4";

export interface ImoveisFilterState {
  finalidade: FinalidadeImovel | "all";
  tipos: TipoImovel[];
  statusIds: string[];
  valorMin: string;
  valorMax: string;
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
  valorMin: "",
  valorMax: "",
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
  void statusList;
  return {
    ...defaultImoveisFilters,
    statusIds: [],
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
  void statusList;
  return statusIds.length === 0;
}

const MINIMO_OPCOES: { value: MinimoNumericoFilter; label: string }[] = [
  { value: "all", label: "Qualquer" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

interface ImoveisFiltersProps {
  filters: ImoveisFilterState;
  onChange: (filters: ImoveisFilterState) => void;
  bairros: string[];
  statusList: StatusImovel[];
}

export function ImoveisFilters({
  filters,
  onChange,
  bairros,
  statusList,
}: ImoveisFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function update<K extends keyof ImoveisFilterState>(key: K, value: ImoveisFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleCaracteristica(item: string, checked: boolean) {
    const next = checked
      ? [...filters.caracteristicas, item]
      : filters.caracteristicas.filter((value) => value !== item);
    update("caracteristicas", next);
  }

  function handleClear() {
    onChange(buildDefaultImoveisFilters(statusList));
    setAdvancedOpen(false);
  }

  const hasActiveFilters =
    filters.finalidade !== "all" ||
    filters.tipos.length > 0 ||
    !isDefaultStatusFilter(filters.statusIds, statusList) ||
    filters.valorMin !== "" ||
    filters.valorMax !== "" ||
    filters.bairros.length > 0 ||
    filters.quartosMin !== "all" ||
    filters.banheirosMin !== "all" ||
    filters.vagasMin !== "all" ||
    filters.caracteristicas.length > 0;

  return (
    <div
      id="imoveis-filters-panel"
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">Filtros</h3>
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            <X className="size-4" data-icon="inline-start" />
            Limpar filtros
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Finalidade</Label>
          <Select
            value={filters.finalidade}
            onValueChange={(value) =>
              update("finalidade", value as ImoveisFilterState["finalidade"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {FINALIDADES_IMOVEL.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CheckboxFilterDropdown
          label="Tipo"
          options={TIPOS_IMOVEL.map((item) => ({ value: item.value, label: item.label }))}
          selected={filters.tipos}
          onChange={(tipos) => update("tipos", tipos as TipoImovel[])}
          showAllOption
        />

        <CheckboxFilterDropdown
          label="Status"
          options={statusList.map((status) => ({ value: status.id, label: status.nome }))}
          selected={filters.statusIds}
          onChange={(statusIds) => update("statusIds", statusIds)}
          showAllOption
        />

        <div className="space-y-2">
          <Label htmlFor="filtro-valor-min">Valor mínimo (R$)</Label>
          <Input
            id="filtro-valor-min"
            type="number"
            min={0}
            placeholder="0"
            value={filters.valorMin}
            onChange={(event) => update("valorMin", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filtro-valor-max">Valor máximo (R$)</Label>
          <Input
            id="filtro-valor-max"
            type="number"
            min={0}
            placeholder="Sem limite"
            value={filters.valorMax}
            onChange={(event) => update("valorMax", event.target.value)}
          />
        </div>

        <CheckboxFilterDropdown
          label="Bairro"
          options={bairros.map((bairro) => ({ value: bairro, label: bairro }))}
          selected={filters.bairros}
          onChange={(selected) => update("bairros", selected)}
        />

        <div className="space-y-2">
          <Label>Quartos (mínimo)</Label>
          <Select
            value={filters.quartosMin}
            onValueChange={(value) =>
              update("quartosMin", value as ImoveisFilterState["quartosMin"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              {MINIMO_OPCOES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Banheiros (mínimo)</Label>
          <Select
            value={filters.banheirosMin}
            onValueChange={(value) =>
              update("banheirosMin", value as ImoveisFilterState["banheirosMin"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              {MINIMO_OPCOES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Vagas (mínimo)</Label>
          <Select
            value={filters.vagasMin}
            onValueChange={(value) =>
              update("vagasMin", value as ImoveisFilterState["vagasMin"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer" />
            </SelectTrigger>
            <SelectContent>
              {MINIMO_OPCOES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="gap-1"
        >
          {advancedOpen ? "Ocultar filtros avançados" : "Exibir mais filtros"}
          <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
        </Button>
      </div>

      {advancedOpen ? (
        <div className="mt-4 space-y-6 border-t border-border pt-4">
          {CARACTERISTICAS_CHECKLIST.map((categoria) => (
            <div key={categoria.id} className="space-y-3">
              <h4 className="text-sm font-medium text-primary">{categoria.titulo}</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categoria.itens.map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={filters.caracteristicas.includes(item)}
                      onCheckedChange={(checked) =>
                        toggleCaracteristica(item, checked === true)
                      }
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function countActiveFilters(
  filters: ImoveisFilterState,
  statusList: StatusImovel[] = [],
): number {
  let count = 0;
  if (filters.finalidade !== "all") count += 1;
  count += filters.tipos.length;
  if (!isDefaultStatusFilter(filters.statusIds, statusList)) {
    count += filters.statusIds.length;
  }
  if (filters.valorMin) count += 1;
  if (filters.valorMax) count += 1;
  count += filters.bairros.length;
  if (filters.quartosMin !== "all") count += 1;
  if (filters.banheirosMin !== "all") count += 1;
  if (filters.vagasMin !== "all") count += 1;
  count += filters.caracteristicas.length;
  return count;
}

export function buildImoveisFilterTags(
  filters: ImoveisFilterState,
  statusList: StatusImovel[],
): { key: string; label: string; onRemove: () => ImoveisFilterState }[] {
  const tags: { key: string; label: string; onRemove: () => ImoveisFilterState }[] = [];

  if (filters.finalidade !== "all") {
    const label =
      FINALIDADES_IMOVEL.find((item) => item.value === filters.finalidade)?.label ??
      filters.finalidade;
    tags.push({
      key: "finalidade",
      label: `Finalidade: ${label}`,
      onRemove: () => ({ ...filters, finalidade: "all" }),
    });
  }

  for (const tipo of filters.tipos) {
    const label = TIPOS_IMOVEL.find((item) => item.value === tipo)?.label ?? tipo;
    tags.push({
      key: `tipo-${tipo}`,
      label: `Tipo: ${label}`,
      onRemove: () => ({ ...filters, tipos: filters.tipos.filter((item) => item !== tipo) }),
    });
  }

  if (!isDefaultStatusFilter(filters.statusIds, statusList)) {
    for (const statusId of filters.statusIds) {
      const label = statusList.find((item) => item.id === statusId)?.nome ?? "Status";
      tags.push({
        key: `status-${statusId}`,
        label: `Status: ${label}`,
        onRemove: () => ({
          ...filters,
          statusIds: filters.statusIds.filter((item) => item !== statusId),
        }),
      });
    }
  }

  for (const bairro of filters.bairros) {
    tags.push({
      key: `bairro-${bairro}`,
      label: `Bairro: ${bairro}`,
      onRemove: () => ({
        ...filters,
        bairros: filters.bairros.filter((item) => item !== bairro),
      }),
    });
  }

  return tags;
}
