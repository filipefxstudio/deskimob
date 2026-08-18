"use client";

import { Phone } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SituacaoBadge } from "@/components/atendimentos/SituacaoBadge";
import { TemperaturaBadge } from "@/components/leads/TemperaturaBadge";
import { Button } from "@/components/ui/button";
import { ETAPA_LEAD_LABELS } from "@/lib/constants/leads";
import {
  buildTelLink,
  buildWhatsAppLink,
  etapaParaSelectAtendimento,
  formatOrigemDisplay,
  formatTelefoneLead,
} from "@/lib/leads/format";
import type { Lead } from "@/types";

interface AtendimentoClienteSectionProps {
  lead: Lead;
}

export function AtendimentoClienteSection({ lead }: AtendimentoClienteSectionProps) {
  const nome = lead.nome?.trim() || "Atendimento sem nome";
  const telLink = buildTelLink(lead.telefone);
  const waLink = buildWhatsAppLink(lead.telefone);
  const codigo = lead.codigo_atendimento;
  const etapaExibicao = etapaParaSelectAtendimento(lead.etapa);

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {codigo ? (
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                {codigo}
              </span>
            ) : null}
            <h2 className="truncate text-lg font-semibold text-primary">{nome}</h2>
          </div>
        </div>
        <TemperaturaBadge temperatura={lead.temperatura} className="shrink-0" />
      </div>

      <p className="text-sm text-muted-foreground">{formatTelefoneLead(lead.telefone)}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {ETAPA_LEAD_LABELS[etapaExibicao]}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {formatOrigemDisplay(lead.origem)}
        </span>
        <SituacaoBadge situacao={lead.situacao} />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {telLink ? (
          <Button variant="outline" size="sm" asChild>
            <a href={telLink}>
              <Phone data-icon="inline-start" />
              Ligar
            </a>
          </Button>
        ) : null}
        {waLink ? (
          <Button variant="outline" size="sm" asChild>
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon data-icon="inline-start" className="size-4" />
              WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
