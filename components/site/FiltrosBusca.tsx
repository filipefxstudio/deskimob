"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useState } from "react";

import { CheckboxFilterDropdown } from "@/components/imoveis/CheckboxFilterDropdown";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARACTERISTICAS_CHECKLIST } from "@/lib/constants/caracteristicas-checklist";
import { FINALIDADES_IMOVEL, TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import { buildImoveisSearchParams } from "@/lib/site/filters";
import { getSiteCorSecundaria } from "@/lib/site/theme-style";
import type { ImoveisPublicosFilters } from "@/lib/site/queries";
import { cn } from "@/lib/utils";
import type { FinalidadeImovel, TipoImovel } from "@/types";

import { useSite } from "./SiteProvider";

interface FiltrosBuscaProps {
  bairros?: string[];
  cidades?: string[];
  initialValues?: ImoveisPublicosFilters;
  layout?: "hero" | "sidebar" | "mobile";
  fixedFinalidade?: FinalidadeImovel;
  hideCaracteristicas?: boolean;
  onSearchComplete?: () => void;
}

function createEmptyFilterState(fixedFinalidade?: FinalidadeImovel) {
  return {
    finalidades: fixedFinalidade ? [fixedFinalidade] : ([] as FinalidadeImovel[]),
    tipos: [] as TipoImovel[],
    selectedCidades: [] as string[],
    selectedBairros: [] as string[],
    codigo: "",
    valorMin: null as number | null,
    valorMax: null as number | null,
    areaMin: "",
    areaMax: "",
    quartosMin: undefined as number | undefined,
    banheirosMin: undefined as number | undefined,
    suitesMin: undefined as number | undefined,
    vagasMin: undefined as number | undefined,
    caracteristicas: [] as string[],
  };
}

function toggleListItem<T extends string>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

function CountFilterButtons({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value?: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => onChange(value === count ? undefined : count)}
            className={cn(
              "rounded-md border px-2 py-2 text-sm font-medium transition-colors",
              value === count
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {count}+
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckboxList({
  idPrefix,
  items,
  selected,
  onToggle,
  maxHeightClass = "max-h-40",
}: {
  idPrefix: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  maxHeightClass?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma opção disponível.</p>;
  }

  return (
    <div className={cn("space-y-2 overflow-y-auto pr-1", maxHeightClass)}>
      {items.map((item) => {
        const id = `${idPrefix}-${item.replace(/\s+/g, "-").toLowerCase()}`;
        return (
          <label key={item} htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox
              id={id}
              checked={selected.includes(item)}
              onCheckedChange={() => onToggle(item)}
              className="mt-0.5"
            />
            <span>{item}</span>
          </label>
        );
      })}
    </div>
  );
}

export function FiltrosBusca({
  bairros = [],
  cidades = [],
  initialValues = {},
  layout = "sidebar",
  fixedFinalidade,
  hideCaracteristicas = false,
  onSearchComplete,
}: FiltrosBuscaProps) {
  const router = useRouter();
  const { link, corretor } = useSite();
  const corSecundaria = getSiteCorSecundaria(corretor);

  const initialTipos =
    initialValues.tipos?.length
      ? initialValues.tipos
      : initialValues.tipo
        ? [initialValues.tipo]
        : [];

  const initialFinalidades = fixedFinalidade
    ? [fixedFinalidade]
    : initialValues.finalidades?.length
      ? initialValues.finalidades
      : initialValues.finalidade
        ? [initialValues.finalidade]
        : [];

  const [finalidades, setFinalidades] = useState<FinalidadeImovel[]>(initialFinalidades);
  const [tipos, setTipos] = useState<TipoImovel[]>(initialTipos);
  const [selectedCidades, setSelectedCidades] = useState<string[]>(initialValues.cidades ?? []);
  const [selectedBairros, setSelectedBairros] = useState<string[]>(
    initialValues.bairros?.length
      ? initialValues.bairros
      : initialValues.bairro
        ? [initialValues.bairro]
        : [],
  );
  const [codigo, setCodigo] = useState(initialValues.codigo ?? "");
  const [valorMin, setValorMin] = useState<number | null>(initialValues.valorMin ?? null);
  const [valorMax, setValorMax] = useState<number | null>(initialValues.valorMax ?? null);
  const [areaMin, setAreaMin] = useState(
    initialValues.areaMin ? String(initialValues.areaMin) : "",
  );
  const [areaMax, setAreaMax] = useState(
    initialValues.areaMax ? String(initialValues.areaMax) : "",
  );
  const [quartosMin, setQuartosMin] = useState(initialValues.quartosMin);
  const [banheirosMin, setBanheirosMin] = useState(initialValues.banheirosMin);
  const [suitesMin, setSuitesMin] = useState(initialValues.suitesMin);
  const [vagasMin, setVagasMin] = useState(initialValues.vagasMin);
  const [caracteristicas, setCaracteristicas] = useState<string[]>(
    initialValues.caracteristicas ?? [],
  );
  const [openCategorias, setOpenCategorias] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CARACTERISTICAS_CHECKLIST.map((categoria) => [categoria.id, true])),
  );

  function buildFiltersFromState(
    state: ReturnType<typeof readFilterState>,
  ): ImoveisPublicosFilters {
    const resolvedFinalidades = fixedFinalidade ? [fixedFinalidade] : state.finalidades;

    return {
      finalidade: resolvedFinalidades.length === 1 ? resolvedFinalidades[0] : undefined,
      finalidades: resolvedFinalidades.length > 1 ? resolvedFinalidades : undefined,
      tipos: state.tipos.length > 0 ? state.tipos : undefined,
      cidades: state.selectedCidades.length > 0 ? state.selectedCidades : undefined,
      bairros: state.selectedBairros.length > 0 ? state.selectedBairros : undefined,
      codigo: state.codigo.trim() || undefined,
      valorMin: state.valorMin ?? undefined,
      valorMax: state.valorMax ?? undefined,
      areaMin: state.areaMin ? Number(state.areaMin.replace(/\D/g, "")) : undefined,
      areaMax: state.areaMax ? Number(state.areaMax.replace(/\D/g, "")) : undefined,
      quartosMin: state.quartosMin,
      banheirosMin: state.banheirosMin,
      suitesMin: state.suitesMin,
      vagasMin: state.vagasMin,
      caracteristicas: state.caracteristicas.length > 0 ? state.caracteristicas : undefined,
      pagina: 1,
    };
  }

  function readFilterState() {
    return {
      finalidades,
      tipos,
      selectedCidades,
      selectedBairros,
      codigo,
      valorMin,
      valorMax,
      areaMin,
      areaMax,
      quartosMin,
      banheirosMin,
      suitesMin,
      vagasMin,
      caracteristicas,
    };
  }

  function navigateWithFilters(filters: ImoveisPublicosFilters) {
    const params = buildImoveisSearchParams(filters);
    const query = params.toString();
    router.push(`${link("/imoveis")}${query ? `?${query}` : ""}`);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateWithFilters(buildFiltersFromState(readFilterState()));
    onSearchComplete?.();
  }

  function handleClear() {
    const empty = createEmptyFilterState(fixedFinalidade);

    setFinalidades(empty.finalidades);
    setTipos(empty.tipos);
    setSelectedCidades(empty.selectedCidades);
    setSelectedBairros(empty.selectedBairros);
    setCodigo(empty.codigo);
    setValorMin(empty.valorMin);
    setValorMax(empty.valorMax);
    setAreaMin(empty.areaMin);
    setAreaMax(empty.areaMax);
    setQuartosMin(empty.quartosMin);
    setBanheirosMin(empty.banheirosMin);
    setSuitesMin(empty.suitesMin);
    setVagasMin(empty.vagasMin);
    setCaracteristicas(empty.caracteristicas);

    navigateWithFilters(buildFiltersFromState(empty));
  }

  const isHero = layout === "hero";
  const isMobile = layout === "mobile";
  const showCaracteristicas = !isHero && !hideCaracteristicas;
  const dropdownMenuMode = isMobile ? "inline" : "portal";

  function toggleCategoria(id: string) {
    setOpenCategorias((current) => ({ ...current, [id]: !current[id] }));
  }

  const filterFields = (
    <>
      {!fixedFinalidade ? (
        <CheckboxFilterDropdown
          label="Finalidade"
          menuMode={dropdownMenuMode}
          options={FINALIDADES_IMOVEL.map((item) => ({
            value: item.value,
            label: item.label,
          }))}
          selected={finalidades}
          onChange={(selected) => setFinalidades(selected as FinalidadeImovel[])}
          placeholder="Todas"
        />
      ) : null}

      <CheckboxFilterDropdown
        label="Tipo de imóvel"
        menuMode={dropdownMenuMode}
        options={TIPOS_IMOVEL.map((item) => ({
          value: item.value,
          label: item.label,
        }))}
        selected={tipos}
        onChange={(selected) => setTipos(selected as TipoImovel[])}
        placeholder="Todos"
      />

      <CheckboxFilterDropdown
        label="Cidade"
        menuMode={dropdownMenuMode}
        options={cidades.map((cidade) => ({ value: cidade, label: cidade }))}
        selected={selectedCidades}
        onChange={setSelectedCidades}
        placeholder="Todas"
      />

      <CheckboxFilterDropdown
        label="Bairro"
        menuMode={dropdownMenuMode}
        options={bairros.map((bairro) => ({ value: bairro, label: bairro }))}
        selected={selectedBairros}
        onChange={setSelectedBairros}
        placeholder="Todos"
      />

      <CountFilterButtons label="Quartos" value={quartosMin} onChange={setQuartosMin} />
      <CountFilterButtons label="Banheiros" value={banheirosMin} onChange={setBanheirosMin} />
      <CountFilterButtons label="Suítes" value={suitesMin} onChange={setSuitesMin} />
      <CountFilterButtons label="Vagas" value={vagasMin} onChange={setVagasMin} />

      <div className="space-y-2">
        <Label>Preço</Label>
        <div className="grid grid-cols-2 gap-2">
          <CurrencyInput
            id="valorMin"
            mode="filter"
            value={valorMin}
            onChange={setValorMin}
          />
          <CurrencyInput
            id="valorMax"
            mode="filter"
            value={valorMax}
            onChange={setValorMax}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Área total</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="areaMin"
            inputMode="numeric"
            value={areaMin}
            onChange={(event) => setAreaMin(event.target.value)}
            placeholder="Mínimo"
          />
          <Input
            id="areaMax"
            inputMode="numeric"
            value={areaMax}
            onChange={(event) => setAreaMax(event.target.value)}
            placeholder="Máximo"
          />
        </div>
      </div>

      {!isHero ? (
        <div className="space-y-2">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            placeholder="Ex: AP101"
          />
        </div>
      ) : null}

      {showCaracteristicas ? (
        <div className="space-y-4">
          <Label>Características</Label>
          {CARACTERISTICAS_CHECKLIST.map((categoria) => (
            <div key={categoria.id} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <button
                type="button"
                onClick={() => toggleCategoria(categoria.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-medium text-foreground">{categoria.titulo}</span>
                {openCategorias[categoria.id] ? (
                  <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {openCategorias[categoria.id] ? (
                <CheckboxList
                  idPrefix={`caracteristica-${categoria.id}`}
                  items={[...categoria.itens]}
                  selected={caracteristicas}
                  onToggle={(item) =>
                    setCaracteristicas((current) => toggleListItem(current, item))
                  }
                  maxHeightClass="max-h-48"
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );

  const filterFooter = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-t border-border bg-white pt-4",
        isHero ? "sm:col-span-2 lg:col-span-3" : "",
      )}
    >
      <button
        type="button"
        onClick={handleClear}
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        Limpar
      </button>
      <Button
        type="submit"
        className="border-transparent px-6 text-white hover:opacity-90"
        style={{ backgroundColor: corSecundaria }}
      >
        <Search className="size-4" />
        Buscar imóveis
      </Button>
    </div>
  );

  if (isHero) {
    return (
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl bg-white p-4 shadow-lg sm:grid-cols-2 lg:grid-cols-3"
      >
        {filterFields}
        {filterFooter}
      </form>
    );
  }

  if (isMobile) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {filterFields}
        {filterFooter}
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="flex-1 space-y-5 overflow-y-auto p-4">{filterFields}</div>
      <div className="px-4 pb-4">{filterFooter}</div>
    </form>
  );
}
