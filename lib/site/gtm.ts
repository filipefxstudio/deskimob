import type { Corretor } from "@/types";

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/;

export function normalizeSiteGtmId(input: string): string | null {
  const value = input.trim().toUpperCase();
  if (!value) {
    return null;
  }

  if (!GTM_ID_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export function getSiteGtmId(corretor: Corretor): string | null {
  return normalizeSiteGtmId(corretor.site_gtm_id ?? "");
}

export function isValidSiteGtmId(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return true;
  }

  return normalizeSiteGtmId(trimmed) !== null;
}
