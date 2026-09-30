"use client";

import { Filter, Kanban, LayoutGrid, List, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeadsViewMode } from "@/lib/constants/config";
import { cn } from "@/lib/utils";

interface LeadsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  viewMode: LeadsViewMode;
  onViewModeChange: (mode: LeadsViewMode) => void;
}

const viewModes: { mode: LeadsViewMode; icon: typeof List; label: string }[] = [
  { mode: "lista", icon: List, label: "Lista" },
  { mode: "grade", icon: LayoutGrid, label: "Grade" },
  { mode: "kanban", icon: Kanban, label: "Kanban" },
];

export function LeadsToolbar({
  search,
  onSearchChange,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  viewMode,
  onViewModeChange,
}: LeadsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
          aria-label="Buscar leads"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={filtersOpen ? "secondary" : "outline"}
          onClick={onToggleFilters}
          className="flex-1 sm:flex-none"
        >
          <Filter data-icon="inline-start" />
          Filtros
          {activeFilterCount > 0 ? (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-brand text-xs text-brand-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>

        <div className="flex rounded-lg border border-border p-0.5">
          {viewModes.map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onViewModeChange(mode)}
              className={cn(viewMode === mode && "bg-muted")}
              aria-label={`Visualização ${label}`}
              aria-pressed={viewMode === mode}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
