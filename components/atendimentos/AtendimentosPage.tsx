"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowUpDown, MessageCircle, MoreVertical, Phone } from "lucide-react";

import { ActionMenuIcon } from "@/components/ui/action-menu-item";
import { ACTION_MENU_DESTRUCTIVE_CLASS } from "@/lib/ui/action-menu-icons";
import { cn } from "@/lib/utils";

import { AtendimentoModals } from "@/components/atendimentos/AtendimentoModals";
import { NovoAtendimentoTrigger } from "@/components/atendimentos/NovoAtendimentoTrigger";
import { FunilKanban } from "@/components/dashboard/FunilKanban";
import { LeadCardGrid } from "@/components/leads/LeadCardGrid";
import { LeadCardList } from "@/components/leads/LeadCardList";
import {
  countActiveLeadsFilters,
  defaultLeadsFilters,
  LeadsFilters,
  type LeadsFilterState,
} from "@/components/leads/LeadsFilters";
import { matchesLeadsFilters } from "@/lib/leads/filters";
import { LeadsToolbar } from "@/components/leads/LeadsToolbar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_DIAS_ALERTA_INATIVIDADE,
  isAtendimentosSortMode,
  isLeadsViewMode,
  STORAGE_KEY_ATENDIMENTOS_SORT,
  STORAGE_KEY_DIAS_ALERTA_INATIVIDADE,
  STORAGE_KEY_LEADS_VIEW,
  type AtendimentosSortMode,
  type LeadsViewMode,
} from "@/lib/constants/config";
import { ETAPA_FUNIL_ORDEM } from "@/lib/leads/etapa-order";
import { isLeadAtivo } from "@/lib/leads/format";
import { buildTelLink, buildWhatsAppLink } from "@/lib/leads/format";
import { marcarContatoFeito, qualificarLead } from "@/lib/actions/atendimentos";
import { toast } from "@/hooks/use-toast";
import { contemNormalizado } from "@/lib/utils/normalizar";
import type { Lead, MidiaOrigem, MotivoDescarte, TipoImovelCustom } from "@/types";

interface AtendimentosPageProps {
  initialLeads: Lead[];
  corretorId: string;
  midias: MidiaOrigem[];
  perfis: { id: string; nome: string }[];
  motivos: MotivoDescarte[];
  podeTransferir: boolean;
  podeExcluir: boolean;
  initialFilters?: Partial<LeadsFilterState>;
  initialBusca?: string;
  tiposImovel?: TipoImovelCustom[];
}

function matchesSearch(lead: Lead, query: string): boolean {
  if (!query.trim()) return true;

  const digits = query.replace(/\D/g, "");
  const telefoneDigits = lead.telefone?.replace(/\D/g, "") ?? "";

  return (
    contemNormalizado(lead.nome, query) ||
    contemNormalizado(lead.telefone, query) ||
    contemNormalizado(lead.codigo_atendimento, query) ||
    (digits.length > 0 && telefoneDigits.includes(digits))
  );
}

