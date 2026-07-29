"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buildImoveisSearchParams } from "@/lib/site/filters";
import type { ImoveisPublicosFilters } from "@/lib/site/queries";
import { cn } from "@/lib/utils";

import { useSite } from "./SiteProvider";

interface SitePaginationProps {
  filters: ImoveisPublicosFilters;
  pagina: number;
  totalPaginas: number;
}

function buildPageHref(
  link: (path: string) => string,
  filters: ImoveisPublicosFilters,
  pagina: number,
): string {
  const params = buildImoveisSearchParams(filters, { pagina });
  const query = params.toString();
  return `${link("/imoveis")}${query ? `?${query}` : ""}`;
}

export function SitePagination({ filters, pagina, totalPaginas }: SitePaginationProps) {
  const { link } = useSite();

  if (totalPaginas <= 1) {
    return null;
  }

  const pages: number[] = [];
  const start = Math.max(1, pagina - 2);
  const end = Math.min(totalPaginas, pagina + 2);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  return (
    <nav aria-label="Paginação de imóveis" className="flex items-center justify-center gap-1">
      {pagina > 1 ? (
        <Link
          href={buildPageHref(link, filters, pagina - 1)}
          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-sm hover:bg-muted"
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className="inline-flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground/40">
          <ChevronLeft className="size-4" />
        </span>
      )}

      {start > 1 ? (
        <>
          <Link
            href={buildPageHref(link, filters, 1)}
            className="inline-flex min-w-9 items-center justify-center rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted"
          >
            1
          </Link>
          {start > 2 ? <span className="px-1 text-muted-foreground">…</span> : null}
        </>
      ) : null}

      {pages.map((page) => (
        <Link
          key={page}
          href={buildPageHref(link, filters, page)}
          aria-current={page === pagina ? "page" : undefined}
          className={cn(
            "inline-flex min-w-9 items-center justify-center rounded-md border px-2 py-1.5 text-sm",
            page === pagina
              ? "border-primary bg-primary text-white"
              : "border-border hover:bg-muted",
          )}
        >
          {page}
        </Link>
      ))}

      {end < totalPaginas ? (
        <>
          {end < totalPaginas - 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
          <Link
            href={buildPageHref(link, filters, totalPaginas)}
            className="inline-flex min-w-9 items-center justify-center rounded-md border border-border px-2 py-1.5 text-sm hover:bg-muted"
          >
            {totalPaginas}
          </Link>
        </>
      ) : null}

      {pagina < totalPaginas ? (
        <Link
          href={buildPageHref(link, filters, pagina + 1)}
          className="inline-flex size-9 items-center justify-center rounded-md border border-border text-sm hover:bg-muted"
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className="inline-flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground/40">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
