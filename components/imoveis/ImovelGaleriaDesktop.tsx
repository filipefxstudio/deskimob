"use client";

import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Images,
  MapPin,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ImovelMapa } from "@/components/site/ImovelMapa";
import { getVideoEmbedUrl } from "@/lib/imoveis/video-embed";
import type { ImovelFoto } from "@/types";

const GALLERY_HEIGHT = 480;
const GAP_PX = 8;
/** ~2,5 fotos paisagem visíveis por vez (40% da largura cada). */
const LANDSCAPE_WIDTH_FRACTION = 0.4;

export type ImovelGaleriaMapaProps = {
  latitude: number;
  longitude: number;
  endereco?: string;
};

type ViewMode = "fotos" | "video" | "mapa";

interface ImovelGaleriaDesktopProps {
  fotos: ImovelFoto[];
  titulo: string;
  videoUrl?: string | null;
  mapa?: ImovelGaleriaMapaProps | null;
  onOpenLightbox: (indice: number) => void;
  breakoutClassName?: string;
}

function calcScrollOffset(widths: number[], startIndex: number): number {
  let offset = 0;
  for (let i = 0; i < startIndex; i += 1) {
    offset += widths[i] + GAP_PX;
  }
  return offset;
}

function calcTotalWidth(widths: number[]): number {
  if (widths.length === 0) {
    return 0;
  }
  return widths.reduce((acc, width) => acc + width, 0) + GAP_PX * (widths.length - 1);
}

function findLeadingIndex(widths: number[], scrollPx: number): number {
  let offset = 0;

  for (let i = 0; i < widths.length; i += 1) {
    const nextOffset = offset + widths[i] + GAP_PX;
    if (scrollPx < nextOffset - GAP_PX / 2 || i === widths.length - 1) {
      return i;
    }
    offset = nextOffset;
  }

  return 0;
}

function FotoSlot({
  foto,
  titulo,
  indice,
  width,
  isPortrait,
  onOpenLightbox,
  onAspect,
}: {
  foto: ImovelFoto;
  titulo: string;
  indice: number;
  width: number;
  isPortrait: boolean | null;
  onOpenLightbox: (indice: number) => void;
  onAspect: (fotoId: string, aspect: number) => void;
}) {
  const imgClassName =
    isPortrait === false
      ? "size-full object-cover"
      : "max-h-full max-w-full object-contain";

  return (
    <button
      type="button"
      onClick={() => onOpenLightbox(indice)}
      style={{ width, height: GALLERY_HEIGHT, flexShrink: 0 }}
      className="flex items-center justify-center overflow-hidden bg-neutral-200"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.url}
        alt={foto.legenda ?? `${titulo} ${indice + 1}`}
        className={imgClassName}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            onAspect(foto.id, img.naturalWidth / img.naturalHeight);
          }
        }}
      />
    </button>
  );
}

