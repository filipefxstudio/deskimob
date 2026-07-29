"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type { ImovelFoto } from "@/types";

const PREVIEW_FOTOS = 5;

interface ImovelCardFotoCarouselProps {
  fotos: ImovelFoto[];
  alt: string;
  className?: string;
  imageClassName?: string;
  badges?: ReactNode;
  emptyLabel?: string;
}

export function ImovelCardFotoCarousel({
  fotos,
  alt,
  className = "relative aspect-[4/3] overflow-hidden bg-muted",
  imageClassName = "size-full object-cover transition-transform duration-300 group-hover:scale-105",
  badges,
  emptyLabel = "Sem foto",
}: ImovelCardFotoCarouselProps) {
  const ordenadas = useMemo(
    () => [...fotos].sort((a, b) => a.ordem - b.ordem),
    [fotos],
  );
  const [indice, setIndice] = useState(0);

  const totalSlides =
    ordenadas.length > PREVIEW_FOTOS ? PREVIEW_FOTOS + 1 : ordenadas.length;
  const slideOverflow = indice === PREVIEW_FOTOS && ordenadas.length > PREVIEW_FOTOS;
  const fotoAtual = slideOverflow
    ? ordenadas[PREVIEW_FOTOS - 1]
    : ordenadas[indice];
  const fotosRestantes = Math.max(0, ordenadas.length - PREVIEW_FOTOS);

  const podeAnterior = indice > 0;
  const podeProximo = indice < totalSlides - 1;

  function irAnterior(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIndice((atual) => Math.max(0, atual - 1));
  }

  function irProximo(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setIndice((atual) => Math.min(totalSlides - 1, atual + 1));
  }

  if (ordenadas.length === 0) {
    return (
      <div className={className}>
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
        {badges}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fotoAtual.url} alt={fotoAtual.legenda ?? alt} className={imageClassName} />

      {slideOverflow ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-base font-semibold text-white">
          +{fotosRestantes} {fotosRestantes === 1 ? "foto" : "fotos"}
        </span>
      ) : null}

      {badges}

      {totalSlides > 1 ? (
        <>
          {podeAnterior ? (
            <button
              type="button"
              onClick={irAnterior}
              className="absolute left-2 top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-sm transition hover:bg-white"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}

          {podeProximo ? (
            <button
              type="button"
              onClick={irProximo}
              className="absolute right-2 top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-sm transition hover:bg-white"
              aria-label="Próxima foto"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
