"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  type DropResult,
} from "@hello-pangea/dnd";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { KanbanColumn } from "@/components/dashboard/KanbanColumn";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { updateLeadEtapa } from "@/lib/actions/leads";
import {
  ETAPA_LEAD_LABELS,
  ETAPAS_LEAD,
  isEtapaLead,
} from "@/lib/constants/leads";
import { resolveKanbanEtapa } from "@/lib/leads/etapa-order";
import { createClient } from "@/lib/supabase/client";
import type { EtapaLead, Lead } from "@/types";

interface FunilKanbanProps {
  initialLeads: Lead[];
  corretorId: string;
  hideHeader?: boolean;
}

function getColumnAccent(etapa: EtapaLead): "default" | "success" | "danger" {
  if (etapa === "venda") {
    return "success";
  }

  if (etapa === "perdido") {
    return "danger";
  }

  return "default";
}

function mergeLeadFromPayload(
  current: Lead[],
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Lead[] {
  if (payload.eventType === "DELETE") {
    const oldRecord = payload.old as { id?: string };
    if (!oldRecord.id) {
      return current;
    }
    return current.filter((lead) => lead.id !== oldRecord.id);
  }

  const record = payload.new as unknown as Lead | null;
  if (!record?.id) {
    return current;
  }

  const index = current.findIndex((lead) => lead.id === record.id);

  if (index === -1) {
    return [record, ...current];
  }

  const next = [...current];
  next[index] = { ...next[index], ...record };
  return next;
}

export function FunilKanban({ initialLeads, corretorId, hideHeader }: FunilKanbanProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [pendingLeadIds, setPendingLeadIds] = useState<Set<string>>(() => new Set());
  const pendingUpdates = useRef<Set<string>>(new Set());

  const leadsByEtapa = useMemo(() => {
    const grouped = Object.fromEntries(
      ETAPAS_LEAD.map((etapa) => [etapa, [] as Lead[]]),
    ) as Record<EtapaLead, Lead[]>;

    for (const lead of leads) {
      const etapa = resolveKanbanEtapa(lead);
      grouped[etapa].push(lead);
    }

    for (const etapa of ETAPAS_LEAD) {
      grouped[etapa].sort(
        (a, b) =>
          new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
      );
    }

    return grouped;
  }, [leads]);

  const totalLeads = leads.length;

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;

      if (!destination) {
        return;
      }

      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const novaEtapa = destination.droppableId;
      if (!isEtapaLead(novaEtapa)) {
        return;
      }

      const leadAnterior = leads.find((lead) => lead.id === draggableId);
      if (!leadAnterior || leadAnterior.etapa === novaEtapa) {
        return;
      }

      const snapshot = leads;

      setLeads((current) =>
        current.map((lead) =>
          lead.id === draggableId ? { ...lead, etapa: novaEtapa } : lead,
        ),
      );

      pendingUpdates.current.add(draggableId);
      setPendingLeadIds((current) => new Set(current).add(draggableId));

      const resultado = await updateLeadEtapa(draggableId, novaEtapa);

      pendingUpdates.current.delete(draggableId);
      setPendingLeadIds((current) => {
        const next = new Set(current);
        next.delete(draggableId);
        return next;
      });

      if (resultado.error) {
        setLeads(snapshot);
        toast({
          variant: "destructive",
          title: "Erro ao mover atendimento",
          description: resultado.error,
        });
      }
    },
    [leads],
  );

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`leads-kanban-${corretorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `corretor_id=eq.${corretorId}`,
        },
        (payload) => {
          const recordId =
            (payload.new as { id?: string } | null)?.id ??
            (payload.old as { id?: string } | null)?.id;

          if (recordId && pendingUpdates.current.has(recordId)) {
            return;
          }

          setLeads((current) => mergeLeadFromPayload(current, payload));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [corretorId]);

  return (
    <div className="min-w-0 space-y-4">
      {!hideHeader ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Atendimentos</h2>
            <p className="text-sm text-muted-foreground">
              {totalLeads === 0
                ? "Nenhum atendimento no funil."
                : `${totalLeads} atendimento${totalLeads === 1 ? "" : "s"} no funil`}
            </p>
          </div>
        </div>
      ) : null}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className={cn(
            "w-full min-w-0 overflow-auto pb-4",
            hideHeader ? "max-h-[calc(100dvh-15rem)]" : "max-h-[calc(100dvh-18rem)]",
          )}
        >
          <div className="flex w-max flex-nowrap gap-3">
            {ETAPAS_LEAD.map((etapa) => (
              <KanbanColumn
                key={etapa}
                etapa={etapa}
                label={ETAPA_LEAD_LABELS[etapa]}
                leads={leadsByEtapa[etapa]}
                accent={getColumnAccent(etapa)}
                pendingLeadIds={pendingLeadIds}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
