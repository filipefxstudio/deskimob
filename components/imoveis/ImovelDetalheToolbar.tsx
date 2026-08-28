"use client";

import type { ReactNode, Ref } from "react";

import { ImovelDetalheBackButton } from "@/components/imoveis/ImovelDetalheBackButton";
import { useImoveisListingReturn } from "@/hooks/use-imoveis-listing-return";
import { cn } from "@/lib/utils";

interface ImovelDetalheToolbarProps {
  codigo: string;
  actions?: ReactNode;
  toolbarRef?: Ref<HTMLDivElement>;
  className?: string;
}

export function ImovelDetalheToolbar({
  codigo,
  actions,
  toolbarRef,
  className,
}: ImovelDetalheToolbarProps) {
  const returnToListing = useImoveisListingReturn();

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "sticky top-0 z-30 -mx-4 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <ImovelDetalheBackButton />
          <nav className="text-sm text-muted-foreground">
            <button
              type="button"
              onClick={returnToListing}
              className="hover:text-primary"
            >
              Imóveis
            </button>
            <span className="mx-2">›</span>
            <span className="text-foreground">Detalhes do imóvel {codigo}</span>
          </nav>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
