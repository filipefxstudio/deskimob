import { buildImovelSharePreviewUrl, type CorretorShareHost } from "@/lib/imoveis/share-url";

/**
 * URL de preview do imóvel selecionado no atendimento (token de compartilhamento).
 */
export function getPreviewImovelShareUrl(
  token: string,
  corretor?: CorretorShareHost,
): string {
  if (corretor) {
    return buildImovelSharePreviewUrl(token, corretor);
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_BASE_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "";

  if (base) {
    return `${base}/preview/imovel/${token}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}/preview/imovel/${token}`;
  }

  return `/preview/imovel/${token}`;
}
