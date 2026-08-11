import type { Lead } from "@/types";

import { ETAPA_FUNIL_ORDEM } from "./etapa-order";

import { formatTipoBairrosInteresse } from "@/lib/atendimentos/interesse-from-imovel";
import { parseLeadObservacoes } from "@/lib/leads/observacoes";

export function formatTelefoneLead(telefone: string | null | undefined): string {
  if (!telefone) {
    return "Sem telefone";
  }

  const digits = telefone.replace(/\D/g, "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return telefone;
}

export function telefoneDigits(telefone: string | null | undefined): string {
  return telefone?.replace(/\D/g, "") ?? "";
}

export function buildTelLink(telefone: string | null | undefined): string | null {
  const digits = telefoneDigits(telefone);
  return digits.length >= 10 ? `tel:+55${digits}` : null;
}

export function buildWhatsAppLink(telefone: string | null | undefined): string | null {
  const digits = telefoneDigits(telefone);
  return digits.length >= 10 ? `https://wa.me/55${digits}` : null;
}

export function getInteresseResumido(lead: Lead): string {
  const tipoBairros = formatTipoBairrosInteresse(lead);
  if (tipoBairros) {
    return tipoBairros;
  }

  return "Interesse não informado";
}

export function getUltimaAtividadeEm(lead: Lead): string {
  return lead.ultima_mensagem_em ?? lead.atualizado_em ?? lead.criado_em;
}

/** Data do último registro de interação (WhatsApp, anotação, visita, etc.). */
export function getUltimaInteracaoEm(lead: Lead): string | null {
  if (lead.ultima_mensagem_em) {
    return lead.ultima_mensagem_em;
  }

  if (lead.interacoes?.length) {
    let latest = lead.interacoes[0].criado_em;
    for (const interacao of lead.interacoes) {
      if (new Date(interacao.criado_em).getTime() > new Date(latest).getTime()) {
        latest = interacao.criado_em;
      }
    }
    return latest;
  }

  return null;
}

export function isLeadAtivo(lead: Lead): boolean {
  if (lead.situacao === "descartado" || lead.situacao === "negocio_fechado") {
    return false;
  }
  return (
    lead.etapa !== "venda" &&
    lead.etapa !== "fechado" &&
    lead.etapa !== "perdido"
  );
}

/** Visível no funil/kanban (inclui vendas fechadas e perdidos; exclui descartados). */
export function isLeadVisivelFunil(lead: Lead): boolean {
  return lead.situacao !== "descartado";
}

export function getLeadResponsavelId(lead: Lead): string | null {
  if (lead.perfil_id) return lead.perfil_id;
  return null;
}

export function formatTempoPrimeiraResposta(minutes: number | null | undefined): string {
  if (minutes == null) {
    return "—";
  }

  const horas = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (horas > 0 && mins > 0) {
    return `${horas}h e ${mins}min`;
  }

  if (horas > 0) {
    return `${horas}h`;
  }

  return `${mins}min`;
}

export function formatOrigemDisplay(origem: string): string {
  const map: Record<string, string> = {
    site: "Site",
    whatsapp: "WhatsApp",
    portal: "Portal",
    indicacao: "Indicação",
    manual: "Manual",
  };

  return map[origem] ?? origem;
}

export function isLeadQualificado(lead: Lead): boolean {
  if (lead.etapa === "qualificado") {
    return true;
  }

  return parseLeadObservacoes(lead.observacoes).meta.qualificado === true;
}

export function isLeadContatoFeito(lead: Pick<Lead, "etapa">): boolean {
  return ETAPA_FUNIL_ORDEM[lead.etapa] >= ETAPA_FUNIL_ORDEM.contato_feito;
}

/** Mapeia etapas internas para exibição no seletor de etapas do atendimento. */
export function etapaParaSelectAtendimento(etapa: Lead["etapa"]): Lead["etapa"] {
  if (etapa === "qualificado" || etapa === "contato_feito") {
    return "novo";
  }
  return etapa;
}
