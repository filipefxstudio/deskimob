import * as XLSX from "xlsx";

import type { XlsRow } from "@/lib/imoview/types";

export type ParsedSpreadsheet = {
  rows: XlsRow[];
  exportYear: number;
  sheetName: string;
};

function extractExportYearFromFilename(filename?: string): number | null {
  if (!filename) return null;
  const match = filename.match(/(\d{4})-\d{2}-\d{2}/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractExportYearFromWorkbook(wb: XLSX.WorkBook): number | null {
  try {
    const props = wb.Props as { CreatedDate?: Date } | undefined;
    if (props?.CreatedDate instanceof Date) {
      return props.CreatedDate.getFullYear();
    }
  } catch {
    // ignore
  }
  return null;
}

export function parseXlsBuffer(
  buffer: ArrayBuffer | Buffer,
  options?: { filename?: string; exportYear?: number },
): ParsedSpreadsheet {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0] ?? "Planilha1";
  const ws = wb.Sheets[sheetName];

  if (!ws) {
    throw new Error("Planilha vazia ou sem abas.");
  }

  const rows = XLSX.utils.sheet_to_json<XlsRow>(ws, { defval: "" });

  const exportYear =
    options?.exportYear ??
    extractExportYearFromFilename(options?.filename) ??
    extractExportYearFromWorkbook(wb) ??
    new Date().getFullYear();

  return { rows, exportYear, sheetName };
}

export function normalizeCodigo(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function isSim(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "sim" || normalized === "s" || normalized === "true";
}

export function countByField(rows: XlsRow[], field: keyof XlsRow): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row[field] ?? "(vazio)").trim() || "(vazio)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function getRowSituacao(row: XlsRow): string {
  return String(row.Situacao ?? "").trim();
}

export function isExcludedSituacao(row: XlsRow): boolean {
  return getRowSituacao(row) === "Desativado";
}

/** Linhas a migrar — exclui Desativado (Documento N: 676 de 2.190) */
export function filterMigratableRows(rows: XlsRow[]): XlsRow[] {
  return rows.filter((row) => !isExcludedSituacao(row));
}

export function isPhotoEligible(row: XlsRow): boolean {
  return (
    isSim(row.ExibirMeuSite) && getRowSituacao(row) === "Vago/Disponível"
  );
}

export function filterPhotoEligible(rows: XlsRow[]): XlsRow[] {
  return rows.filter(isPhotoEligible);
}
