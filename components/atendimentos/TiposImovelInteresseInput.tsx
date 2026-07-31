"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { TipoImovelCustom } from "@/types";

interface TiposImovelInteresseInputProps {
  value: string[];
  onChange: (tipos: string[]) => void;
  tipos: TipoImovelCustom[];
  disabled?: boolean;
}

export function TiposImovelInteresseInput({
  value,
  onChange,
  tipos,
  disabled,
}: TiposImovelInteresseInputProps) {
  function toggleTipo(slug: string, checked: boolean) {
    const normalizado = slug.trim().toLowerCase();
    if (checked) {
      if (value.includes(normalizado)) return;
      onChange([...value, normalizado]);
      return;
    }
    onChange(value.filter((item) => item !== normalizado));
  }

  if (tipos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum tipo de imóvel cadastrado.</p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {tipos.map((tipo) => {
        const slug = tipo.nome.trim().toLowerCase();
        const checked = value.includes(slug);

        return (
          <label
            key={tipo.id}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm transition-colors",
              checked ? "border-primary/40 bg-primary/5" : "hover:bg-muted/40",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => toggleTipo(slug, next === true)}
            />
            <span>{tipo.nome}</span>
          </label>
        );
      })}
    </div>
  );
}
