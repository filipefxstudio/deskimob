"use client";

import { Clock } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTimeBrasilia } from "@/lib/dates/format";
import { getUltimaInteracaoEm } from "@/lib/leads/format";
import {
  formatDiasSemInteracao,
  getDiasSemInteracaoLead,
  getNivelInatividadeLead,
  LEAD_INATIVIDADE_CORES,
  type LeadInatividadeAlertConfig,
} from "@/lib/leads/inatividade";
import { DEFAULT_DASHBOARD_CONFIG } from "@/lib/constants/dashboard";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

interface LeadInatividadeIndicadorProps {
  lead: Lead;
  config?: LeadInatividadeAlertConfig;
  variant?: "default" | "compact";
  className?: string;
}

const DEFAULT_CONFIG: LeadInatividadeAlertConfig = {
  leads_verde_dias: DEFAULT_DASHBOARD_CONFIG.leads_verde_dias,
  leads_amarelo_dias: DEFAULT_DASHBOARD_CONFIG.leads_amarelo_dias,
};

function stopCardNavigation(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function LeadInatividadeIndicador({
  lead,
  config = DEFAULT_CONFIG,
  variant = "default",
  className,
}: LeadInatividadeIndicadorProps) {
  const dias = getDiasSemInteracaoLead(lead);
  const nivel = getNivelInatividadeLead(dias, config);
  const cor = LEAD_INATIVIDADE_CORES[nivel];
  const ultimaInteracao = getUltimaInteracaoEm(lead);
  const diasLabel = formatDiasSemInteracao(dias);
  const ultimaInteracaoLabel = ultimaInteracao
    ? formatDateTimeBrasilia(ultimaInteracao)
    : "Nenhuma interação registrada";
  const ultimaInteracaoCompacta = ultimaInteracao
    ? formatDateTimeBrasilia(ultimaInteracao).split(",")[0]
    : "Sem int.";

  const content = (
    <span
      className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}
      onClick={stopCardNavigation}
      onPointerDown={stopCardNavigation}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full p-1"
        style={{ backgroundColor: `${cor}20`, color: cor }}
        aria-hidden
      >
        <Clock className={variant === "compact" ? "size-3" : "size-3.5"} />
      </span>
      <span className={cn("min-w-0 truncate", variant === "compact" ? "text-[10px]" : "text-xs")}>
        <span className="font-medium" style={{ color: cor }}>
          {diasLabel}
        </span>
        <span className="text-muted-foreground">
          {variant === "compact" ? " s/ int." : " sem interação"}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-foreground">
          {variant === "compact" ? ultimaInteracaoCompacta : ultimaInteracaoLabel}
        </span>
      </span>
    </span>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex max-w-full cursor-default"
            tabIndex={0}
            role="img"
            aria-label={`${diasLabel} sem interação. Última interação: ${ultimaInteracaoLabel}`}
          >
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left">
          <p>{diasLabel} sem interação registrada</p>
          <p className="text-primary-foreground/80">Última interação: {ultimaInteracaoLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
