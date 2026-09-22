import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

import { sendPushForCorretor } from "./push-send";
import type { EmitNotificacaoInput, NotificacaoRow } from "./types";

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
          ...(existing.lida_em ? {} : {}),
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

  void sendPushForCorretor(input.corretorId, {
    title: input.titulo,
    body: input.mensagem ?? undefined,
    url: input.href ?? undefined,
  });

  return created;
}

export async function emitNotificacaoLeadSite(params: {
  corretorId: string;
  leadId: string;
  leadNome: string;
  criado: boolean;
  imovelTitulo?: string | null;
  imovelCodigo?: string | null;
  origemLabel?: string;
}): Promise<void> {
  const imovelParte =
    params.imovelTitulo?.trim()
      ? ` sobre ${params.imovelTitulo.trim()}${params.imovelCodigo ? ` (${params.imovelCodigo})` : ""}`
      : "";

  const midia = params.origemLabel?.trim() || "Site";

  const titulo = params.criado ? "Novo lead do site" : "Nova mensagem pelo site";
  const mensagem = params.criado
    ? `${params.leadNome} se cadastrou via ${midia}${imovelParte}.`
    : `${params.leadNome} enviou nova mensagem via ${midia}${imovelParte}.`;

  await emitNotificacao({
    corretorId: params.corretorId,
    tipo: "lead_site",
    titulo,
    mensagem,
    href: `/dashboard/atendimentos/${params.leadId}`,
    entidadeTipo: "lead",
    entidadeId: params.leadId,
  });
}
