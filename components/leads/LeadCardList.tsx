"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AtendimentoCardContent } from "@/components/atendimentos/AtendimentoCardContent";
import type { LeadInatividadeAlertConfig } from "@/lib/leads/inatividade";
import type { Lead } from "@/types";

interface LeadCardListProps {
  leads: Lead[];
  basePath?: string;
  perfis?: { id: string; nome: string }[];
  alertConfig?: LeadInatividadeAlertConfig;
  renderActions?: (lead: Lead) => ReactNode;
  children?: (lead: Lead) => ReactNode;
}

export function LeadCardList({
  leads,
  basePath = "/dashboard/atendimentos",
  perfis = [],
  alertConfig,
  renderActions,
  children,
}: LeadCardListProps) {
  if (leads.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhum atendimento encontrado com os filtros atuais.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      <div className="divide-y divide-border/70">
        {leads.map((lead) => {
          const href = `${basePath}/${lead.id}`;
          const actions = renderActions?.(lead) ?? children?.(lead);

          return (
            <Link
              key={lead.id}
              href={href}
              className="block bg-card p-4 transition-colors hover:bg-muted/30"
            >
              <AtendimentoCardContent
                lead={lead}
                perfis={perfis}
                alertConfig={alertConfig}
                footer={actions}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
