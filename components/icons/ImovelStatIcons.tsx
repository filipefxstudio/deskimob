import type { HTMLAttributes } from "react";

import { MaterialSymbol } from "@/components/icons/MaterialSymbol";
import { cn } from "@/lib/utils";

type ImovelStatIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** `card` para listagens; `detail` para páginas de detalhe. */
  size?: "card" | "detail";
};

const sizeClass = {
  card: "text-[22px]",
  detail: "text-[32px]",
} as const;

function createImovelStatIcon(name: string) {
  return function ImovelStatIcon({ className, size = "card", ...props }: ImovelStatIconProps) {
    return (
      <MaterialSymbol
        name={name}
        className={cn(sizeClass[size], className)}
        {...props}
      />
    );
  };
}

/** King bed — quartos. */
export const IconQuartos = createImovelStatIcon("king_bed");

/** Bathtub — suítes. */
export const IconSuite = createImovelStatIcon("bathtub");

/** Shower — banheiros. */
export const IconBanheiro = createImovelStatIcon("shower");

/** Directions car — vagas. */
export const IconVagas = createImovelStatIcon("directions_car");

/** Straighten — área útil. */
export const IconAreaUtil = createImovelStatIcon("straighten");

/** Open in full — área total (somente detalhes). */
export const IconAreaTotal = createImovelStatIcon("open_in_full");
