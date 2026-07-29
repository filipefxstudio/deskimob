"use client";

import { useState } from "react";

import {
  ImovelGaleriaDesktop,
  type ImovelGaleriaMapaProps,
} from "@/components/imoveis/ImovelGaleriaDesktop";
import { ImovelGaleriaLightbox } from "@/components/imoveis/ImovelGaleriaLightbox";
import { ImovelGaleriaMobile } from "@/components/imoveis/ImovelGaleriaMobile";
import type { ImovelFoto } from "@/types";

interface ImovelGaleriaPublicaProps {
  fotos: ImovelFoto[];
  titulo: string;
  videoUrl?: string | null;
  mapa?: ImovelGaleriaMapaProps | null;
}

export function ImovelGaleriaPublica({
  fotos,
  titulo,
  videoUrl,
  mapa,
}: ImovelGaleriaPublicaProps) {
  const ordenadas = [...fotos].sort((a, b) => a.ordem - b.ordem);
  const [indice, setIndice] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (ordenadas.length === 0) {
    return (
      <div className="mb-8 flex aspect-[4/3] w-full max-w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
        Nenhuma foto disponível
      </div>
    );
  }

  function abrirLightbox(fotoIndice: number) {
    setIndice(fotoIndice);
    setLightboxOpen(true);
  }

  return (
    <>
      <div className="mx-auto mb-8 w-full min-w-0 max-w-7xl px-4 sm:px-6 md:hidden lg:px-8">
        <ImovelGaleriaMobile
          fotos={ordenadas}
          titulo={titulo}
          heroObjectFit="contain"
          onOpenLightbox={abrirLightbox}
        />
      </div>

      <div className="mb-8 hidden w-full md:block">
        <ImovelGaleriaDesktop
          fotos={ordenadas}
          titulo={titulo}
          videoUrl={videoUrl}
          mapa={mapa}
          onOpenLightbox={abrirLightbox}
        />
      </div>

      <ImovelGaleriaLightbox
        fotos={ordenadas}
        titulo={titulo}
        indice={indice}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndiceChange={setIndice}
      />
    </>
  );
}