export function ImovelGaleriaDesktop({
  fotos,
  titulo,
  videoUrl,
  mapa,
  onOpenLightbox,
  breakoutClassName = "",
}: ImovelGaleriaDesktopProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("fotos");
  const [scrollPx, setScrollPx] = useState(0);
  const [aspects, setAspects] = useState<Record<string, number>>({});

  const videoEmbedUrl = useMemo(() => getVideoEmbedUrl(videoUrl), [videoUrl]);
  const temVideo = Boolean(videoEmbedUrl);
  const temMapa = Boolean(mapa?.latitude && mapa?.longitude);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setContainerWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  const handleAspect = useCallback((fotoId: string, aspect: number) => {
    setAspects((atual) => {
      if (atual[fotoId] === aspect) {
        return atual;
      }
      return { ...atual, [fotoId]: aspect };
    });
  }, []);

  const widths = useMemo(() => {
    const fallback = containerWidth > 0 ? containerWidth * LANDSCAPE_WIDTH_FRACTION : 320;

    return fotos.map((foto) => {
      const aspect = aspects[foto.id];
      if (!aspect || containerWidth === 0) {
        return fallback;
      }

      if (aspect < 1) {
        return GALLERY_HEIGHT * aspect;
      }

      return containerWidth * LANDSCAPE_WIDTH_FRACTION;
    });
  }, [aspects, containerWidth, fotos]);

  const totalWidth = useMemo(() => calcTotalWidth(widths), [widths]);

  const maxScrollPx = useMemo(
    () => Math.max(0, totalWidth - containerWidth),
    [totalWidth, containerWidth],
  );

  useEffect(() => {
    setScrollPx((atual) => Math.min(atual, maxScrollPx));
  }, [maxScrollPx]);

  const indiceVisivel = useMemo(
    () => findLeadingIndex(widths, scrollPx),
    [widths, scrollPx],
  );

  const podeAnterior = scrollPx > 1;
  const podeProximo = fotos.length > 1 && containerWidth > 0 && scrollPx < maxScrollPx - 1;

  function irAnterior() {
    setScrollPx((atual) => {
      const indiceAtual = findLeadingIndex(widths, atual);
      const indiceAlvo = Math.max(0, indiceAtual - 1);
      return calcScrollOffset(widths, indiceAlvo);
    });
  }

  function irProximo() {
    setScrollPx((atual) => {
      if (atual >= maxScrollPx - 1) {
        return atual;
      }

      const indiceAtual = findLeadingIndex(widths, atual);
      const nextByIndex = calcScrollOffset(widths, indiceAtual + 1);

      if (nextByIndex > atual + 1) {
        return Math.min(nextByIndex, maxScrollPx);
      }

      return maxScrollPx;
    });
  }

  return (
    <div className={`w-full ${breakoutClassName}`}>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden bg-neutral-100"
        style={{ height: GALLERY_HEIGHT }}
      >
        {viewMode === "fotos" ? (
          <>
            <div
              className="flex h-full transition-transform duration-300 ease-out"
              style={{
                gap: GAP_PX,
                transform: `translateX(-${scrollPx}px)`,
              }}
            >
              {fotos.map((foto, indice) => {
                const aspect = aspects[foto.id];
                const isPortrait = aspect !== undefined ? aspect < 1 : null;

                return (
                  <FotoSlot
                    key={foto.id}
                    foto={foto}
                    titulo={titulo}
                    indice={indice}
                    width={widths[indice]}
                    isPortrait={isPortrait}
                    onOpenLightbox={onOpenLightbox}
                    onAspect={handleAspect}
                  />
                );
              })}
            </div>

            {fotos.length > 1 && podeAnterior ? (
              <button
                type="button"
                onClick={irAnterior}
                className="absolute left-4 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md transition hover:bg-white"
                aria-label="Fotos anteriores"
              >
                <ChevronLeft className="size-6" />
              </button>
            ) : null}

            {fotos.length > 1 && podeProximo ? (
              <button
                type="button"
                onClick={irProximo}
                className="absolute right-4 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md transition hover:bg-white"
                aria-label="Próximas fotos"
              >
                <ChevronRight className="size-6" />
              </button>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-black/25 to-transparent" />

            <div className="absolute bottom-4 left-4 z-30 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenLightbox(indiceVisivel)}
                className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-neutral-800 shadow-md transition hover:bg-white"
              >
                <Camera className="size-4" />
                {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
              </button>

              {temVideo ? (
                <button
                  type="button"
                  onClick={() => setViewMode("video")}
                  className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-neutral-800 shadow-md transition hover:bg-white"
                >
                  <Video className="size-4" />
                  Vídeo
                </button>
              ) : null}

              {temMapa ? (
                <button
                  type="button"
                  onClick={() => setViewMode("mapa")}
                  className="inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-neutral-800 shadow-md transition hover:bg-white"
                >
                  <MapPin className="size-4" />
                  Mapa
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {viewMode === "video" && videoEmbedUrl ? (
          <div className="relative size-full bg-black">
            <iframe
              title={`Vídeo — ${titulo}`}
              src={videoEmbedUrl}
              className="size-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              type="button"
              onClick={() => setViewMode("fotos")}
              className="absolute bottom-4 left-4 z-20 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-neutral-800 shadow-md transition hover:bg-white"
            >
              <Images className="size-4" />
              Voltar às fotos
            </button>
          </div>
        ) : null}

        {viewMode === "mapa" && mapa ? (
          <div className="relative size-full bg-muted">
            <ImovelMapa
              latitude={mapa.latitude}
              longitude={mapa.longitude}
              endereco={mapa.endereco}
              fill
            />
            <button
              type="button"
              onClick={() => setViewMode("fotos")}
              className="absolute bottom-4 left-4 z-20 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-neutral-800 shadow-md transition hover:bg-white"
            >
              <Images className="size-4" />
              Voltar às fotos
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
