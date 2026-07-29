"use client";

import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Images,
  MapPin,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";

import { ImovelMapa } from "@/components/site/ImovelMapa";
import { getVideoEmbedUrl } from "@/lib/imoveis/video-embed";
import type { ImovelFoto } from "@/types";

const GALLERY_HEIGHT = 480;
const FOTOS_VISIVEIS = 2;

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
  /** Quebra para largura total do container pai (ex.: -mx-4 md:-mx-6). */
  breakoutClassName?: string;
}

function FotoSlot({
  foto,
  titulo,
  indice,
  onOpenLightbox,
}: {
  foto: ImovelFoto;
  titulo: string;
  indice: number;
  onOpenLightbox: (indice: number) => void;
}) {
  const [retrato, setRetrato] = useState<boolean | null>(null);

  return (
    <button
      type="button"
      onClick={() => onOpenLightbox(indice)}
      className="relative flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-neutral-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.url}
        alt={foto.legenda ?? `${titulo} ${indice + 1}`}
        className={
          retrato === null
            ? "max-h-full max-w-full object-contain"
            : retrato
              ? "max-h-full max-w-full object-contain"
              : "size-full object-cover"
        }
        onLoad={(event) => {
          const img = event.currentTarget;
          setRetrato(img.naturalHeight > img.naturalWidth);
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
  const [viewMode, setViewMode] = useState<ViewMode>("fotos");
  const [indiceInicio, setIndiceInicio] = useState(0);

  const videoEmbedUrl = useMemo(() => getVideoEmbedUrl(videoUrl), [videoUrl]);
  const temVideo = Boolean(videoEmbedUrl);
  const temMapa = Boolean(mapa?.latitude && mapa?.longitude);
  const maxIndiceInicio = Math.max(0, fotos.length - FOTOS_VISIVEIS);
  const fotosVisiveis = fotos.slice(indiceInicio, indiceInicio + FOTOS_VISIVEIS);
  const podeAnterior = indiceInicio > 0;
  const podeProximo = indiceInicio < maxIndiceInicio;

  function irAnterior() {
    setIndiceInicio((atual) => Math.max(0, atual - 1));
  }

  function irProximo() {
    setIndiceInicio((atual) => Math.min(maxIndiceInicio, atual + 1));
  }

  return (
    <div className={`w-full ${breakoutClassName}`}>
      <div
        className="relative w-full overflow-hidden bg-neutral-900"
        style={{ height: GALLERY_HEIGHT }}
      >
        {viewMode === "fotos" ? (
          <>
            <div className="flex h-full">
              {fotosVisiveis.map((foto, offset) => (
                <FotoSlot
                  key={foto.id}
                  foto={foto}
                  titulo={titulo}
                  indice={indiceInicio + offset}
                  onOpenLightbox={onOpenLightbox}
                />
              ))}
            </div>

            {fotos.length > FOTOS_VISIVEIS ? (
              <>
                {podeAnterior ? (
                  <button
                    type="button"
                    onClick={irAnterior}
                    className="absolute left-4 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md transition hover:bg-white"
                    aria-label="Fotos anteriores"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                ) : null}

                {podeProximo ? (
                  <button
                    type="button"
                    onClick={irProximo}
                    className="absolute right-4 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md transition hover:bg-white"
                    aria-label="Próximas fotos"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                ) : null}
              </>
            ) : null}

            <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenLightbox(indiceInicio)}
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
              className="absolute bottom-4 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-neutral-800 shadow-md transition hover:bg-white"
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
              className="absolute bottom-4 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-neutral-800 shadow-md transition hover:bg-white"
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
