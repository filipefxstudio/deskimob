"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PERIOD_PRESET_LABELS,
  type DashboardPeriodPreset,
} from "@/lib/dashboard/period";

export interface DashboardPeriodState {
  preset: DashboardPeriodPreset;
  customStart: string;
  customEnd: string;
}

interface DashboardPeriodFilterProps {
  value: DashboardPeriodState;
  onChange: (value: DashboardPeriodState) => void;
}

export function DashboardPeriodFilter({ value, onChange }: DashboardPeriodFilterProps) {
  const [localStart, setLocalStart] = useState(value.customStart);
  const [localEnd, setLocalEnd] = useState(value.customEnd);

  useEffect(() => {
    setLocalStart(value.customStart);
    setLocalEnd(value.customEnd);
  }, [value.customStart, value.customEnd]);

  function handlePresetChange(preset: DashboardPeriodPreset) {
    onChange({ ...value, preset });
  }

  function applyCustomDates() {
    onChange({
      ...value,
      preset: "personalizado",
      customStart: localStart,
      customEnd: localEnd,
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[180px] space-y-1.5">
        <Label htmlFor="period-preset" className="text-xs text-muted-foreground">
          Período
        </Label>
        <Select value={value.preset} onValueChange={(v) => handlePresetChange(v as DashboardPeriodPreset)}>
          <SelectTrigger id="period-preset" className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_PRESET_LABELS) as DashboardPeriodPreset[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PERIOD_PRESET_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.preset === "personalizado" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="period-start" className="text-xs text-muted-foreground">
              De
            </Label>
            <Input
              id="period-start"
              type="date"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              className="w-full sm:w-auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="period-end" className="text-xs text-muted-foreground">
              Até
            </Label>
            <Input
              id="period-end"
              type="date"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              className="w-full sm:w-auto"
            />
          </div>
          <button
            type="button"
            onClick={applyCustomDates}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-[color-mix(in_oklch,var(--brand),black_12%)]"
          >
            Aplicar
          </button>
        </>
      )}
    </div>
  );
}
