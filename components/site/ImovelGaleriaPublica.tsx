"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImovelFoto } from "@/types";

interface ImovelGaleriaPublicaProps {
  fotos: ImovelFoto[];
  titulo: string;
}

export function ImovelGaleriaPublica({ fotos, titulo }: ImovelGaleriaPublicaProps) {
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

  const principal = ordenadas[0];
  const totalFotos = ordenadas.length;
  const miniaturas = ordenadas.slice(1, 4);
  const excedente = totalFotos > 4 ? totalFotos - 4 : 0;

  function abrirLightbox(fotoIndice: number) {
    setIndice(fotoIndice);
    setLightboxOpen(true);
  }

  function irPara(novoIndice: number) {
    const total = ordenadas.length;
    setIndice((novoIndice + total) % total);
  }

  function renderMiniatura(foto: ImovelFoto, fotoIndice: number, mostrarContador: boolean) {
    return (
      <button
        key={foto.id}
        type="button"
        onClick={() => abrirLightbox(fotoIndice)}
        className="relative h-full w-full min-h-0 overflow-hidden rounded-lg bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto.url}
          alt={foto.legenda ?? `${titulo} ${fotoIndice + 1}`}
          className="h-full w-full object-cover"
        />
        {mostrarContador ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
            +{excedente} fotos
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <>
      <div className="mb-8 w-full max-w-full min-w-0">
        <div className="flex flex-col gap-2 md:hidden">
          <button
            type="button"
            onClick={() => abrirLightbox(0)}
            className="relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-xl bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={principal.url}
              alt={principal.legenda ?? titulo}
              className="size-full object-contain"
            />
          </button>

          {miniaturas.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {miniaturas.map((foto, miniaturaIndice) => {
                const fotoIndice = miniaturaIndice + 1;
                const isUltima = miniaturaIndice === miniaturas.length - 1;
                const mostrarContador = excedente > 0 && isUltima;

                return (
                  <div key={foto.id} className="aspect-[4/3]">
                    {renderMiniatura(foto, fotoIndice, mostrarContador)}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div
          className={`box-border hidden w-full max-w-full min-w-0 aspect-[4/3] max-h-[420px] items-stretch gap-2 md:grid ${
            miniaturas.length > 0 ? "grid-cols-[2fr_1fr]" : "grid-cols-1"
          }`}
        >
          <button
            type="button"
            onClick={() => abrirLightbox(0)}
            className="relative h-full w-full overflow-hidden rounded-lg bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={principal.url}
              alt={principal.legenda ?? titulo}
              className="h-full w-full object-cover"
            />
          </button>

          {miniaturas.length > 0 ? (
            <div className="box-border grid h-full min-h-0 grid-rows-[1fr_1fr_1fr] gap-1">
              {miniaturas.map((foto, miniaturaIndice) => {
                const fotoIndice = miniaturaIndice + 1;
                const isUltima = miniaturaIndice === miniaturas.length - 1;
                const mostrarContador = excedente > 0 && isUltima;

                return renderMiniatura(foto, fotoIndice, mostrarContador);
              })}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl border-none bg-black/95 p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">Galeria de fotos — {titulo}</DialogTitle>

          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ordenadas[indice].url}
              alt={ordenadas[indice].legenda ?? titulo}
              className="max-h-[80vh] w-full object-contain"
            />

            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Fechar galeria"
            >
              <X className="size-5" />
            </button>

            {ordenadas.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => irPara(indice - 1)}
                  className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => irPara(indice + 1)}
                  className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                  {indice + 1} / {ordenadas.length}
                </span>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
