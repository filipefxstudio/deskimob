import { getDbTimestampMs } from "@/lib/dates/format";
import {
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export type DashboardPeriodPreset =
  | "hoje"
  | "semana"
  | "mes"
  | "trimestre"
  | "ano"
  | "personalizado";

export interface DashboardPeriodRange {
  preset: DashboardPeriodPreset;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

export const PERIOD_PRESET_LABELS: Record<DashboardPeriodPreset, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Este trimestre",
  ano: "Este ano",
  personalizado: "Personalizado",
};

function previousRange(start: Date, end: Date): { previousStart: Date; previousEnd: Date } {
  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { previousStart, previousEnd };
}

export function resolvePeriodRange(
  preset: DashboardPeriodPreset,
  customStart?: string,
  customEnd?: string,
  referenceDate: Date = new Date(),
): DashboardPeriodRange {
  const now = referenceDate;
  let start: Date;
  let end: Date = endOfDay(now);

  switch (preset) {
    case "hoje":
      start = startOfDay(now);
      break;
    case "semana":
      start = startOfWeek(now, { locale: ptBR });
      break;
    case "mes":
      start = startOfMonth(now);
      break;
    case "trimestre":
      start = startOfQuarter(now);
      break;
    case "ano":
      start = startOfYear(now);
      break;
    case "personalizado": {
      const parsedStart = customStart ? new Date(customStart) : startOfMonth(now);
      const parsedEnd = customEnd ? new Date(customEnd) : endOfDay(now);
      start = startOfDay(parsedStart);
      end = endOfDay(parsedEnd);
      break;
    }
    default:
      start = startOfMonth(now);
  }

  const { previousStart, previousEnd } = previousRange(start, end);

  return { preset, start, end, previousStart, previousEnd };
}

export function isDateInRange(isoDate: string, start: Date, end: Date): boolean {
  const time = getDbTimestampMs(isoDate);
  return time >= start.getTime() && time <= end.getTime();
}

export function buildSparklineBuckets(
  dates: string[],
  start: Date,
  end: Date,
  bucketCount = 7,
): number[] {
  if (bucketCount <= 0) return [];

  const totalMs = Math.max(end.getTime() - start.getTime(), 1);
  const bucketMs = totalMs / bucketCount;
  const buckets = Array.from({ length: bucketCount }, () => 0);

  for (const iso of dates) {
    const time = getDbTimestampMs(iso);
    if (time < start.getTime() || time > end.getTime()) continue;
    const index = Math.min(Math.floor((time - start.getTime()) / bucketMs), bucketCount - 1);
    buckets[index] += 1;
  }

  return buckets;
}

export function calcChangePercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}
