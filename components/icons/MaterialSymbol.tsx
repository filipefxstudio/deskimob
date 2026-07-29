import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type MaterialSymbolProps = HTMLAttributes<HTMLSpanElement> & {
  name: string;
};

/** Ícone do Google Material Symbols (fonts.google.com/icons). */
export function MaterialSymbol({ name, className, ...props }: MaterialSymbolProps) {
  return (
    <span
      className={cn("material-symbols-outlined inline-block shrink-0 leading-none select-none", className)}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
}
