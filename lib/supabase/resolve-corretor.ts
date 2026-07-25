import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Corretor, Perfil } from "@/types";

function pickBestPerfil(perfis: Perfil[]): Perfil | null {
  if (perfis.length === 0) {
    return null;
  }

  return [...perfis].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    if (a.ativo) scoreA += 100;
    if (b.ativo) scoreB += 100;
    if (a.papel === "admin") scoreA += 10;
    if (b.papel === "admin") scoreB += 10;

    const scoreDiff = scoreB - scoreA;
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
  })[0];
}

export async function fetchCorretorById(corretorId: string): Promise<Corretor | null> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("corretores")
      .select("*")
      .eq("id", corretorId)
      .maybeSingle();

    if (error) {
      console.error("[fetchCorretorById] failed", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[fetchCorretorById] service role unavailable", error);
    return null;
  }
}

async function fetchCorretorByUserId(userId: string): Promise<Corretor | null> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("corretores")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[fetchCorretorByUserId] failed", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[fetchCorretorByUserId] service role unavailable", error);
    return null;
  }
}

async function fetchPerfilByUserId(userId: string): Promise<Perfil | null> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.from("perfis").select("*").eq("user_id", userId);

    if (error) {
      console.error("[fetchPerfilByUserId] failed", error);
      return null;
    }

    return pickBestPerfil((data as Perfil[] | null) ?? []);
  } catch (error) {
    console.error("[fetchPerfilByUserId] service role unavailable", error);
    return null;
  }
}

/** Resolve o corretor do tenant para o usuário autenticado (dono ou membro da equipe). */
export async function resolveCorretorForUser(): Promise<Corretor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: ownerCorretor, error: ownerError } = await supabase
    .from("corretores")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerError) {
    console.error("[resolveCorretorForUser] owner lookup failed", ownerError);
  }

  if (ownerCorretor) {
    return ownerCorretor;
  }

  const corretorByUser = await fetchCorretorByUserId(user.id);
  if (corretorByUser) {
    return corretorByUser;
  }

  const perfil = await fetchPerfilByUserId(user.id);
  if (!perfil?.corretor_id) {
    return null;
  }

  return fetchCorretorById(perfil.corretor_id);
}
