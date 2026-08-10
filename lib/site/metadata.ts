import type { Corretor } from "@/types";

import { getSiteNomeExibicao } from "@/lib/site/social";

export function getSitePageTitle(corretor: Corretor, pageTitle?: string): string {
  const brand = getSiteNomeExibicao(corretor);
  return pageTitle ? `${pageTitle} | ${brand}` : `${brand} — Imóveis`;
}

export function getSiteDefaultDescription(corretor: Corretor): string {
  const brand = getSiteNomeExibicao(corretor);
  const sobre =
    corretor.site_sobre_texto?.trim() ||
    corretor.sobre_texto?.trim() ||
    corretor.sobre?.trim();

  return sobre || `Imóveis disponíveis com ${brand}`;
}

export function getSiteSobreTitulo(corretor: Corretor): string {
  return (
    corretor.site_sobre_titulo?.trim() ||
    corretor.sobre_titulo?.trim() ||
    `Sobre ${getSiteNomeExibicao(corretor)}`
  );
}

export function getSiteFavicon(corretor: Corretor): { icon: string } | undefined {
  const faviconUrl = corretor.site_favicon_url?.trim();
  return faviconUrl ? { icon: faviconUrl } : undefined;
}
