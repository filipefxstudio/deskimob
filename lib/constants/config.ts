export const STORAGE_KEY_LEADS_VIEW = "fx-leads-view";
export const STORAGE_KEY_ATENDIMENTOS_SORT = "fx-atendimentos-sort";
export type AtendimentosSortMode =
  | "interacao_recente"
  | "interacao_antiga"
  | "cadastro_recente"
  | "cadastro_antigo"
  | "nome_asc"
  | "nome_desc"
  | "etapa";

export function isAtendimentosSortMode(value: string): value is AtendimentosSortMode {
  return (
    value === "interacao_recente" ||
    value === "interacao_antiga" ||
    value === "cadastro_recente" ||
    value === "cadastro_antigo" ||
    value === "nome_asc" ||
    value === "nome_desc" ||
    value === "etapa"
  );
}

/** Converte valores legados do localStorage para os modos atuais. */
export function normalizeAtendimentosSortMode(value: string): AtendimentosSortMode | null {
  if (value === "recentes") return "cadastro_recente";
  if (value === "antigos") return "cadastro_antigo";
  if (isAtendimentosSortMode(value)) return value;
  return null;
}
export const STORAGE_KEY_DIAS_ALERTA_INATIVIDADE = "fx-dias-alerta-inatividade";
export const DEFAULT_DIAS_ALERTA_INATIVIDADE = 7;
export const DIAS_LEAD_NOVO = 7;

export type LeadsViewMode = "lista" | "grade" | "kanban";

export function isLeadsViewMode(value: string): value is LeadsViewMode {
  return value === "lista" || value === "grade" || value === "kanban";
}
