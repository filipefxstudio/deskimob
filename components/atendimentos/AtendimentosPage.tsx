"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowUpDown } from "lucide-react";

import { AtendimentoCardActions } from "@/components/atendimentos/AtendimentoCardActions";
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
  isLeadsViewMode,
  normalizeAtendimentosSortMode,
  STORAGE_KEY_ATENDIMENTOS_SORT,
  STORAGE_KEY_DIAS_ALERTA_INATIVIDADE,
  STORAGE_KEY_LEADS_VIEW,
  type AtendimentosSortMode,
  type LeadsViewMode,
} from "@/lib/constants/config";
import { getDbTimestampMs } from "@/lib/dates/format";
import { ETAPA_FUNIL_ORDEM } from "@/lib/leads/etapa-order";
import { getUltimaInteracaoEm, isLeadAtivo } from "@/lib/leads/format";
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

function interacaoTimestampRecente(lead: Lead): number {
  const ultima = getUltimaInteracaoEm(lead);
  return ultima ? getDbTimestampMs(ultima) : 0;
}

function interacaoTimestampSemRegistro(lead: Lead): number {
  const ultima = getUltimaInteracaoEm(lead);
  return ultima ? getDbTimestampMs(ultima) : getDbTimestampMs(lead.criado_em);
}

function sortLeads(leads: Lead[], mode: AtendimentosSortMode): Lead[] {
  const sorted = [...leads];
  switch (mode) {
    case "interacao_antiga":
      return sorted.sort(
        (a, b) => interacaoTimestampSemRegistro(a) - interacaoTimestampSemRegistro(b),
      );
    case "cadastro_recente":
      return sorted.sort(
        (a, b) => getDbTimestampMs(b.criado_em) - getDbTimestampMs(a.criado_em),
      );
    case "cadastro_antigo":
      return sorted.sort(
        (a, b) => getDbTimestampMs(a.criado_em) - getDbTimestampMs(b.criado_em),
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
    case "interacao_recente":
    default:
      return sorted.sort(
        (a, b) => interacaoTimestampRecente(b) - interacaoTimestampRecente(a),
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
  const [sortMode, setSortMode] = useState<AtendimentosSortMode>("interacao_recente");
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
    const normalizedSort = storedSort ? normalizeAtendimentosSortMode(storedSort) : null;
    if (normalizedSort) {
      setSortMode(normalizedSort);
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
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interacao_recente">
                Interação mais recente
              </SelectItem>
              <SelectItem value="interacao_antiga">
                Mais tempo sem interação
              </SelectItem>
              <SelectItem value="cadastro_recente">
                Cadastro mais recente
              </SelectItem>
              <SelectItem value="cadastro_antigo">
                Cadastro mais antigo
              </SelectItem>
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
