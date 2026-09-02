import { formatOrigemDisplay } from "@/lib/leads/format";
import { parseLeadObservacoes } from "@/lib/leads/observacoes";
import type { Lead, OrigemLead } from "@/types";

const ORIGENS_PADRAO = new Set<OrigemLead>([
  "site",
  "whatsapp",
  "portal",
  "indicacao",
  "manual",
]);

export function mapMidiaToOrigem(midiaNome: string): OrigemLead {
  const normalized = midiaNome.trim().toLowerCase();

  if (normalized.includes("whatsapp")) {
    return "whatsapp";
  }

  if (normalized.includes("site")) {
    return "site";
  }

  if (normalized.includes("indica")) {
    return "indicacao";
  }

  if (normalized.includes("portal")) {
    return "portal";
  }

  return "manual";
}

export function getLeadMidiaNome(lead: Pick<Lead, "origem" | "observacoes">): string {
  const fromMeta = parseLeadObservacoes(lead.observacoes).meta.midia_nome?.trim();
  if (fromMeta) {
    return fromMeta;
  }

  if (lead.origem && !ORIGENS_PADRAO.has(lead.origem as OrigemLead)) {
    return lead.origem;
  }

  return "";
}

export function formatMidiaOrigemLead(lead: Pick<Lead, "origem" | "observacoes">): string {
  const midia = getLeadMidiaNome(lead);
  if (midia) {
    return midia;
  }

  return formatOrigemDisplay(lead.origem);
}
