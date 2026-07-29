import { IMOBEE_SITE_BASE } from "@/lib/imoview/constants";
import { fetchWithRetry } from "@/lib/imoview/fetch-with-retry";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)));
}

/** Extrai og:title de HTML com meta tags com ou sem aspas nos atributos. */
export function extractOgTitleFromHtml(html: string): string | null {
  const patterns = [
    /<meta\s+property=["']?og:title["']?\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']?og:title["']?/i,
    /<meta\s+property=["']?og:title["']?[^>]*content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["'][^>]*property=["']?og:title["']?/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const title = match?.[1]?.trim();
    if (title) return decodeHtmlEntities(title);
  }

  return null;
}

/**
 * Busca o título real da página do imóvel no Imobee (og:title).
 * @param urlSlug Slug da URL retornado pela API /imoveis/codigos/ (campo `titulo`).
 */
export async function fetchImobeeOgTitle(
  urlSlug: string,
  codigo: string,
): Promise<string | null> {
  const pathSlug = urlSlug.trim();
  if (!pathSlug || !codigo.trim()) return null;

  const pageUrl = `${IMOBEE_SITE_BASE}/imovel/${encodeURI(pathSlug)}/${encodeURIComponent(codigo)}`;

  try {
    const response = await fetchWithRetry(pageUrl, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DeskimobImport/1.0)",
        Accept: "text/html",
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    return extractOgTitleFromHtml(html);
  } catch {
    return null;
  }
}
