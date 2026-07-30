import type { ImoviewImportTarget } from "@/lib/imoview/import-target";
import type { XlsRow } from "@/lib/imoview/types";

const IMOBEE_OWNER_NAMES = ["filipe marconi", "imobee"];
const KENIA_OWNER_NAMES = ["kenia ribeiro soares"];

export function normalizeCaptadorName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Separa captadores do Imoview (ex.: "Filipe Marconi | Kenia Ribeiro Soares"). */
export function parseCaptadoresField(raw: unknown): string[] {
  const text = String(raw ?? "").trim();
  if (!text) {
    return [];
  }

  return text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseCaptadoresFromRow(row: XlsRow): string[] {
  return parseCaptadoresField(row.Captadores);
}

export function isAccountOwnerCaptador(name: string, target: ImoviewImportTarget): boolean {
  const normalized = normalizeCaptadorName(name);
  const owners = target.id === "imobee" ? IMOBEE_OWNER_NAMES : KENIA_OWNER_NAMES;

  return owners.some((owner) => normalized === owner);
}

/** Captadores da planilha que devem virar parceiro externo (não são o dono da conta). */
export function getExternalCaptadorNames(
  names: string[],
  target: ImoviewImportTarget,
): string[] {
  const seen = new Set<string>();
  const externals: string[] = [];

  for (const name of names) {
    if (isAccountOwnerCaptador(name, target)) {
      continue;
    }

    const key = normalizeCaptadorName(name);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    externals.push(name.trim());
  }

  return externals;
}

export function getExternalCaptadoresFromRow(
  row: XlsRow,
  target: ImoviewImportTarget,
): string[] {
  return getExternalCaptadorNames(parseCaptadoresFromRow(row), target);
}
