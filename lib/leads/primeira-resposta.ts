import { getDbTimestampMs } from "@/lib/dates/format";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function calcularTempoPrimeiraRespostaIfNeeded(
  leadId: string,
  interacaoTimestamp: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: lead } = await supabase
    .from("leads")
    .select("tempo_primeira_resposta_min, data_entrada")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead || lead.tempo_primeira_resposta_min != null || !lead.data_entrada) {
    return;
  }

  const entradaMs = getDbTimestampMs(lead.data_entrada as string);
  const interacaoMs = getDbTimestampMs(interacaoTimestamp);
  const minutos = Math.max(0, Math.round((interacaoMs - entradaMs) / 60_000));

  await supabase
    .from("leads")
    .update({ tempo_primeira_resposta_min: minutos })
    .eq("id", leadId)
    .is("tempo_primeira_resposta_min", null);
}
