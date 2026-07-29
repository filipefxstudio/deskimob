import { normalizeTelefone, parseProprietario } from "@/lib/imoview/parse-proprietario";
import { emailValidoParaBusca, normalizeEmail } from "@/lib/pessoas/duplicate";
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
  corretorId: string,
): Promise<ClienteDedupeResult> {
  const parsed = parseProprietario(proprietarioRaw);
  if (!parsed) {
    return { clienteId: null, created: false, reused: false, semTelefone: false };
  }

  const telefone = normalizeTelefone(parsed.telefone);
  const emailNorm = parsed.email && emailValidoParaBusca(parsed.email)
    ? normalizeEmail(parsed.email)
    : null;

  // Telefone primeiro: quase todos os cadastros têm telefone; e-mail costuma faltar ou ser do corretor.
  if (telefone) {
    const { data: byTelefone } = await admin
      .from("clientes")
      .select("id")
      .eq("corretor_id", corretorId)
      .eq("telefone", telefone)
      .maybeSingle();

    if (byTelefone?.id) {
      return { clienteId: byTelefone.id, created: false, reused: true, semTelefone: false };
    }
  }

  if (emailNorm) {
    const { data: byEmail } = await admin
      .from("clientes")
      .select("id")
      .eq("corretor_id", corretorId)
      .ilike("email", emailNorm)
      .maybeSingle();

    if (byEmail?.id) {
      return { clienteId: byEmail.id, created: false, reused: true, semTelefone: !telefone };
    }
  }

  if (!telefone) {
    return { clienteId: null, created: false, reused: false, semTelefone: true };
  }

  const { data: created, error } = await admin
    .from("clientes")
    .insert({
      corretor_id: corretorId,
      nome: parsed.nome,
      telefone,
      email: emailNorm ?? parsed.email,
      cpf: parsed.cpf,
      tipo: "proprietario",
      perfil_id: null,
    })
    .select("id")
    .single();

  if (error || !created) {
    // Corrida ou e-mail já cadastrado — reaproveita em vez de duplicar pessoa.
    if (error?.code === "23505" && emailNorm) {
      const { data: byEmail } = await admin
        .from("clientes")
        .select("id")
        .eq("corretor_id", corretorId)
        .ilike("email", emailNorm)
        .maybeSingle();

      if (byEmail?.id) {
        return { clienteId: byEmail.id, created: false, reused: true, semTelefone: false };
      }
    }

    throw new Error(error?.message ?? "Falha ao criar cliente.");
  }

  return { clienteId: created.id, created: true, reused: false, semTelefone: false };
}
