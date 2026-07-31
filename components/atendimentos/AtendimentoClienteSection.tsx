"use client";

import { useState } from "react";
import {
  ChevronDown,
  MoreVertical,
  Phone,
} from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { AtendimentoModals } from "@/components/atendimentos/AtendimentoModals";
import { SituacaoBadge } from "@/components/atendimentos/SituacaoBadge";
import { TemperaturaBadge } from "@/components/leads/TemperaturaBadge";
import { ActionMenuItem } from "@/components/ui/action-menu-item";
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
} from "@/lib/leads/format";
import type { Lead, MotivoDescarte } from "@/types";

interface AtendimentoClienteSectionProps {
  lead: Lead;
  perfis: { id: string; nome: string }[];
  motivos: MotivoDescarte[];
  podeTransferir: boolean;
}

export function AtendimentoClienteSection({
  lead,
  perfis,
  motivos,
  podeTransferir,
}: AtendimentoClienteSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [descartarOpen, setDescartarOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);

  const nome = lead.nome?.trim() || "Atendimento sem nome";
  const telLink = buildTelLink(lead.telefone);
  const waLink = buildWhatsAppLink(lead.telefone);
  const codigo = lead.codigo_atendimento;
  const etapaExibicao = etapaParaSelectAtendimento(lead.etapa);

  return (
    <>
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

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical data-icon="inline-start" />
                Ações
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <ActionMenuItem
                action="editar"
                onSelect={() => {
                  setMenuOpen(false);
                  setEditarOpen(true);
                }}
              >
                Editar
              </ActionMenuItem>
              {podeTransferir ? (
                <ActionMenuItem
                  action="transferir"
                  onSelect={() => {
                    setMenuOpen(false);
                    setTransferirOpen(true);
                  }}
                >
                  Transferir
                </ActionMenuItem>
              ) : null}
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
      </section>

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
