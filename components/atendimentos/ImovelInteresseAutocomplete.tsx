"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchImoveisForLead } from "@/lib/actions/leads";
import { formatCurrency, getCapaUrl, getTipoLabel } from "@/lib/site/format";
import type { Imovel } from "@/types";

export type ImovelSearchResult = Awaited<ReturnType<typeof searchImoveisForLead>>[number];

export function imovelToSearchResult(imovel: Imovel): ImovelSearchResult {
  return {
    id: imovel.id,
    titulo: imovel.titulo ?? null,
    codigo: imovel.codigo ?? null,
    bairro: imovel.bairro ?? null,
    logradouro: imovel.logradouro ?? null,
    cidade: imovel.cidade ?? null,
    tipo: imovel.tipo ?? null,
    finalidade: imovel.finalidade ?? null,
    status: imovel.status ?? null,
    valor_venda: imovel.valor_venda ?? null,
    valor_locacao: imovel.valor_locacao ?? null,
    quartos: imovel.quartos ?? null,
    suites: imovel.suites ?? null,
    banheiros: imovel.banheiros ?? null,
    vagas: imovel.vagas ?? null,
    fotos: imovel.fotos ?? [],
  };
}

interface ImovelInteresseAutocompleteProps {
  value: ImovelSearchResult | null;
  onChange: (imovel: ImovelSearchResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ImovelInteresseAutocomplete({
  value,
  onChange,
  placeholder = "Buscar por título, código, bairro, endereço ou proprietário",
  disabled,
}: ImovelInteresseAutocompleteProps) {
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ImovelSearchResult[]>([]);

  useEffect(() => {
    if (!busca.trim() || busca.trim().length < 2 || value) {
      setResultados([]);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const data = await searchImoveisForLead(busca);
        setResultados(data);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [busca, value]);

  function selecionar(imovel: ImovelSearchResult) {
    onChange(imovel);
    setBusca("");
    setResultados([]);
  }

  function limpar() {
    onChange(null);
    setBusca("");
    setResultados([]);
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <ImovelThumb imovel={value} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{value.titulo ?? value.codigo}</p>
            <p className="text-xs text-muted-foreground">
              {value.codigo}
              {value.tipo ? ` · ${getTipoLabel(value.tipo)}` : ""}
              {value.bairro ? ` · ${value.bairro}` : ""}
            </p>
            <ImovelValor imovel={value} />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={limpar} disabled={disabled}>
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex gap-2">
            <Input
              placeholder={placeholder}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              disabled={disabled}
            />
            {isPending ? (
              <div className="flex items-center px-2">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center px-2 text-muted-foreground">
                <Search className="size-4" />
              </div>
            )}
          </div>
          {resultados.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
              {resultados.map((imovel) => (
                <li key={imovel.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => selecionar(imovel)}
                  >
                    <ImovelThumb imovel={imovel} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {imovel.titulo ?? imovel.codigo}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {imovel.codigo}
                        {imovel.tipo ? ` · ${getTipoLabel(imovel.tipo)}` : ""}
                        {imovel.bairro ? ` · ${imovel.bairro}` : ""}
                      </p>
                      <ImovelValor imovel={imovel} className="text-xs" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : busca.trim().length >= 2 && !isPending ? (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ImovelThumb({ imovel }: { imovel: ImovelSearchResult }) {
  const capa = imovel.fotos?.length ? getCapaUrl(imovel as Imovel) : null;

  return (
    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
      {capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={capa} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
          —
        </div>
      )}
    </div>
  );
}

function ImovelValor({
  imovel,
  className,
}: {
  imovel: ImovelSearchResult;
  className?: string;
}) {
  const valor = imovel.valor_venda ?? imovel.valor_locacao;
  if (valor == null) return null;

  return (
    <p className={className ?? "text-sm font-semibold text-primary"}>
      {formatCurrency(valor)}
      {imovel.finalidade === "locacao" ? "/mês" : ""}
    </p>
  );
}
