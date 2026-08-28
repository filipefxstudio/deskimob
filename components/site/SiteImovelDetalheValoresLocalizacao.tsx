"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { ImovelMapa } from "@/components/site/ImovelMapa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCurrency,
  getFinalidadeLabel,
  getValorExibicao,
} from "@/lib/site/format";
import type { Imovel } from "@/types";

interface SiteImovelDetalheValoresLocalizacaoProps {
  imovel: Imovel;
  endereco: string;
  hasMap: boolean;
}

function formatValorSecundario(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "R$ —";
  }

  return formatCurrency(value);
}

export function SiteImovelDetalheValoresLocalizacao({
  imovel,
  endereco,
  hasMap,
}: SiteImovelDetalheValoresLocalizacaoProps) {
  const valoresRef = useRef<HTMLDivElement>(null);
  const [localizacaoHeight, setLocalizacaoHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const node = valoresRef.current;
    if (!node) {
      return;
    }

    const syncHeight = () => {
      if (window.innerWidth >= 1024) {
        setLocalizacaoHeight(node.offsetHeight);
      } else {
        setLocalizacaoHeight(undefined);
      }
    };

    syncHeight();

    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
      <div ref={valoresRef}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Valores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{getFinalidadeLabel(imovel.finalidade)}</p>
                <p className="text-3xl font-black tracking-tight text-primary md:text-4xl">
                  {getValorExibicao(imovel)}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Condomínio</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatValorSecundario(imovel.valor_condominio)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IPTU</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatValorSecundario(imovel.valor_iptu)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className="flex min-w-0 flex-col lg:overflow-hidden"
        style={localizacaoHeight != null ? { height: localizacaoHeight } : undefined}
      >
        <CardHeader className="shrink-0 pb-3">
          <CardTitle>Localização</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-4">
          <div className="flex shrink-0 items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p>{endereco || "Endereço não informado"}</p>
          </div>
          {hasMap ? (
            <div className="min-h-0 flex-1 max-lg:h-36">
              <ImovelMapa
                fill
                latitude={imovel.latitude!}
                longitude={imovel.longitude!}
                endereco={endereco}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Mapa indisponível para este imóvel.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
