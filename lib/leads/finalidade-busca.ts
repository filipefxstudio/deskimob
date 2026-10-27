import type { Lead } from "@/types";

export type FinalidadeBuscaLead = "compra" | "locacao";

/** Normaliza finalidade do lead para compra ou locação (padrão: compra). */
export function normalizeFinalidadeBuscaLead(
  finalidade: string | null | undefined,
): FinalidadeBuscaLead {
  const value = (finalidade ?? "").trim().toLowerCase();

  if (value === "locacao" || value === "locação") {
    return "locacao";
  }

  // compra, venda (legado), vazio ou desconhecido → compra
  return "compra";
}

export function leadMatchesFinalidadeBusca(
  lead: Pick<Lead, "finalidade_busca">,
  finalidade: FinalidadeBuscaLead,
): boolean {
  return normalizeFinalidadeBuscaLead(lead.finalidade_busca) === finalidade;
}
