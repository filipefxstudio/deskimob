import { IMOVIEW_IMPORT_CORRETOR_ID } from "@/lib/imoview/constants";
import { normalizeTelefone, parseProprietario } from "@/lib/imoview/parse-proprietario";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ClienteDedupeResult = {
  clienteId: string | null;
  created: boolean;
  reused: boolean;
  semTelefone: boolean;
};

export async function findOrCreateCliente(
  admin: SupabaseClient,
  proprietarioRaw: string | undefined | null,
): Promise<ClienteDedupeResult> {
  const parsed = parseProprietario(proprietarioRaw);
  if (!parsed) {
    return { clienteId: null, created: false, reused: false, semTelefone: false };
  }

  const telefone = normalizeTelefone(parsed.telefone);
  if (!telefone) {
    return { clienteId: null, created: false, reused: false, semTelefone: true };
  }

  const { data: existing } = await admin
    .from("clientes")
    .select("id")
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .eq("telefone", telefone)
    .maybeSingle();

  if (existing?.id) {
    return { clienteId: existing.id, created: false, reused: true, semTelefone: false };
  }

  const { data: created, error } = await admin
    .from("clientes")
    .insert({
      corretor_id: IMOVIEW_IMPORT_CORRETOR_ID,
      nome: parsed.nome,
      telefone,
      email: parsed.email,
      cpf: parsed.cpf,
      tipo: "proprietario",
      perfil_id: null,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Falha ao criar cliente.");
  }

  return { clienteId: created.id, created: true, reused: false, semTelefone: false };
}