function sortLeads(leads: Lead[], mode: AtendimentosSortMode): Lead[] {
  const sorted = [...leads];
  switch (mode) {
    case "antigos":
      return sorted.sort(
        (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
      );
    case "nome_asc":
      return sorted.sort((a, b) =>
        (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR"),
      );
    case "nome_desc":
      return sorted.sort((a, b) =>
        (b.nome ?? "").localeCompare(a.nome ?? "", "pt-BR"),
      );
    case "etapa":
      return sorted.sort(
        (a, b) => ETAPA_FUNIL_ORDEM[a.etapa] - ETAPA_FUNIL_ORDEM[b.etapa],
      );
    case "recentes":
    default:
      return sorted.sort(
        (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
      );
  }
}

export function AtendimentosPage({
  initialLeads,
  corretorId,
  midias,
  perfis,
  motivos,
  podeTransferir,
  podeExcluir,
  initialFilters,
  initialBusca = "",
  tiposImovel = [],
}: AtendimentosPageProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialBusca);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<LeadsViewMode>("kanban");
  const [sortMode, setSortMode] = useState<AtendimentosSortMode>("recentes");
  const [filters, setFilters] = useState<LeadsFilterState>({
    ...defaultLeadsFilters,
    ...initialFilters,
  });
  const [diasAlerta, setDiasAlerta] = useState(DEFAULT_DIAS_ALERTA_INATIVIDADE);
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const [descartarOpen, setDescartarOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);

  useEffect(() => {
    if (initialBusca) {
      setSearch(initialBusca);
    }
  }, [initialBusca]);

  useEffect(() => {
    const storedView = localStorage.getItem(STORAGE_KEY_LEADS_VIEW);
    if (storedView && isLeadsViewMode(storedView)) {
      setViewMode(storedView);
    }

    const storedSort = localStorage.getItem(STORAGE_KEY_ATENDIMENTOS_SORT);
    if (storedSort && isAtendimentosSortMode(storedSort)) {
      setSortMode(storedSort);
    }

    const storedDias = localStorage.getItem(STORAGE_KEY_DIAS_ALERTA_INATIVIDADE);
    if (storedDias) {
      const parsed = Number(storedDias);
      if (!Number.isNaN(parsed) && parsed > 0) {
        setDiasAlerta(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      setFiltersOpen(true);
    }
  }, [initialFilters]);

  function handleViewModeChange(mode: LeadsViewMode) {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY_LEADS_VIEW, mode);
  }

  function handleSortChange(mode: AtendimentosSortMode) {
    setSortMode(mode);
    localStorage.setItem(STORAGE_KEY_ATENDIMENTOS_SORT, mode);
  }

  function handleClearFilters() {
    setFilters({ ...defaultLeadsFilters });
    setSearch("");
    if (initialBusca || (initialFilters && Object.keys(initialFilters).length > 0)) {
      router.replace("/dashboard/atendimentos");
    }
  }

  const filteredLeads = useMemo(() => {
    const filtered = initialLeads.filter(
      (lead) =>
        matchesSearch(lead, search) && matchesLeadsFilters(lead, filters, viewMode),
    );
    return sortLeads(filtered, sortMode);
  }, [initialLeads, search, filters, sortMode, viewMode]);

  const ativosCount = useMemo(
    () => initialLeads.filter(isLeadAtivo).length,
    [initialLeads],
  );

  function runCardAction(
    leadId: string,
    action: () => Promise<{ error?: string; message?: string }>,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      router.refresh();
    });
  }

  function openDescartar(lead: Lead) {
    setModalLead(lead);
    setDescartarOpen(true);
  }

  function openTransferir(lead: Lead) {
    setModalLead(lead);
    setTransferirOpen(true);
  }

  function openExcluir(lead: Lead) {
    setModalLead(lead);
    setExcluirOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Atendimentos</h2>
          <p className="text-sm text-muted-foreground">
            {ativosCount} atendimento{ativosCount === 1 ? "" : "s"} ativo
            {ativosCount === 1 ? "" : "s"}
          </p>
        </div>
        <NovoAtendimentoTrigger />
      </div>

      <LeadsToolbar
        search={search}
        onSearchChange={setSearch}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((prev) => !prev)}
        activeFilterCount={countActiveLeadsFilters(filters)}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {viewMode !== "kanban" ? (
        <div className="flex items-center gap-2">
          <ArrowUpDown className="size-4 text-muted-foreground" />
          <Select value={sortMode} onValueChange={(v) => handleSortChange(v as AtendimentosSortMode)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais recentes</SelectItem>
              <SelectItem value="antigos">Mais antigos</SelectItem>
              <SelectItem value="nome_asc">Nome A–Z</SelectItem>
              <SelectItem value="nome_desc">Nome Z–A</SelectItem>
              <SelectItem value="etapa">Etapa do funil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {filtersOpen ? (
        <LeadsFilters
          filters={filters}
          onChange={setFilters}
          onClear={handleClearFilters}
          midias={midias}
          perfis={perfis}
          diasAlertaDefault={diasAlerta}
          tiposImovel={tiposImovel}
        />
      ) : null}

      {viewMode === "kanban" ? (
        <FunilKanban initialLeads={filteredLeads} corretorId={corretorId} hideHeader />
      ) : null}

      {viewMode === "grade" ? (
        <LeadCardGrid
          leads={filteredLeads}
          basePath="/dashboard/atendimentos"
          perfis={perfis}
        >
          {(lead) => (
            <AtendimentoCardActions
              lead={lead}
              disabled={isPending}
              podeTransferir={podeTransferir}
              podeExcluir={podeExcluir}
              onContatoFeito={() => runCardAction(lead.id, () => marcarContatoFeito(lead.id))}
              onQualificar={() => runCardAction(lead.id, () => qualificarLead(lead.id))}
              onDescartar={() => openDescartar(lead)}
              onTransferir={() => openTransferir(lead)}
              onExcluir={() => openExcluir(lead)}
            />
          )}
        </LeadCardGrid>
      ) : null}

      {viewMode === "lista" ? (
        <LeadCardList
          leads={filteredLeads}
          basePath="/dashboard/atendimentos"
          perfis={perfis}
        >
          {(lead) => (
            <AtendimentoCardActions
              lead={lead}
              disabled={isPending}
              podeTransferir={podeTransferir}
              podeExcluir={podeExcluir}
              onContatoFeito={() => runCardAction(lead.id, () => marcarContatoFeito(lead.id))}
              onQualificar={() => runCardAction(lead.id, () => qualificarLead(lead.id))}
              onDescartar={() => openDescartar(lead)}
              onTransferir={() => openTransferir(lead)}
              onExcluir={() => openExcluir(lead)}
            />
          )}
        </LeadCardList>
      ) : null}

      {modalLead ? (
        <AtendimentoModals
          leadId={modalLead.id}
          leadNome={modalLead.nome}
          perfis={perfis}
          motivos={motivos}
          podeTransferir={podeTransferir}
          podeExcluir={podeExcluir}
          descartarOpen={descartarOpen}
          transferirOpen={transferirOpen}
          excluirOpen={excluirOpen}
          onDescartarOpenChange={setDescartarOpen}
          onTransferirOpenChange={setTransferirOpen}
          onExcluirOpenChange={setExcluirOpen}
        />
      ) : null}
    </div>
  );
}

function AtendimentoCardActions({
  lead,
  disabled,
  podeTransferir,
  podeExcluir,
  onContatoFeito,
  onQualificar,
  onDescartar,
  onTransferir,
  onExcluir,
}: {
  lead: Lead;
  disabled: boolean;
  podeTransferir: boolean;
  podeExcluir: boolean;
  onContatoFeito: () => void;
  onQualificar: () => void;
  onDescartar: () => void;
  onTransferir: () => void;
  onExcluir: () => void;
}) {
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
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {telLink ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = telLink;
          }}
        >
          <Phone className="size-3.5" />
          Ligar
        </button>
      ) : null}
      {waLink ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-[#2DC653]/40 bg-[#2DC653]/10 px-3 py-1.5 text-xs font-medium text-[#1a7a34]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(waLink, "_blank", "noopener,noreferrer");
          }}
        >
          <MessageCircle className="size-3.5" />
          WhatsApp
        </button>
      ) : null}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-border px-2 py-1.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <MoreVertical className="size-3.5" />
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
