"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AtendimentoCardContent } from "@/components/atendimentos/AtendimentoCardContent";
import type { LeadInatividadeAlertConfig } from "@/lib/leads/inatividade";
import type { Lead } from "@/types";

interface LeadCardGridProps {
  leads: Lead[];
  basePath?: string;
  perfis?: { id: string; nome: string }[];
  alertConfig?: LeadInatividadeAlertConfig;
  renderActions?: (lead: Lead) => ReactNode;
  children?: (lead: Lead) => ReactNode;
}

export function LeadCardGrid({
  leads,
  basePath = "/dashboard/atendimentos",
  perfis = [],
  alertConfig,
  renderActions,
  children,
}: LeadCardGridProps) {
  if (leads.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nenhum atendimento encontrado com os filtros atuais.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {leads.map((lead) => (
        <LeadCardItem
          key={lead.id}
          lead={lead}
          basePath={basePath}
          perfis={perfis}
          alertConfig={alertConfig}
          actions={renderActions?.(lead) ?? children?.(lead)}
        />
      ))}
    </div>
  );
}

function LeadCardItem({
  lead,
  basePath,
  perfis,
  alertConfig,
  actions,
}: {
  lead: Lead;
  basePath: string;
  perfis: { id: string; nome: string }[];
  alertConfig?: LeadInatividadeAlertConfig;
  actions?: ReactNode;
}) {
  const href = `${basePath}/${lead.id}`;

  return (
    <Link
      href={href}
      className="flex flex-col rounded-xl border border-border/80 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <AtendimentoCardContent
        lead={lead}
        perfis={perfis}
        alertConfig={alertConfig}
        footer={actions}
      />
    </Link>
  );
}
