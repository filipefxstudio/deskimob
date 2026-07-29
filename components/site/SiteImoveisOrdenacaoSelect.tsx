"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildImoveisSearchParams } from "@/lib/site/filters";
import {
  ORDENACAO_IMOVEIS_OPTIONS,
  type ImoveisPublicosFilters,
} from "@/lib/site/imovel-filters";
import { cn } from "@/lib/utils";

import { useSite } from "./SiteProvider";

interface SiteImoveisOrdenacaoSelectProps {
  filters: ImoveisPublicosFilters;
  className?: string;
}

export function SiteImoveisOrdenacaoSelect({
  filters,
  className,
}: SiteImoveisOrdenacaoSelectProps) {
  const router = useRouter();
  const { link } = useSite();
  const value = filters.ordenacao ?? "recentes";

  function handleChange(nextValue: string) {
    const params = buildImoveisSearchParams(
      {
        ...filters,
        ordenacao:
          nextValue === "recentes"
            ? undefined
            : (nextValue as ImoveisPublicosFilters["ordenacao"]),
        pagina: 1,
      },
    );
    const query = params.toString();
    router.push(`${link("/imoveis")}${query ? `?${query}` : ""}`);
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className={cn("h-10 min-w-0 flex-1 bg-white", className)}>
        <span className="inline-flex min-w-0 items-center gap-2 truncate">
          <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Ordenar por" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {ORDENACAO_IMOVEIS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
