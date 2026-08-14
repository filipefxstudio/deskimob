"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Draggable } from "@hello-pangea/dnd";
import { Bot, Globe } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import type { CSSProperties } from "react";

import { LeadInatividadeIndicador } from "@/components/leads/LeadInatividadeIndicador";
import { TemperaturaBadge } from "@/components/leads/TemperaturaBadge";
import { ORIGEM_LEAD_LABELS } from "@/lib/constants/leads";
import type { LeadInatividadeAlertConfig } from "@/lib/leads/inatividade";
import {
  formatTelefoneLead,
  getInteresseResumido,
} from "@/lib/leads/format";
import { cn } from "@/lib/utils";
import type { Lead, OrigemLead } from "@/types";

interface LeadCardProps {
  lead: Lead;
  index: number;
  isUpdating?: boolean;
  alertConfig?: LeadInatividadeAlertConfig;
}

function OrigemIcon({ origem }: { origem: string }) {
  if (origem === "whatsapp") {
    return <WhatsAppIcon className="size-3" />;
  }

  return <Globe className="size-3" />;
}

export { getInteresseResumido };

export function LeadCard({
  lead,
  index,
  isUpdating = false,
  alertConfig,
}: LeadCardProps) {
  const nome = lead.nome?.trim() || "Lead sem nome";
  const interesse = getInteresseResumido(lead);
  const origemLabel =
    lead.origem in ORIGEM_LEAD_LABELS
      ? ORIGEM_LEAD_LABELS[lead.origem as OrigemLead]
      : lead.origem;

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => {
        const { style: dragStyle, ...draggableProps } = provided.draggableProps;

        return (
        <div
          ref={provided.innerRef}
          {...draggableProps}
          {...provided.dragHandleProps}
          style={dragStyle as CSSProperties | undefined}
          className={cn(
            "relative rounded-lg border border-border/70 bg-card p-3 shadow-sm transition-shadow",
            snapshot.isDragging && "shadow-md ring-2 ring-secondary/30",
            isUpdating && "pointer-events-none opacity-60",
          )}
        >
          {isUpdating ? (
            <div className="absolute right-2 top-2 z-10">
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/dashboard/atendimentos/${lead.id}`}
                  className="truncate font-medium text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {nome}
                </Link>
                {lead.atendido_por === "agente_ia" ? (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                    title="Atendido por agente IA"
                  >
                    <Bot className="size-3" />
                    🤖
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTelefoneLead(lead.telefone)}
              </p>
            </div>
            <TemperaturaBadge temperatura={lead.temperatura} showLabel={false} />
          </div>

          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{interesse}</p>

          <div className="mt-2">
            <LeadInatividadeIndicador lead={lead} config={alertConfig} variant="compact" />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                lead.origem === "whatsapp"
                  ? "bg-[#2DC653]/15 text-[#1a7a34]"
                  : "bg-secondary/10 text-secondary",
              )}
            >
              <OrigemIcon origem={lead.origem} />
              {origemLabel}
            </span>
          </div>
        </div>
        );
      }}
    </Draggable>
  );
}
