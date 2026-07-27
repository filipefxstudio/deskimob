import { IMOBEE_SITE_BASE } from "@/lib/imoview/constants";

export async function fetchImobeeOgTitle(
  slug: string,
  codigo: string,
): Promise<string | null> {
  const pathSlug = slug.trim();
  if (!pathSlug || !codigo.trim()) return null;

  const pageUrl = `${IMOBEE_SITE_BASE}/imovel/${pathSlug}/${codigo}`;

  try {
    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "DeskimobImoviewImport/1.0" },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    );

    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}
