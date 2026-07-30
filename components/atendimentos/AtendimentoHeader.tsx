"use client";

import { useState } from "react";
import {
  ChevronDown,
  MoreVertical,
  Phone,
} from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

import { ActionMenuItem } from "@/components/ui/action-menu-item";

import { AtendimentoModals } from "@/components/atendimentos/AtendimentoModals";
import { SituacaoBadge } from "@/components/atendimentos/SituacaoBadge";
import { TemperaturaBadge } from "@/components/leads/TemperaturaBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ETAPA_LEAD_LABELS } from "@/lib/constants/leads";
import {
  buildTelLink,
  buildWhatsAppLink,
  etapaParaSelectAtendimento,
  formatOrigemDisplay,
  formatTelefoneLead,
  formatTempoPrimeiraResposta,
  isLeadQualificado,
} from "@/lib/leads/format";
import type { Lead, MotivoDescarte } from "@/types";

interface AtendimentoHeaderProps {
  lead: Lead;
  perfis: { id: string; nome: string }[];
  motivos: MotivoDescarte[];
  podeTransferir: boolean;
}

export function AtendimentoHeader({
  lead,
  perfis,
  motivos,
  podeTransferir,
}: AtendimentoHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [descartarOpen, setDescartarOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);
  const nome = lead.nome?.trim() || "Atendimento sem nome";
  const telLink = buildTelLink(lead.telefone);
  const waLink = buildWhatsAppLink(lead.telefone);
  const codigo = lead.codigo_atendimento;
  const qualificado = isLeadQualificado(lead);
  const etapaExibicao = etapaParaSelectAtendimento(lead.etapa);

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {codigo ? (
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                  {codigo}
                </span>
              ) : null}
              <h1 className="truncate text-lg font-semibold text-primary">{nome}</h1>
              <TemperaturaBadge temperatura={lead.temperatura} />
              <SituacaoBadge situacao={lead.situacao} />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatTelefoneLead(lead.telefone)}
              {lead.tempo_primeira_resposta_min != null ? (
                <> · 1ª resposta: {formatTempoPrimeiraResposta(lead.tempo_primeira_resposta_min)}</>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-muted px-2 py-0.5">
                {ETAPA_LEAD_LABELS[etapaExibicao]}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5">
                {formatOrigemDisplay(lead.origem)}
              </span>
              {qualificado ? (
                <span className="rounded-full bg-[#2DC653]/15 px-2 py-0.5 font-medium text-[#1a7a34]">
                  Qualificado
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical data-icon="inline-start" />
                  Ações
                  <ChevronDown className="size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <ActionMenuItem
                  action="editar"
                  onSelect={() => {
                    setMenuOpen(false);
                    setEditarOpen(true);
                  }}
                >
                  Editar
                </ActionMenuItem>
                <ActionMenuItem
                  action="transferir"
                  onSelect={() => {
                    setMenuOpen(false);
                    setTransferirOpen(true);
                  }}
                >
                  Transferir
                </ActionMenuItem>
                <ActionMenuItem
                  action="descartar"
                  destructive
                  onSelect={() => {
                    setMenuOpen(false);
                    setDescartarOpen(true);
                  }}
                >
                  Descartar
                </ActionMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AtendimentoModals
        leadId={lead.id}
        leadClienteId={lead.cliente_id}
        leadNome={lead.nome}
        leadTelefone={lead.telefone}
        leadEmail={lead.email}
        perfis={perfis}
        motivos={motivos}
        podeTransferir={podeTransferir}
        editarOpen={editarOpen}
        descartarOpen={descartarOpen}
        transferirOpen={transferirOpen}
        onEditarOpenChange={setEditarOpen}
        onDescartarOpenChange={setDescartarOpen}
        onTransferirOpenChange={setTransferirOpen}
      />
    </>
  );
}
