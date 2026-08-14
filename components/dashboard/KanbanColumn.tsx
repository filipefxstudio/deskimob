"use client";

import { Droppable } from "@hello-pangea/dnd";

import { LeadCard } from "@/components/dashboard/LeadCard";
import { cn } from "@/lib/utils";
import type { LeadInatividadeAlertConfig } from "@/lib/leads/inatividade";
import type { EtapaLead, Lead } from "@/types";

interface KanbanColumnProps {
  etapa: EtapaLead;
  label: string;
  leads: Lead[];
  accent?: "default" | "success" | "danger";
  pendingLeadIds?: Set<string>;
  alertConfig?: LeadInatividadeAlertConfig;
}

const accentStyles = {
  default: "border-border/80 bg-muted/20",
  success: "border-emerald-500/40 bg-emerald-50/80",
  danger: "border-red-500/40 bg-red-50/80",
} as const;

const headerAccentStyles = {
  default: "text-primary",
  success: "text-emerald-700",
  danger: "text-red-700",
} as const;

export function KanbanColumn({
  etapa,
  label,
  leads,
  accent = "default",
  pendingLeadIds,
  alertConfig,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex w-72 min-w-72 shrink-0 flex-col rounded-xl border",
        accentStyles[accent],
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-3">
        <h3 className={cn("text-sm font-semibold", headerAccentStyles[accent])}>{label}</h3>
        <span
          className={cn(
            "inline-flex min-w-6 items-center justify-center rounded-full bg-background px-2 py-0.5 text-xs font-bold tabular-nums",
            headerAccentStyles[accent],
          )}
        >
          {leads.length}
        </span>
      </div>

      <Droppable droppableId={etapa}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-[200px] flex-1 flex-col gap-2 p-2 transition-colors",
              snapshot.isDraggingOver && "bg-secondary/5",
            )}
          >
            {leads.map((lead, index) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                index={index}
                isUpdating={pendingLeadIds?.has(lead.id)}
                alertConfig={alertConfig}
              />
            ))}
            {provided.placeholder}
            {leads.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nenhum atendimento</p>
            ) : null}
          </div>
        )}
      </Droppable>
    </div>
  );
}
