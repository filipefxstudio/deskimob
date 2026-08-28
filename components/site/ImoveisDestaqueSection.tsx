"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { FinalidadeImovel, Imovel } from "@/types";

import { ImovelCardPublico } from "./ImovelCardPublico";
import { useSite } from "./SiteProvider";

interface ImoveisDestaqueSectionProps {
  imoveis: Imovel[];
}

export function ImoveisDestaqueSection({ imoveis }: ImoveisDestaqueSectionProps) {
  const { link, hasImoveisLocacao } = useSite();
  const [finalidade, setFinalidade] = useState<FinalidadeImovel>("venda");

  const filtrados = useMemo(
    () => imoveis.filter((imovel) => imovel.finalidade === finalidade).slice(0, 6),
    [imoveis, finalidade],
  );

  const listagemHref =
    finalidade === "venda" ? link("/comprar") : link("/alugar");

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Imóveis em Destaque</h2>
          <p className="mt-2 text-muted-foreground">
            Oportunidades selecionadas para compra e locação.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFinalidade("venda")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              finalidade === "venda"
                ? "bg-primary text-white"
                : "bg-muted text-[#2D3748] hover:bg-muted/80"
            }`}
          >
            Comprar
          </button>
          {hasImoveisLocacao ? (
            <button
              type="button"
              onClick={() => setFinalidade("locacao")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                finalidade === "locacao"
                  ? "bg-primary text-white"
                  : "bg-muted text-[#2D3748] hover:bg-muted/80"
              }`}
            >
              Alugar
            </button>
          ) : null}
        </div>
      </div>

      {filtrados.length > 0 ? (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((imovel) => (
              <ImovelCardPublico key={imovel.id} imovel={imovel} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline">
              <Link href={listagemHref}>Ver todos</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Nenhum imóvel em destaque para{" "}
          {finalidade === "venda" ? "compra" : "locação"} no momento.
        </div>
      )}
    </section>
  );
}
