"use client";

import type { ReactNode } from "react";

import {
  IconBanheiro,
  IconQuartos,
  IconSuite,
  IconVagas,
} from "@/components/icons/ImovelStatIcons";
import { TemperaturaBadge } from "@/components/leads/TemperaturaBadge";
import { LeadInatividadeIndicador } from "@/components/leads/LeadInatividadeIndicador";
import { ImovelStatItem, ImovelStatsRow } from "@/components/imoveis/ImovelStatsRow";
import { ETAPA_LEAD_LABELS } from "@/lib/constants/leads";
import type { LeadInatividadeAlertConfig } from "@/lib/leads/inatividade";
import { formatTiposImovelBusca } from "@/lib/atendimentos/tipo-imovel-busca";
import { etapaParaSelectAtendimento, formatTelefoneLead } from "@/lib/leads/format";
import { formatCurrency } from "@/lib/site/format";
import type { Lead } from "@/types";

interface AtendimentoCardContentProps {
  lead: Lead;
  perfis?: { id: string; nome: string }[];
  alertConfig?: LeadInatividadeAlertConfig;
  footer?: ReactNode;
}

function formatTipoValorCard(lead: Lead): { tipo: string | null; valorMax: string | null } {
  const tipo = formatTiposImovelBusca(lead.tipo_imovel_busca);
  const max = lead.valor_maximo;

  return {
    tipo,
    valorMax: max != null ? formatCurrency(max) : null,
  };
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
  alertConfig,
  footer,
}: AtendimentoCardContentProps) {
  const responsavelNome =
    lead.perfil?.nome ?? perfis.find((p) => p.id === lead.perfil_id)?.nome ?? null;
  const { tipo, valorMax } = formatTipoValorCard(lead);
  const etapaExibicao = etapaParaSelectAtendimento(lead.etapa);
  const nome = lead.nome?.trim() || "Atendimento sem nome";
  const telefone = formatTelefoneLead(lead.telefone);

  return (
    <>
      <p className="truncate text-sm">
        <span className="font-semibold text-primary">{nome}</span>
        {telefone ? (
          <>
            <span className="text-muted-foreground"> - </span>
            <span className="font-normal text-muted-foreground">{telefone}</span>
          </>
        ) : null}
      </p>

      {tipo || valorMax ? (
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {tipo ? <span>{tipo}</span> : null}
          {tipo && valorMax ? <span> até </span> : null}
          {valorMax ? (
            <span className="font-semibold text-foreground">{valorMax}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Interesse não informado</p>
      )}

      <LeadInteresseStats lead={lead} />

      <div className="mt-2">
        <LeadInatividadeIndicador lead={lead} config={alertConfig} />
      </div>

      <p className="mt-2 truncate text-xs text-muted-foreground">
        {lead.codigo_atendimento ? (
          <span className="font-mono">{lead.codigo_atendimento}</span>
        ) : null}
        {lead.codigo_atendimento && responsavelNome ? <span> | </span> : null}
        {responsavelNome ? (
          <>
            Corretor: <span className="text-foreground">{responsavelNome}</span>
          </>
        ) : !lead.codigo_atendimento ? (
          "Corretor responsável não definido"
        ) : null}
      </p>

      <div className="mt-3 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <TemperaturaBadge temperatura={lead.temperatura} />
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {ETAPA_LEAD_LABELS[etapaExibicao]}
            </span>
          </div>
          {footer ? (
            <div
              className="flex shrink-0 items-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
