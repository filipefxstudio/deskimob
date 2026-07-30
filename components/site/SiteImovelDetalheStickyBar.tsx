"use client";

import Link from "next/link";

import { SiteImovelDetalheBackButton } from "@/components/site/SiteImovelDetalheBackButton";

interface SiteImovelDetalheStickyBarProps {
  imoveisHref: string;
  titulo: string;
}

export function SiteImovelDetalheStickyBar({ imoveisHref, titulo }: SiteImovelDetalheStickyBarProps) {
  return (
    <div className="sticky top-24 z-30 border-b border-border/80 bg-white/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 sm:px-6 lg:px-8">
        <SiteImovelDetalheBackButton className="mb-0 w-fit shrink-0" />

        <nav aria-label="Breadcrumb" className="hidden min-w-0 text-sm text-muted-foreground sm:block">
          <Link href={imoveisHref} className="hover:text-primary">
            Imóveis
          </Link>
          <span className="mx-2">/</span>
          <span className="break-words">{titulo}</span>
        </nav>
      </div>
    </div>
  );
}
