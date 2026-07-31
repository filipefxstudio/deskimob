import { getTipoLabel } from "@/lib/site/format";

const SEPARATOR = ",";

export function parseTiposImovelBusca(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(SEPARATOR)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function serializeTiposImovelBusca(tipos: string[]): string | undefined {
  const unique = [...new Set(tipos.map((item) => item.trim().toLowerCase()).filter(Boolean))];
  return unique.length > 0 ? unique.join(SEPARATOR) : undefined;
}

export function formatTiposImovelBusca(value?: string | null): string | null {
  const tipos = parseTiposImovelBusca(value);
  if (tipos.length === 0) return null;
  return tipos.map((tipo) => getTipoLabel(tipo)).join(", ");
}

export function leadMatchesTipoImovelBusca(
  leadTipo: string | null | undefined,
  filtroTipo: string,
): boolean {
  const alvo = filtroTipo.trim().toLowerCase();
  if (!alvo) return true;

  const tiposLead = parseTiposImovelBusca(leadTipo);
  if (tiposLead.length === 0) return false;
  return tiposLead.includes(alvo);
}
