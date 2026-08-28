"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { ListingScrollRestore } from "@/components/site/ListingScrollRestore";
import { FiltrosBusca } from "@/components/site/FiltrosBusca";
import { ImoveisSimilaresSection } from "@/components/site/ImoveisSimilaresSection";
import { ImovelCardPublico } from "@/components/site/ImovelCardPublico";
import { SiteImoveisOrdenacaoSelect } from "@/components/site/SiteImoveisOrdenacaoSelect";
import { SitePagination } from "@/components/site/SitePagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImoveisPublicosFilters } from "@/lib/site/imovel-filters";
import {
  LISTING_MOBILE_HEADER_HEIGHT_PX,
  useListingChromeHeader,
} from "@/lib/site/listing-chrome-header";
import { getSiteThemeStyle } from "@/lib/site/theme-style";
import type { FinalidadeImovel, Imovel } from "@/types";

import { useSite } from "./SiteProvider";

interface SiteImoveisListingViewProps {
  bairros: string[];
  cidades: string[];
  filters: ImoveisPublicosFilters;
  fixedFinalidade?: FinalidadeImovel;
  imoveis: Imovel[];
  similares: Imovel[];
  pagina: number;
  totalPaginas: number;
  title: string;
  subtitle?: string;
  emptyMessage: string;
  inicio: number;
  fim: number;
  total: number;
}

export function SiteImoveisListingView({
  bairros,
  cidades,
  filters,
  fixedFinalidade,
  imoveis,
  similares,
  pagina,
  totalPaginas,
  title,
  subtitle,
  emptyMessage,
  inicio,
  fim,
  total,
}: SiteImoveisListingViewProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { corretor } = useSite();
  const { enabled: chromeHeaderEnabled, headerOffset } = useListingChromeHeader();
  const siteThemeStyle = getSiteThemeStyle(corretor);

  const resultsLabel =
    subtitle ??
    (total === 0
      ? "Nenhum resultado"
      : `${total} ${total === 1 ? "resultado" : "resultados"} encontrados${total > 0 ? ` · exibindo ${inicio}–${fim}` : ""}`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <ListingScrollRestore />
      {chromeHeaderEnabled ? (
        <div aria-hidden="true" className="pointer-events-none h-24 lg:hidden" />
      ) : null}

      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{resultsLabel}</p>
      </div>

      {chromeHeaderEnabled ? (
        <div
          className="-mx-4 sticky z-30 mb-4 border-b border-border bg-white px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden"
          style={{
            top: LISTING_MOBILE_HEADER_HEIGHT_PX - headerOffset,
          }}
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 gap-2 px-4"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
              Filtrar
            </Button>
            <SiteImoveisOrdenacaoSelect filters={filters} />
          </div>
        </div>
      ) : null}

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent
          className="flex max-h-[min(92vh,820px)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full"
          style={siteThemeStyle}
        >
          <DialogHeader className="border-b border-border px-4 py-4 text-left">
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <FiltrosBusca
              bairros={bairros}
              cidades={cidades}
              initialValues={filters}
              layout="mobile"
              fixedFinalidade={fixedFinalidade}
              hideCaracteristicas
              onSearchComplete={() => setFiltersOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <FiltrosBusca
            bairros={bairros}
            cidades={cidades}
            initialValues={filters}
            layout="sidebar"
            fixedFinalidade={fixedFinalidade}
          />
        </aside>

        <div>
          <div className="mb-4 hidden items-center justify-end lg:flex">
            <div className="w-56">
              <SiteImoveisOrdenacaoSelect filters={filters} />
            </div>
          </div>

          {imoveis.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {imoveis.map((imovel) => (
                  <ImovelCardPublico key={imovel.id} imovel={imovel} />
                ))}
              </div>

              <div className="mt-10">
                <SitePagination
                  filters={filters}
                  pagina={pagina}
                  totalPaginas={totalPaginas}
                />
              </div>

              <ImoveisSimilaresSection imoveis={similares} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
