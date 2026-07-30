"use client";

import type { ReactNode } from "react";

import {
  IconBanheiro,
  IconQuartos,
  IconSuite,
  IconVagas,
} from "@/components/icons/ImovelStatIcons";
import { TemperaturaBadge } from "@/components/leads/TemperaturaBadge";
import { ImovelStatItem, ImovelStatsRow } from "@/components/imoveis/ImovelStatsRow";
import { ETAPA_LEAD_LABELS } from "@/lib/constants/leads";
import { formatTipoBairrosInteresse } from "@/lib/atendimentos/interesse-from-imovel";
import { etapaParaSelectAtendimento, formatTelefoneLead } from "@/lib/leads/format";
import { formatCurrency } from "@/lib/site/format";
import type { Lead } from "@/types";

interface AtendimentoCardContentProps {
  lead: Lead;
  perfis?: { id: string; nome: string }[];
  footer?: ReactNode;
}

function formatFaixaValorCard(lead: Lead): string | null {
  const { valor_minimo: min, valor_maximo: max } = lead;

  if (min != null && max != null) {
    return `${formatCurrency(min)} a ${formatCurrency(max)}`;
  }
  if (min != null) {
    return `A partir de ${formatCurrency(min)}`;
  }
  if (max != null) {
    return `Até ${formatCurrency(max)}`;
  }
  return null;
}

function LeadInteresseStats({ lead }: { lead: Lead }) {
  const items = [
    { key: "quartos", value: lead.quartos_minimo, icon: IconQuartos },
    { key: "suites", value: lead.suites_minimas, icon: IconSuite },
    { key: "banheiros", value: lead.banheiros_minimos, icon: IconBanheiro },
    { key: "vagas", value: lead.vagas_minimas, icon: IconVagas },
  ].filter((item) => item.value != null && item.value > 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <ImovelStatsRow variant="card" className="mt-2">
      {items.map(({ key, value, icon: Icon }) => (
        <ImovelStatItem
          key={key}
          variant="card"
          icon={<Icon size="card" className="text-muted-foreground" />}
        >
          {value}
        </ImovelStatItem>
      ))}
    </ImovelStatsRow>
  );
}

export function AtendimentoCardContent({
  lead,
  perfis = [],
  footer,
}: AtendimentoCardContentProps) {
  const responsavelNome =
    lead.perfil?.nome ?? perfis.find((p) => p.id === lead.perfil_id)?.nome ?? null;
  const tipoBairros = formatTipoBairrosInteresse(lead);
  const faixaValor = formatFaixaValorCard(lead);
  const etapaExibicao = etapaParaSelectAtendimento(lead.etapa);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {lead.codigo_atendimento ? (
              <span className="font-mono text-xs text-muted-foreground">
                {lead.codigo_atendimento}
              </span>
            ) : null}
            <p className="truncate font-semibold text-primary">
              {lead.nome?.trim() || "Atendimento sem nome"}
            </p>
          </div>
        </div>
        <TemperaturaBadge temperatura={lead.temperatura} className="shrink-0" />
      </div>

      <p className="mt-1 text-sm text-muted-foreground">{formatTelefoneLead(lead.telefone)}</p>

      <p className="mt-1 text-xs text-muted-foreground">
        {responsavelNome ? (
          <>
            Corretor: <span className="font-medium text-foreground">{responsavelNome}</span>
          </>
        ) : (
          "Corretor responsável não definido"
        )}
      </p>

      {tipoBairros ? (
        <p className="mt-2 truncate text-sm text-foreground" title={tipoBairros}>
          {tipoBairros}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Interesse não informado</p>
      )}

      {faixaValor ? (
        <p className="mt-1 text-sm font-medium text-primary">{faixaValor}</p>
      ) : null}

      <LeadInteresseStats lead={lead} />

      {footer ? (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {ETAPA_LEAD_LABELS[etapaExibicao]}
          </span>
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {footer}
          </div>
        </div>
      ) : (
        <div className="mt-4 border-t border-border/60 pt-3">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {ETAPA_LEAD_LABELS[etapaExibicao]}
          </span>
        </div>
      )}
    </>
  );
}
