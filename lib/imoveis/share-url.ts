import type { Corretor } from "@/types";

export type CorretorShareHost = Pick<
  Corretor,
  "slug" | "dominio_custom" | "dominio_custom_status"
>;

/**
 * Origem pública do site do corretor (domínio próprio, subdomínio ou fallback local).
 */
export function resolveCorretorPublicOrigin(corretor: CorretorShareHost): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return window.location.origin;
    }
  }

  const customDomain = corretor.dominio_custom?.trim();
  if (customDomain && corretor.dominio_custom_status === "active") {
    return `https://${customDomain}`;
  }

  const envBase = process.env.NEXT_PUBLIC_SITE_BASE_URL?.replace(/\/$/, "");
  if (envBase) {
    return envBase;
  }

  const mainDomain = process.env.NEXT_PUBLIC_DOMAIN || "deskimob.com.br";
  return `https://${corretor.slug}.${mainDomain}`;
}

/**
 * Link standalone de compartilhamento — abre preview do imóvel sem menu/rodapé do site.
 */
export function buildImovelSharePreviewUrl(
  token: string,
  corretor: CorretorShareHost,
): string {
  const origin = resolveCorretorPublicOrigin(corretor);
  return `${origin}/preview/imovel/${token}`;
}

/** @deprecated Use buildImovelSharePreviewUrl para compartilhamento. */
export function getPublicImovelShareUrl(corretorSlug: string, imovelSlug: string): string {
  const mainDomain = process.env.NEXT_PUBLIC_DOMAIN || "deskimob.com.br";
  const envBase = process.env.NEXT_PUBLIC_SITE_BASE_URL?.replace(/\/$/, "");

  if (envBase) {
    return `${envBase}/${corretorSlug}/imoveis/${imovelSlug}`;
  }

  return `https://${corretorSlug}.${mainDomain}/imoveis/${imovelSlug}`;
}

/** @deprecated Use buildImovelSharePreviewUrl para compartilhamento. */
export function getPublicImovelShareUrlClient(
  corretorSlug: string,
  imovelSlug: string,
): string {
  const envBase = process.env.NEXT_PUBLIC_SITE_BASE_URL?.replace(/\/$/, "");

  if (envBase) {
    return `${envBase}/${corretorSlug}/imoveis/${imovelSlug}`;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      return `${window.location.origin}/${corretorSlug}/imoveis/${imovelSlug}`;
    }
  }

  return getPublicImovelShareUrl(corretorSlug, imovelSlug);
}
