"use client";

import { useState } from "react";

import {
  ImovelGaleriaDesktop,
  type ImovelGaleriaMapaProps,
} from "@/components/imoveis/ImovelGaleriaDesktop";
import { ImovelGaleriaLightbox } from "@/components/imoveis/ImovelGaleriaLightbox";
import { ImovelGaleriaMobile } from "@/components/imoveis/ImovelGaleriaMobile";
import type { ImovelFoto } from "@/types";

interface ImovelGaleriaDetalhesProps {
  fotos: ImovelFoto[];
  titulo: string;
  videoUrl?: string | null;
  mapa?: ImovelGaleriaMapaProps | null;
}

export function ImovelGaleriaDetalhes({
  fotos,
  titulo,
  videoUrl,
  mapa,
}: ImovelGaleriaDetalhesProps) {
  const ordenadas = [...fotos].sort((a, b) => a.ordem - b.ordem);
  const [indice, setIndice] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (ordenadas.length === 0) {
    return (
      <div className="mb-10 flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted text-muted-foreground">
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
      <div className="mb-10 w-full min-w-0 md:hidden">
        <ImovelGaleriaMobile
          fotos={ordenadas}
          titulo={titulo}
          heroObjectFit="cover"
          onOpenLightbox={abrirLightbox}
        />
      </div>

      <div className="mb-10 hidden md:-mx-6 md:block md:w-[calc(100%+3rem)]">
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
