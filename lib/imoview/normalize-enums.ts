import { TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import type { LocalChaves, TipoImovel } from "@/types";

const TIPO_MAP: Record<string, TipoImovel> = {
  apartamento: "apartamento",
  "apartamento duplex": "apartamento",
  casa: "casa",
  chácara: "casa",
  chacara: "casa",
  terreno: "terreno",
  lote: "terreno",
  comercial: "comercial",
  sala: "comercial",
  galpão: "comercial",
  galpao: "comercial",
  cobertura: "cobertura",
  studio: "studio",
  "área privativa": "apartamento",
  "area privativa": "apartamento",
};

export function mapTipoImoview(raw: string | undefined | null): {
  tipo: TipoImovel;
  warning?: string;
} {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (!normalized) {
    return { tipo: "comercial", warning: "Tipo vazio — fallback comercial" };
  }

  const mapped = TIPO_MAP[normalized];
  if (mapped) return { tipo: mapped };

  const validValues = TIPOS_IMOVEL.map((t) => t.value);
  if (validValues.includes(normalized as TipoImovel)) {
    return { tipo: normalized as TipoImovel };
  }

  return {
    tipo: "comercial",
    warning: `Tipo desconhecido "${raw}" — fallback comercial`,
  };
}

export function mapDestinacao(raw: string | undefined | null): "residencial" | "comercial" | "rural" | null {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "residencial" || normalized === "comercial" || normalized === "rural") {
    return normalized;
  }
  return null;
}

export function mapLocalChaves(raw: string | undefined | null): {
  local_chaves: LocalChaves | null;
  chaves_descricao: string | null;
} {
  const value = (raw ?? "").trim();
  if (!value) return { local_chaves: null, chaves_descricao: null };

  const lower = value.toLowerCase();
  if (lower.includes("propriet")) return { local_chaves: "proprietario", chaves_descricao: null };
  if (lower.includes("imobili")) return { local_chaves: "imobiliaria", chaves_descricao: null };
  if (lower.includes("portaria")) return { local_chaves: "portaria", chaves_descricao: null };

  return { local_chaves: "outros", chaves_descricao: value };
}

export function mapVagasTipo(raw: string | undefined | null): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("paralel")) return "paralela";
  if (value.includes("linha") || value.includes("sequen")) return "em_linha";
  return value.slice(0, 20);
}

export function sanitizeCep(cep: string | number | undefined | null): string | null {
  if (cep === null || cep === undefined || cep === "") return null;
  const digits = String(cep).replace(/\D/g, "");
  return digits.length >= 8 ? digits : digits || null;
}

export function parseIntField(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value).replace(/[^\d.-]/g, ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).replace(/[^\d.-]/g, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}
