"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { SiteImovelDetalheBackButton } from "@/components/site/SiteImovelDetalheBackButton";
import { LISTING_MOBILE_HEADER_HEIGHT_PX } from "@/lib/site/listing-chrome-header";
import { cn } from "@/lib/utils";

interface SiteImovelDetalheStickyBarProps {
  imoveisHref: string;
  titulo: string;
}

export function SiteImovelDetalheStickyBar({ imoveisHref, titulo }: SiteImovelDetalheStickyBarProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [barHeight, setBarHeight] = useState(0);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return;
    }

    const measure = () => setBarHeight(bar.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setPinned(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: `-${LISTING_MOBILE_HEADER_HEIGHT_PX}px 0px 0px 0px`,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      <div
        ref={barRef}
        className={cn(
          "z-30 border-b border-border/80 bg-white py-3 shadow-sm",
          pinned ? "fixed inset-x-0 top-24" : "relative",
        )}
      >
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

      {pinned ? <div aria-hidden="true" style={{ height: barHeight }} /> : null}
    </>
  );
}
