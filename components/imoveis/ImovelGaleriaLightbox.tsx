"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImovelFoto } from "@/types";

interface ImovelGaleriaLightboxProps {
  fotos: ImovelFoto[];
  titulo: string;
  indice: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndiceChange: (indice: number) => void;
}

export function ImovelGaleriaLightbox({
  fotos,
  titulo,
  indice,
  open,
  onOpenChange,
  onIndiceChange,
}: ImovelGaleriaLightboxProps) {
  if (fotos.length === 0) {
    return null;
  }

  const fotoAtual = fotos[indice];

  function irPara(novoIndice: number) {
    onIndiceChange((novoIndice + fotos.length) % fotos.length);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-none bg-black/95 p-0 sm:max-w-5xl">
        <DialogTitle className="sr-only">Galeria de fotos — {titulo}</DialogTitle>

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAtual.url}
            alt={fotoAtual.legenda ?? titulo}
            className="max-h-[80vh] w-full object-contain"
          />

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label="Fechar galeria"
          >
            <X className="size-5" />
          </button>

          {fotos.length > 1 ? (
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
                {indice + 1} / {fotos.length}
              </span>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
