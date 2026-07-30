"use client";

import {
  Bot,
  FileText,
  Handshake,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

import type { LeadInteracao, TipoInteracao } from "@/types";
import { formatDateTimeBrasilia } from "@/lib/dates/format";
import { cn } from "@/lib/utils";

interface LeadHistoricoProps {
  interacoes: LeadInteracao[];
}

function getIcon(tipo: TipoInteracao) {
  switch (tipo) {
    case "ligacao":
      return Phone;
    case "mensagem_whatsapp":
      return WhatsAppIcon;
    case "visita":
      return MapPin;
    case "email":
      return Mail;
    case "proposta":
      return Handshake;
    default:
      return FileText;
  }
}

function getTipoLabel(tipo: TipoInteracao): string {
  const map: Record<TipoInteracao, string> = {
    ligacao: "Ligação",
    mensagem_whatsapp: "WhatsApp",
    visita: "Visita",
    email: "E-mail",
    anotacao: "Anotação",
    proposta: "Proposta",
  };
  return map[tipo];
}

function formatConteudo(interacao: LeadInteracao): string {
  if (interacao.tipo === "proposta") {
    try {
      const data = JSON.parse(interacao.conteudo) as {
        valor?: number;
        status?: string;
        observacoes?: string;
      };
      const partes = [
        data.valor ? `R$ ${data.valor.toLocaleString("pt-BR")}` : null,
        data.status,
        data.observacoes,
      ].filter(Boolean);
      return partes.join(" · ") || interacao.conteudo;
    } catch {
      return interacao.conteudo;
    }
  }

  return interacao.conteudo;
}

export function LeadHistorico({ interacoes }: LeadHistoricoProps) {
  if (interacoes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma interação registrada ainda.
      </p>
    );
  }

  return (
    <div className="relative space-y-0 pl-6">
      <div className="absolute bottom-2 left-[11px] top-2 w-px bg-border" aria-hidden />

      {interacoes.map((interacao) => {
        const Icon = getIcon(interacao.tipo);
        const isBot = interacao.de === "bot" || interacao.de === "agente_ia";

        return (
          <div key={interacao.id} className="relative pb-6 last:pb-0">
            <div
              className={cn(
                "absolute -left-6 flex size-6 items-center justify-center rounded-full border bg-card",
                interacao.tipo === "proposta"
                  ? "border-accent text-accent"
                  : "border-border text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">
                    {getTipoLabel(interacao.tipo)}
                  </span>
                  {isBot ? (
                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Bot className="size-3" />
                      {interacao.de === "agente_ia" ? "IA" : "Bot"}
                    </span>
                  ) : null}
                </div>
                <time className="text-xs text-muted-foreground">
                  {formatDateTimeBrasilia(interacao.criado_em)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {formatConteudo(interacao)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
