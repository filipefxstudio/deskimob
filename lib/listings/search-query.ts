import { MIN_TELEFONE_BUSCA_AUTOCOMPLETE, sanitizeTelefone } from "@/lib/pessoas/duplicate";

/** Critério mínimo para disparar busca no servidor (listagens e autocompletes). */
export function shouldRunListingSearch(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) {
    return false;
  }

  if (sanitizeTelefone(trimmed).length >= MIN_TELEFONE_BUSCA_AUTOCOMPLETE) {
    return true;
  }

  return trimmed.length >= 2;
}
