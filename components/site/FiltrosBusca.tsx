"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARACTERISTICAS_CHECKLIST } from "@/lib/constants/caracteristicas-checklist";
import { FINALIDADES_IMOVEL, TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import { buildImoveisSearchParams } from "@/lib/site/filters";
import type { ImoveisPublicosFilters } from "@/lib/site/queries";
import { cn } from "@/lib/utils";
import type { FinalidadeImovel, TipoImovel } from "@/types";

import { useSite } from "./SiteProvider";

interface FiltrosBuscaProps {
  bairros?: string[];
  cidades?: string[];
  initialValues?: ImoveisPublicosFilters;
  layout?: "hero" | "sidebar";
  fixedFinalidade?: FinalidadeImovel;
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
}: FiltrosBuscaProps) {
  const router = useRouter();
  const { link } = useSite();

  const initialTipos =
    initialValues.tipos?.length
      ? initialValues.tipos
      : initialValues.tipo
        ? [initialValues.tipo]
        : [];

  const [finalidade, setFinalidade] = useState<FinalidadeImovel | undefined>(
    fixedFinalidade ?? initialValues.finalidade ?? undefined,
  );
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
  const [valorMin, setValorMin] = useState(
    initialValues.valorMin ? String(initialValues.valorMin) : "",
  );
  const [valorMax, setValorMax] = useState(
    initialValues.valorMax ? String(initialValues.valorMax) : "",
  );
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const filters: ImoveisPublicosFilters = {
      finalidade: fixedFinalidade ?? finalidade,
      tipos: tipos.length > 0 ? tipos : undefined,
      cidades: selectedCidades.length > 0 ? selectedCidades : undefined,
      bairros: selectedBairros.length > 0 ? selectedBairros : undefined,
      codigo: codigo.trim() || undefined,
      valorMin: valorMin ? Number(valorMin.replace(/\D/g, "")) : undefined,
      valorMax: valorMax ? Number(valorMax.replace(/\D/g, "")) : undefined,
      areaMin: areaMin ? Number(areaMin.replace(/\D/g, "")) : undefined,
      areaMax: areaMax ? Number(areaMax.replace(/\D/g, "")) : undefined,
      quartosMin,
      banheirosMin,
      suitesMin,
      vagasMin,
      caracteristicas: caracteristicas.length > 0 ? caracteristicas : undefined,
      pagina: 1,
    };

    const params = buildImoveisSearchParams(filters);
    const query = params.toString();
    router.push(`${link("/imoveis")}${query ? `?${query}` : ""}`);
  }

  const isHero = layout === "hero";

  function toggleCategoria(id: string) {
    setOpenCategorias((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isHero
          ? "grid gap-4 rounded-2xl bg-white p-4 shadow-lg sm:grid-cols-2 lg:grid-cols-3"
          : "space-y-5 rounded-xl border border-border bg-white p-4 shadow-sm"
      }
    >
      {!fixedFinalidade ? (
        <div className="space-y-2">
          <Label>Finalidade</Label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
            {FINALIDADES_IMOVEL.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  setFinalidade(finalidade === item.value ? undefined : item.value)
                }
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  finalidade === item.value
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Tipo de imóvel</Label>
        <div className="space-y-2">
          {TIPOS_IMOVEL.map((item) => {
            const id = `tipo-${item.value}`;
            return (
              <label key={item.value} htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  id={id}
                  checked={tipos.includes(item.value)}
                  onCheckedChange={() =>
                    setTipos((current) => toggleListItem(current, item.value))
                  }
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cidade</Label>
        <CheckboxList
          idPrefix="cidade"
          items={cidades}
          selected={selectedCidades}
          onToggle={(item) => setSelectedCidades((current) => toggleListItem(current, item))}
        />
      </div>

      <div className="space-y-2">
        <Label>Bairro</Label>
        <CheckboxList
          idPrefix="bairro"
          items={bairros}
          selected={selectedBairros}
          onToggle={(item) => setSelectedBairros((current) => toggleListItem(current, item))}
        />
      </div>

      <CountFilterButtons label="Quartos" value={quartosMin} onChange={setQuartosMin} />
      <CountFilterButtons label="Banheiros" value={banheirosMin} onChange={setBanheirosMin} />
      <CountFilterButtons label="Suítes" value={suitesMin} onChange={setSuitesMin} />
      <CountFilterButtons label="Vagas" value={vagasMin} onChange={setVagasMin} />

      <div className="space-y-2">
        <Label>Preço</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="valorMin"
            inputMode="numeric"
            value={valorMin}
            onChange={(event) => setValorMin(event.target.value)}
            placeholder="Mínimo"
          />
          <Input
            id="valorMax"
            inputMode="numeric"
            value={valorMax}
            onChange={(event) => setValorMax(event.target.value)}
            placeholder="Máximo"
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

      <div className={isHero ? "sm:col-span-2 lg:col-span-3" : ""}>
        <Button
          type="submit"
          className="w-full text-white hover:opacity-90"
          style={{ backgroundColor: "var(--color-secondary)" }}
        >
          <Search className="size-4" />
          Buscar imóveis
        </Button>
      </div>
    </form>
  );
}
