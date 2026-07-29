import {
  DEFAULT_SITE_COR_PRIMARIA,
  DEFAULT_SITE_COR_SECUNDARIA,
} from "@/lib/constants/site";

export function isValidSiteHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** Normaliza cor do site para #RRGGBB ou retorna o fallback. */
export function normalizeSiteHexColor(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return fallback;
  }

  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return `#${trimmed}`;
  }

  return fallback;
}

export function normalizeSiteCorPrimaria(value: string | null | undefined): string {
  return normalizeSiteHexColor(value, DEFAULT_SITE_COR_PRIMARIA);
}

export function normalizeSiteCorSecundaria(value: string | null | undefined): string {
  return normalizeSiteHexColor(value, DEFAULT_SITE_COR_SECUNDARIA);
}
