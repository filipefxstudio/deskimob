"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, MoreVertical, Phone } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { ActionMenuItem } from "@/components/ui/action-menu-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildTelLink, buildWhatsAppLink } from "@/lib/leads/format";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";

const iconButtonClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted";

interface AtendimentoCardActionsProps {
  lead: Lead;
  disabled: boolean;
  podeTransferir: boolean;
  podeExcluir: boolean;
  onContatoFeito: () => void;
  onQualificar: () => void;
  onDescartar: () => void;
  onTransferir: () => void;
  onExcluir: () => void;
  showAbrirAtendimento?: boolean;
  variant?: "card" | "header";
}

function stopCardNavigation(event: Event) {
  event.preventDefault();
}

export function AtendimentoCardActions({
  lead,
  disabled,
  podeTransferir,
  podeExcluir,
  onContatoFeito,
  onQualificar,
  onDescartar,
  onTransferir,
  onExcluir,
  showAbrirAtendimento = true,
  variant = "card",
}: AtendimentoCardActionsProps) {
  const router = useRouter();
  const telLink = buildTelLink(lead.telefone);
  const waLink = buildWhatsAppLink(lead.telefone);
  const showContactButtons = variant === "card";

  return (
    <div className="flex shrink-0 items-center gap-1">
      {showContactButtons && telLink ? (
        <button
          type="button"
          aria-label="Ligar"
          className={iconButtonClass}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = telLink;
          }}
        >
          <Phone className="size-4" />
        </button>
      ) : null}
      {showContactButtons && waLink ? (
        <button
          type="button"
          aria-label="WhatsApp"
          className={cn(
            iconButtonClass,
            "border-[#2DC653]/40 bg-[#2DC653]/10 text-[#1a7a34] hover:bg-[#2DC653]/20",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(waLink, "_blank", "noopener,noreferrer");
          }}
        >
          <WhatsAppIcon className="size-4" />
        </button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "header" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreVertical data-icon="inline-start" />
              Ações
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          ) : (
            <button
              type="button"
              aria-label="Ações"
              className={iconButtonClass}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <MoreVertical className="size-4" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={variant === "header" ? "end" : "start"}
          className="min-w-44"
          onClick={(e) => e.stopPropagation()}
        >
          <ActionMenuItem
            action="contatoFeito"
            disabled={disabled}
            onSelect={(event) => {
              stopCardNavigation(event);
              onContatoFeito();
            }}
          >
            Contato feito
          </ActionMenuItem>
          <ActionMenuItem
            action="qualificar"
            disabled={disabled}
            onSelect={(event) => {
              stopCardNavigation(event);
              onQualificar();
            }}
          >
            Qualificar
          </ActionMenuItem>
          {podeTransferir ? (
            <ActionMenuItem
              action="transferir"
              onSelect={(event) => {
                stopCardNavigation(event);
                onTransferir();
              }}
            >
              Transferir
            </ActionMenuItem>
          ) : null}
          <ActionMenuItem
            action="descartar"
            destructive
            onSelect={(event) => {
              stopCardNavigation(event);
              onDescartar();
            }}
          >
            Descartar
          </ActionMenuItem>
          {podeExcluir ? (
            <ActionMenuItem
              action="excluir"
              destructive
              onSelect={(event) => {
                stopCardNavigation(event);
                onExcluir();
              }}
            >
              Excluir atendimento
            </ActionMenuItem>
          ) : null}
          {showAbrirAtendimento ? (
            <ActionMenuItem
              action="abrirAtendimento"
              onSelect={(event) => {
                stopCardNavigation(event);
                router.push(`/dashboard/atendimentos/${lead.id}`);
              }}
            >
              Abrir atendimento
            </ActionMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
