import { isLeadAtivo } from "@/lib/leads/format";
import {
  leadMatchesFinalidadeBusca,
  type FinalidadeBuscaLead,
} from "@/lib/leads/finalidade-busca";
import type { Lead } from "@/types";

export function countActiveLeads(
  leads: Pick<Lead, "etapa" | "situacao" | "finalidade_busca">[],
  finalidade?: FinalidadeBuscaLead,
): number {
  return leads.filter((lead) => {
    if (!isLeadAtivo(lead as Lead)) {
      return false;
    }
    if (finalidade && !leadMatchesFinalidadeBusca(lead, finalidade)) {
      return false;
    }
    return true;
  }).length;
}
