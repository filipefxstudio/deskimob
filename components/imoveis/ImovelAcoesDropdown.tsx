"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Loader2,
  MoreVertical,
} from "lucide-react";

import { ActionMenuIcon } from "@/components/ui/action-menu-item";
import {
  ACTION_MENU_DESTRUCTIVE_CLASS,
} from "@/lib/ui/action-menu-icons";

import {
  ImovelAlterarStatusModal,
  ImovelDesativarModal,
} from "@/components/imoveis/ImovelStatusModals";
import { toast } from "@/hooks/use-toast";
import { aprovarImovel, reprovarImovel, republicarImovel, validarAtualizacao } from "@/lib/actions/imoveis";
import { STATUS_IMOVEL_SISTEMA } from "@/lib/constants/imoveis";
import { podeAprovarImovel, podeAlterarStatusImovel } from "@/lib/imoveis/aprovacao";
import { isImovelDuplicavel, isImovelRepublicavel } from "@/lib/imoveis/republicar";
import { getPublicImovelShareUrlClient } from "@/lib/imoveis/share-url";
import { cn } from "@/lib/utils";
import type { Imovel, Perfil, StatusImovel } from "@/types";

interface ImovelAcoesDropdownProps {
  imovel: Imovel;
  corretorSlug: string;
  statusList: StatusImovel[];
  perfil?: Perfil | null;
  variant?: "card" | "header";
  className?: string;
  onStatusChange?: (statusId: string) => void;
  onValidarAtualizacao?: (data: string) => void;
  onAprovar?: () => void;
  onReprovar?: () => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

function formatValidacaoDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ImovelAcoesDropdown({
  imovel,
  corretorSlug,
  statusList,
  perfil = null,
  variant = "card",
  className,
  onStatusChange,
  onValidarAtualizacao,
  onAprovar,
  onReprovar,
}: ImovelAcoesDropdownProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [statusSubmenuOpen, setStatusSubmenuOpen] = useState(false);
  const [desativarOpen, setDesativarOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const manualStatusList = statusList.filter(
    (status) => !(STATUS_IMOVEL_SISTEMA as readonly string[]).includes(status.nome),
  );
  const canChangeStatus = podeAlterarStatusImovel(imovel, perfil);
  const canApprove =
    podeAprovarImovel(perfil) && imovel.status_aprovacao === "aguardando_aprovacao";
  const canRepublicar = isImovelRepublicavel(imovel.status);
  const canDuplicar = isImovelDuplicavel(imovel.status);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu?.offsetHeight ?? 280;
    const menuWidth = menu?.offsetWidth ?? 192;
    const gap = 4;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;

    const top = openUpward ? rect.top - menuHeight - gap : rect.bottom + gap;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));

    setMenuPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();

    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [menuOpen, statusSubmenuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
      setStatusSubmenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function stopCardNav(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function closeMenu() {
    setMenuOpen(false);
    setStatusSubmenuOpen(false);
  }

  function handleShare(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();

    if (!imovel.slug) {
      toast({
        variant: "destructive",
        title: "Link indisponível",
        description: "Este imóvel ainda não possui slug para compartilhamento.",
      });
      return;
    }

    const url = getPublicImovelShareUrlClient(corretorSlug, imovel.slug);

    void navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link copiado",
        description: "O link público do imóvel foi copiado para a área de transferência.",
      });
    });
  }

  function handleStatusPick(statusId: string, event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();
    setPendingStatusId(statusId);
    setStatusModalOpen(true);
  }

  function handleValidar(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();

    startTransition(async () => {
      const result = await validarAtualizacao(imovel.id);

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }

      const data = result.data ?? new Date().toISOString();
      toast({
        title: `Atualização registrada em ${formatValidacaoDate(data)}`,
      });
      onValidarAtualizacao?.(data);
      router.refresh();
    });
  }

  function handleAprovar(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();

    startTransition(async () => {
      const result = await aprovarImovel(imovel.id);

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }

      toast({ title: "Imóvel aprovado." });
      onAprovar?.();
      router.refresh();
    });
  }

  function handleReprovar(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();

    startTransition(async () => {
      const result = await reprovarImovel(imovel.id);

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }

      toast({ title: "Imóvel reprovado. Retornou para cadastro." });
      onReprovar?.();
      router.refresh();
    });
  }

  function handleEdit(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();
    router.push(`/dashboard/imoveis/${imovel.id}/editar`);
  }

  function handleVerDetalhes(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();
    router.push(`/dashboard/imoveis/${imovel.id}`);
  }

  function handleDesativar(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();
    setDesativarOpen(true);
  }

  function handleRepublicar(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();

    startTransition(async () => {
      const result = await republicarImovel(imovel.id);

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }

      toast({
        title: "Imóvel republicado.",
        description: "Um novo cadastro foi criado em Em cadastro.",
      });

      if (result.imovelId) {
        router.push(`/dashboard/imoveis/${result.imovelId}/editar`);
      } else {
        router.refresh();
      }
    });
  }

  function handleDuplicar(event: React.MouseEvent) {
    stopCardNav(event);
    closeMenu();
    router.push(`/dashboard/imoveis/novo?duplicar=${imovel.id}`);
  }

  const triggerClass =
    variant === "header"
      ? "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
      : "inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted";

  const menuContent = menuOpen ? (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[9999] min-w-48 rounded-lg border border-border bg-card py-1 shadow-lg",
        isPending && "pointer-events-none opacity-80",
      )}
      style={
        menuPosition
          ? { top: menuPosition.top, left: menuPosition.left }
          : { top: -9999, left: -9999, visibility: "hidden" as const }
      }
    >
      {isPending ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Processando...
        </div>
      ) : null}
      {variant === "card" ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          onClick={handleVerDetalhes}
        >
          <ActionMenuIcon action="verDetalhes" />
          Ver detalhes
        </button>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
        onClick={handleEdit}
      >
        <ActionMenuIcon action="editar" />
        {variant === "header" ? "Editar imóvel" : "Editar"}
      </button>

      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
        onClick={handleShare}
      >
        <ActionMenuIcon action="compartilhar" />
        Compartilhar
      </button>

      <div className="relative">
        {canChangeStatus ? (
          <>
            <button
              type="button"
              disabled={isPending}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={(event) => {
                stopCardNav(event);
                setStatusSubmenuOpen((open) => !open);
              }}
            >
              <span className="flex items-center gap-2">
                <ActionMenuIcon action="alterarStatus" />
                Alterar status
              </span>
              <ChevronDown className="size-3.5 opacity-60" />
            </button>

            {statusSubmenuOpen ? (
              <div className="border-t border-border py-1">
                {manualStatusList.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    disabled={isPending || imovel.status_imovel_id === status.id}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    onClick={(event) => handleStatusPick(status.id, event)}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: status.cor }}
                    />
                    {status.nome}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {canApprove ? (
        <>
          <button
            type="button"
            disabled={isPending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-muted"
            onClick={handleAprovar}
          >
            <ActionMenuIcon action="aprovar" />
            Aprovar
          </button>
          <button
            type="button"
            disabled={isPending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={handleReprovar}
          >
            <ActionMenuIcon action="reprovar" />
            Reprovar
          </button>
        </>
      ) : null}

      {variant === "header" ? (
        <button
          type="button"
          disabled={isPending}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          onClick={handleValidar}
        >
          <ActionMenuIcon action="validarAtualizacao" />
          Validar atualização
        </button>
      ) : null}

      {canRepublicar ? (
        <button
          type="button"
          disabled={isPending}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          onClick={handleRepublicar}
        >
          <ActionMenuIcon action="republicar" />
          Republicar imóvel
        </button>
      ) : null}

      {canDuplicar ? (
        <button
          type="button"
          disabled={isPending}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          onClick={handleDuplicar}
        >
          <ActionMenuIcon action="duplicar" />
          Duplicar imóvel
        </button>
      ) : null}

      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
          ACTION_MENU_DESTRUCTIVE_CLASS,
        )}
        onClick={handleDesativar}
      >
        <ActionMenuIcon action="desativar" />
        Desativar
      </button>
    </div>
  ) : null;

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          ref={triggerRef}
          type="button"
          className={triggerClass}
          onClick={(event) => {
            stopCardNav(event);
            setMenuOpen((open) => !open);
          }}
        >
          <MoreVertical className="size-4" />
          Ações
          <ChevronDown className="size-3.5 opacity-60" />
        </button>
      </div>

      {typeof document !== "undefined" && menuContent
        ? createPortal(menuContent, document.body)
        : null}

      <ImovelDesativarModal
        imovelId={imovel.id}
        open={desativarOpen}
        onOpenChange={setDesativarOpen}
        onSuccess={() => router.refresh()}
      />

      <ImovelAlterarStatusModal
        imovelId={imovel.id}
        statusList={statusList}
        statusId={pendingStatusId}
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        onSuccess={(statusId) => {
          onStatusChange?.(statusId);
          router.refresh();
        }}
      />
    </>
  );
}
