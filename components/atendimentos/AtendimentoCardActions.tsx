"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Phone } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { ActionMenuIcon } from "@/components/ui/action-menu-item";
import { ACTION_MENU_DESTRUCTIVE_CLASS } from "@/lib/ui/action-menu-icons";
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
}: AtendimentoCardActionsProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const telLink = buildTelLink(lead.telefone);
  const waLink = buildWhatsAppLink(lead.telefone);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="flex shrink-0 items-center gap-1">
      {telLink ? (
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
      {waLink ? (
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
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Ações"
          className={iconButtonClass}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <MoreVertical className="size-4" />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-10 mt-1 min-w-36 rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              type="button"
              disabled={disabled}
              className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs hover:bg-muted"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onContatoFeito();
              }}
            >
              <ActionMenuIcon action="contatoFeito" className="size-3.5" />
              Contato feito
            </button>
            <button
              type="button"
              disabled={disabled}
              className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs hover:bg-muted"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onQualificar();
              }}
            >
              <ActionMenuIcon action="qualificar" className="size-3.5" />
              Qualificar
            </button>
            {podeTransferir ? (
              <button
                type="button"
                className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  onTransferir();
                }}
              >
                <ActionMenuIcon action="transferir" className="size-3.5" />
                Transferir
              </button>
            ) : null}
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-1 px-3 py-2 text-left text-xs hover:bg-muted",
                ACTION_MENU_DESTRUCTIVE_CLASS,
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                onDescartar();
              }}
            >
              <ActionMenuIcon action="descartar" className="size-3.5" />
              Descartar
            </button>
            {podeExcluir ? (
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-1 px-3 py-2 text-left text-xs hover:bg-muted",
                  ACTION_MENU_DESTRUCTIVE_CLASS,
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  onExcluir();
                }}
              >
                <ActionMenuIcon action="excluir" className="size-3.5" />
                Excluir atendimento
              </button>
            ) : null}
            <button
              type="button"
              className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs hover:bg-muted"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen(false);
                router.push(`/dashboard/atendimentos/${lead.id}`);
              }}
            >
              <ActionMenuIcon action="abrirAtendimento" className="size-3.5" />
              Abrir atendimento
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
