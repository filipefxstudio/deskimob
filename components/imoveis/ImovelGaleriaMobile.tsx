"use client";

import type { ImovelFoto } from "@/types";

interface ImovelGaleriaMobileProps {
  fotos: ImovelFoto[];
  titulo: string;
  heroObjectFit?: "contain" | "cover";
  onOpenLightbox: (indice: number) => void;
}

export function ImovelGaleriaMobile({
  fotos,
  titulo,
  heroObjectFit = "contain",
  onOpenLightbox,
}: ImovelGaleriaMobileProps) {
  const principal = fotos[0];
  const miniaturas = fotos.slice(1, 4);
  const excedente = fotos.length > 4 ? fotos.length - 4 : 0;

  function renderMiniatura(foto: ImovelFoto, fotoIndice: number, mostrarContador: boolean) {
    return (
      <button
        key={foto.id}
        type="button"
        onClick={() => onOpenLightbox(fotoIndice)}
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
    <div className="flex flex-col gap-2 md:hidden">
      <button
        type="button"
        onClick={() => onOpenLightbox(0)}
        className="relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-xl bg-muted"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={principal.url}
          alt={principal.legenda ?? titulo}
          className={`size-full ${heroObjectFit === "contain" ? "object-contain" : "object-cover"}`}
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
  );
}
