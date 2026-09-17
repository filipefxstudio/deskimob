"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";

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
  DEFAULT_DIAS_ALERTA_INATIVIDADE,
  isLeadsViewMode,
  STORAGE_KEY_DIAS_ALERTA_INATIVIDADE,
  STORAGE_KEY_LEADS_VIEW,
  type LeadsViewMode,
} from "@/lib/constants/config";
import { searchAtendimentosListing } from "@/lib/actions/leads";
import { isLeadAtivo } from "@/lib/leads/format";
import { shouldRunListingSearch } from "@/lib/listings/search-query";
import { contemNormalizado } from "@/lib/utils/normalizar";
import type { Lead, MidiaOrigem } from "@/types";

interface LeadsPageProps {
  initialLeads: Lead[];
  corretorId: string;
  midias: MidiaOrigem[];
  perfis: { id: string; nome: string }[];
  initialFilters?: Partial<LeadsFilterState>;
}

function matchesSearch(lead: Lead, query: string): boolean {
  if (!query.trim()) return true;

  const digits = query.replace(/\D/g, "");
  const telefoneDigits = lead.telefone?.replace(/\D/g, "") ?? "";

  return (
    contemNormalizado(lead.nome, query) ||
    contemNormalizado(lead.telefone, query) ||
    (digits.length > 0 && telefoneDigits.includes(digits))
  );
}

export function LeadsPage({
  initialLeads,
  corretorId,
  midias,
  perfis,
  initialFilters,
}: LeadsPageProps) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<LeadsViewMode>("kanban");
  const [filters, setFilters] = useState<LeadsFilterState>({
    ...defaultLeadsFilters,
    ...initialFilters,
  });
  const [diasAlerta, setDiasAlerta] = useState(DEFAULT_DIAS_ALERTA_INATIVIDADE);
  const [searchResults, setSearchResults] = useState<Lead[] | null>(null);
  const [, startSearch] = useTransition();

  const serverSearchActive = shouldRunListingSearch(search);

  useEffect(() => {
    if (!serverSearchActive) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        const found = await searchAtendimentosListing(search);
        setSearchResults(found);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [search, serverSearchActive]);

  useEffect(() => {
    const storedView = localStorage.getItem(STORAGE_KEY_LEADS_VIEW);
    if (storedView && isLeadsViewMode(storedView)) {
      setViewMode(storedView);
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

  const filteredLeads = useMemo(() => {
    const base = serverSearchActive ? (searchResults ?? []) : initialLeads;
    return base.filter(
      (lead) =>
        (serverSearchActive || matchesSearch(lead, search)) &&
        matchesLeadsFilters(lead, filters, viewMode),
    );
  }, [initialLeads, searchResults, search, filters, viewMode, serverSearchActive]);

  const ativosCount = useMemo(
    () => initialLeads.filter(isLeadAtivo).length,
    [initialLeads],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Leads</h2>
          <p className="text-sm text-muted-foreground">
            {ativosCount} lead{ativosCount === 1 ? "" : "s"} ativo
            {ativosCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/leads/novo">
            <Plus data-icon="inline-start" />
            Novo lead
          </Link>
        </Button>
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

      {filtersOpen ? (
        <LeadsFilters
          filters={filters}
          onChange={setFilters}
          midias={midias}
          perfis={perfis}
          diasAlertaDefault={diasAlerta}
        />
      ) : null}

      {viewMode === "kanban" ? (
        <FunilKanban
          initialLeads={filteredLeads}
          corretorId={corretorId}
          hideHeader
        />
      ) : null}

      {viewMode === "grade" ? <LeadCardGrid leads={filteredLeads} /> : null}
      {viewMode === "lista" ? <LeadCardList leads={filteredLeads} /> : null}
    </div>
  );
}
