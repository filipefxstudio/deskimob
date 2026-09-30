"use client";

import { SITUACAO_LEAD_LABELS } from "@/lib/constants/atendimentos";
import type { SituacaoLead } from "@/types";
import { cn } from "@/lib/utils";

const SITUACAO_COLORS: Record<SituacaoLead, string> = {
  em_atendimento: "bg-success/15 text-success",
  descartado: "bg-muted text-muted-foreground",
  negocio_fechado: "bg-success/20 text-[color-mix(in_oklch,var(--success),black_25%)]",
};

interface SituacaoBadgeProps {
  situacao?: SituacaoLead | null;
  className?: string;
}

export function SituacaoBadge({ situacao = "em_atendimento", className }: SituacaoBadgeProps) {
  const value = situacao ?? "em_atendimento";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        SITUACAO_COLORS[value],
        className,
      )}
    >
      {SITUACAO_LEAD_LABELS[value]}
    </span>
  );
}
