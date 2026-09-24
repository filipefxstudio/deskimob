import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceRoleClient } from "@/lib/supabase/admin";

import { resolveDestinatarioUserId } from "./resolve-destinatario";
import { sendPushForCorretor } from "./push-send";
import type { EmitNotificacaoInput, NotificacaoRow } from "./types";

async function countUnreadForDestinatario(
  supabase: SupabaseClient,
  corretorId: string,
  destinatarioUserId: string | null | undefined,
): Promise<number> {
  let query = supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", corretorId)
    .is("lida_em", null);

  if (destinatarioUserId) {
    query = query.or(`destinatario_user_id.is.null,destinatario_user_id.eq.${destinatarioUserId}`);
  }

  const { count } = await query;
  return count ?? 0;
}

export async function emitNotificacao(input: EmitNotificacaoInput): Promise<NotificacaoRow | null> {
  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    console.error("[emitNotificacao] admin client", error);
    return null;
  }

  const row = {
    corretor_id: input.corretorId,
    tipo: input.tipo,
    titulo: input.titulo,
    mensagem: input.mensagem?.trim() || null,
    href: input.href?.trim() || null,
    entidade_tipo: input.entidadeTipo ?? null,
    entidade_id: input.entidadeId ?? null,
    dedupe_key: input.dedupeKey ?? null,
    destinatario_user_id: input.destinatarioUserId ?? null,
  };

  if (input.dedupeKey && input.upsertDedupe) {
    const { data: existing } = await supabase
      .from("notificacoes")
      .select("id, lida_em")
      .eq("corretor_id", input.corretorId)
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from("notificacoes")
        .update({
          titulo: row.titulo,
          mensagem: row.mensagem,
          href: row.href,
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) {
        console.error("[emitNotificacao] update dedupe", error);
        return null;
      }

      return updated as NotificacaoRow;
    }
  }

  const { data, error } = await supabase.from("notificacoes").insert(row).select("*").single();

  if (error) {
    if (input.dedupeKey && error.code === "23505") {
      return null;
    }
    console.error("[emitNotificacao] insert", error);
    return null;
  }

  const created = data as NotificacaoRow;
  const unreadCount = await countUnreadForDestinatario(
    supabase,
    input.corretorId,
    input.destinatarioUserId,
  );

  void sendPushForCorretor(
    input.corretorId,
    {
      title: input.titulo,
      body: input.mensagem ?? undefined,
      url: input.href ?? undefined,
      badgeCount: unreadCount,
    },
    { destinatarioUserId: input.destinatarioUserId },
  );

  return created;
}

function formatImovelParte(imovelTitulo?: string | null, imovelCodigo?: string | null): string {
  if (!imovelTitulo?.trim()) return "";
  const codigo = imovelCodigo?.trim();
  return ` sobre ${imovelTitulo.trim()}${codigo ? ` (${codigo})` : ""}`;
}

/** Novo atendimento/lead (manual, site, portais, integrações). */
export async function emitNotificacaoNovoAtendimento(params: {
  supabase?: SupabaseClient;
  corretorId: string;
  leadId: string;
  leadNome: string;
  perfilId?: string | null;
  origemLabel: string;
  imovelTitulo?: string | null;
  imovelCodigo?: string | null;
}): Promise<void> {
  let supabase = params.supabase;
  if (!supabase) {
    try {
      supabase = createServiceRoleClient();
    } catch (error) {
      console.error("[emitNotificacaoNovoAtendimento] admin client", error);
      return;
    }
  }

  const destinatarioUserId = await resolveDestinatarioUserId(
    supabase,
    params.corretorId,
    params.perfilId,
  );

  const midia = params.origemLabel.trim() || "Integração";
  const imovelParte = formatImovelParte(params.imovelTitulo, params.imovelCodigo);

  await emitNotificacao({
    corretorId: params.corretorId,
    destinatarioUserId,
    tipo: "novo_atendimento",
    titulo: "Novo atendimento",
    mensagem: `${params.leadNome} — cadastro via ${midia}${imovelParte}.`,
    href: `/dashboard/atendimentos/${params.leadId}`,
    entidadeTipo: "lead",
    entidadeId: params.leadId,
  });
}

/** Lead existente entrou em contato de novo (site / portal). */
export async function emitNotificacaoLeadRecontato(params: {
  supabase?: SupabaseClient;
  corretorId: string;
  leadId: string;
  leadNome: string;
  perfilId?: string | null;
  origemLabel: string;
  imovelTitulo?: string | null;
  imovelCodigo?: string | null;
}): Promise<void> {
  let supabase = params.supabase;
  if (!supabase) {
    try {
      supabase = createServiceRoleClient();
    } catch (error) {
      console.error("[emitNotificacaoLeadRecontato] admin client", error);
      return;
    }
  }

  const destinatarioUserId = await resolveDestinatarioUserId(
    supabase,
    params.corretorId,
    params.perfilId,
  );

  const midia = params.origemLabel.trim() || "Integração";
  const imovelParte = formatImovelParte(params.imovelTitulo, params.imovelCodigo);

  await emitNotificacao({
    corretorId: params.corretorId,
    destinatarioUserId,
    tipo: "lead_site",
    titulo: "Nova mensagem de lead",
    mensagem: `${params.leadNome} entrou em contato via ${midia}${imovelParte}.`,
    href: `/dashboard/atendimentos/${params.leadId}`,
    entidadeTipo: "lead",
    entidadeId: params.leadId,
  });
}

/** @deprecated Use emitNotificacaoNovoAtendimento / emitNotificacaoLeadRecontato */
export async function emitNotificacaoLeadSite(params: {
  corretorId: string;
  leadId: string;
  leadNome: string;
  criado: boolean;
  perfilId?: string | null;
  imovelTitulo?: string | null;
  imovelCodigo?: string | null;
  origemLabel?: string;
}): Promise<void> {
  const base = {
    corretorId: params.corretorId,
    leadId: params.leadId,
    leadNome: params.leadNome,
    perfilId: params.perfilId,
    origemLabel: params.origemLabel?.trim() || "Site",
    imovelTitulo: params.imovelTitulo,
    imovelCodigo: params.imovelCodigo,
  };

  if (params.criado) {
    await emitNotificacaoNovoAtendimento(base);
  } else {
    await emitNotificacaoLeadRecontato(base);
  }
}
