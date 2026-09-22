"use server";

import { getAgendaItems } from "@/lib/actions/agenda";
import { getDashboardDataBothTabs, type DashboardAlertaItem } from "@/lib/actions/dashboard";
import { formatDateTimeBrasilia } from "@/lib/dates/format";
import type { NotificacaoRow } from "@/lib/notifications/types";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";

const LIST_LIMIT = 40;

function alertaToNotificacaoFields(alerta: DashboardAlertaItem) {
  return {
    tipo: "dashboard_alerta" as const,
    titulo: alerta.mensagem,
    mensagem: alerta.acaoLabel,
    href: alerta.href,
    dedupeKey: `dashboard:${alerta.id}`,
  };
}

async function syncDashboardAlertas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
  alertas: DashboardAlertaItem[],
): Promise<void> {
  const activeKeys = new Set(alertas.map((a) => `dashboard:${a.id}`));

  for (const alerta of alertas) {
    const fields = alertaToNotificacaoFields(alerta);
    const { data: existing } = await supabase
      .from("notificacoes")
      .select("id")
      .eq("corretor_id", corretorId)
      .eq("dedupe_key", fields.dedupeKey)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("notificacoes")
        .update({
          titulo: fields.titulo,
          mensagem: fields.mensagem,
          href: fields.href,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("notificacoes").insert({
        corretor_id: corretorId,
        tipo: fields.tipo,
        titulo: fields.titulo,
        mensagem: fields.mensagem,
        href: fields.href,
        dedupe_key: fields.dedupeKey,
      });
    }
  }

  const { data: stale } = await supabase
    .from("notificacoes")
    .select("id, dedupe_key")
    .eq("corretor_id", corretorId)
    .eq("tipo", "dashboard_alerta")
    .is("lida_em", null);

  for (const row of stale ?? []) {
    if (row.dedupe_key && !activeKeys.has(row.dedupe_key)) {
      await supabase
        .from("notificacoes")
        .update({ lida_em: new Date().toISOString() })
        .eq("id", row.id);
    }
  }
}

async function syncAgendaLembretes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  corretorId: string,
): Promise<void> {
  const agora = new Date();
  const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

  const items = await getAgendaItems({
    inicio: agora.toISOString(),
    fim: em24h.toISOString(),
    status: "pendente",
  });

  const activeKeys = new Set<string>();

  for (const item of items) {
    const dedupeKey = `agenda:${item.id}`;
    activeKeys.add(dedupeKey);
    const quando = formatDateTimeBrasilia(item.data_atividade);
    const titulo = item.tipo === "visita" ? "Visita agendada" : "Atividade agendada";
    const mensagem = `${item.titulo} — ${quando}`;

    const { data: existing } = await supabase
      .from("notificacoes")
      .select("id")
      .eq("corretor_id", corretorId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    const payload = {
      titulo,
      mensagem,
      href: item.lead_id
        ? `/dashboard/atendimentos/${item.lead_id}`
        : "/dashboard/agenda",
      entidade_tipo: "agenda",
      entidade_id: item.id,
    };

    if (existing) {
      await supabase.from("notificacoes").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("notificacoes").insert({
        corretor_id: corretorId,
        tipo: "agenda_lembrete",
        dedupe_key: dedupeKey,
        ...payload,
      });
    }
  }

  const { data: stale } = await supabase
    .from("notificacoes")
    .select("id, dedupe_key")
    .eq("corretor_id", corretorId)
    .eq("tipo", "agenda_lembrete")
    .is("lida_em", null);

  for (const row of stale ?? []) {
    if (row.dedupe_key && !activeKeys.has(row.dedupe_key)) {
      await supabase
        .from("notificacoes")
        .update({ lida_em: new Date().toISOString() })
        .eq("id", row.id);
    }
  }
}

async function syncDerivedNotificacoes(corretorId: string): Promise<void> {
  const supabase = await createClient();
  const both = await getDashboardDataBothTabs({
    periodPreset: "mes",
    customStart: "",
    customEnd: "",
  });
  const alertasMap = new Map<string, DashboardAlertaItem>();
  for (const a of both.venda?.alertas ?? []) {
    alertasMap.set(a.id, a);
  }
  for (const a of both.locacao?.alertas ?? []) {
    alertasMap.set(a.id, a);
  }

  await syncDashboardAlertas(supabase, corretorId, [...alertasMap.values()]);
  await syncAgendaLembretes(supabase, corretorId);
}

export async function getUnreadNotificacoesCount(): Promise<number> {
  const corretor = await getCorretorForUser();
  if (!corretor) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", corretor.id)
    .is("lida_em", null);

  if (error) {
    console.error("[getUnreadNotificacoesCount]", error);
    return 0;
  }

  return count ?? 0;
}

export async function listNotificacoes(options?: {
  syncDerived?: boolean;
}): Promise<NotificacaoRow[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  if (options?.syncDerived !== false) {
    try {
      await syncDerivedNotificacoes(corretor.id);
    } catch (error) {
      console.error("[listNotificacoes] syncDerived", error);
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notificacoes")
    .select("*")
    .eq("corretor_id", corretor.id)
    .order("criado_em", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    console.error("[listNotificacoes]", error);
    return [];
  }

  return (data ?? []) as NotificacaoRow[];
}

export async function markNotificacaoLida(id: string): Promise<{ success?: boolean; error?: string }> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .is("lida_em", null);

  if (error) {
    console.error("[markNotificacaoLida]", error);
    return { error: "Não foi possível marcar como lida." };
  }

  return { success: true };
}

export async function markAllNotificacoesLidas(): Promise<{ success?: boolean; error?: string }> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("corretor_id", corretor.id)
    .is("lida_em", null);

  if (error) {
    console.error("[markAllNotificacoesLidas]", error);
    return { error: "Não foi possível marcar todas como lidas." };
  }

  return { success: true };
}
