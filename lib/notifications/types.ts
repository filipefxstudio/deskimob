export type NotificacaoTipo =
  | "novo_lead"
  | "lead_site"
  | "agenda"
  | "agenda_lembrete"
  | "dashboard_alerta";

export interface NotificacaoRow {
  id: string;
  corretor_id: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string | null;
  href: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  dedupe_key: string | null;
  lida_em: string | null;
  criado_em: string;
}

export interface EmitNotificacaoInput {
  corretorId: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem?: string | null;
  href?: string | null;
  entidadeTipo?: string | null;
  entidadeId?: string | null;
  dedupeKey?: string | null;
  /** Se true, atualiza título/mensagem/href de alerta existente (não relê). */
  upsertDedupe?: boolean;
}
