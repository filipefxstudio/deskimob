"use client";

import { useMemo } from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const labelPorSlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const tipo of tipos) {
      map.set(tipo.nome.trim().toLowerCase(), tipo.nome);
    }
    return map;
  }, [tipos]);

  const rotuloSelecionados = useMemo(() => {
    if (value.length === 0) return null;
    return value
      .map((slug) => labelPorSlug.get(slug) ?? slug)
      .join(", ");
  }, [value, labelPorSlug]);

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          )}
        >
          <span
            className={cn(
              "min-w-0 truncate text-left",
              !rotuloSelecionados && "text-muted-foreground",
            )}
          >
            {rotuloSelecionados ?? "Selecione"}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {tipos.map((tipo) => {
          const slug = tipo.nome.trim().toLowerCase();
          const checked = value.includes(slug);

          return (
            <DropdownMenuCheckboxItem
              key={tipo.id}
              checked={checked}
              onCheckedChange={(next) => toggleTipo(slug, next === true)}
              onSelect={(event) => event.preventDefault()}
            >
              {tipo.nome}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
