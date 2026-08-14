import { getDbTimestampMs } from "@/lib/dates/format";
import { getUltimaInteracaoEm } from "@/lib/leads/format";
import type { Lead } from "@/types";

export type LeadInatividadeNivel = "verde" | "amarelo" | "vermelho";

export const LEAD_INATIVIDADE_CORES: Record<LeadInatividadeNivel, string> = {
  verde: "#2DC653",
  amarelo: "#F18F01",
  vermelho: "#E63946",
};

export interface LeadInatividadeAlertConfig {
  leads_verde_dias: number;
  leads_amarelo_dias: number;
}

export function getDiasSemInteracaoLead(lead: Lead, reference: Date = new Date()): number {
  const ultimaInteracao = getUltimaInteracaoEm(lead);
  const referencia = ultimaInteracao ?? lead.criado_em;
  const diffMs = reference.getTime() - getDbTimestampMs(referencia);

  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getNivelInatividadeLead(
  dias: number,
  config: LeadInatividadeAlertConfig,
): LeadInatividadeNivel {
  if (dias <= config.leads_verde_dias) {
    return "verde";
  }

  if (dias <= config.leads_amarelo_dias) {
    return "amarelo";
  }

  return "vermelho";
}

export function formatDiasSemInteracao(dias: number): string {
  if (dias === 0) {
    return "Hoje";
  }

  if (dias === 1) {
    return "1 dia";
  }

  return `${dias} dias`;
}
