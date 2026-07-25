import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logPostgrestError } from "@/lib/supabase/postgrest-error";
import type { Perfil } from "@/types";

function perfilPriorityScore(perfil: Perfil): number {
  let score = 0;
  if (perfil.ativo) score += 100;
  if (perfil.papel === "admin") score += 10;
  return score;
}

function pickBestPerfil(perfis: Perfil[]): Perfil | null {
  if (perfis.length === 0) {
    return null;
  }

  return [...perfis].sort((a, b) => {
    const scoreDiff = perfilPriorityScore(b) - perfilPriorityScore(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
  })[0];
}

export async function getPerfilForUser(corretorId?: string): Promise<Perfil | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("perfis")
    .select("*")
    .eq("user_id", user.id);

  if (!error) {
    const perfil = pickBestPerfilForCorretor((data as Perfil[] | null) ?? [], corretorId);
    if (perfil) {
      return perfil;
    }
  } else {
    logPostgrestError("getPerfilForUser", error);
  }

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackData, error: fallbackError } = await admin
      .from("perfis")
      .select("*")
      .eq("user_id", user.id);

    if (fallbackError) {
      logPostgrestError("getPerfilForUser:fallback", fallbackError);
      return null;
    }

    const perfil = pickBestPerfilForCorretor((fallbackData as Perfil[] | null) ?? [], corretorId);

    if (perfil) {
      console.warn("[getPerfilForUser] authenticated query returned empty; used service role fallback", {
        userId: user.id,
        corretorId,
      });
    }

    return perfil;
  } catch (fallbackError) {
    console.error("[getPerfilForUser] service role fallback unavailable", fallbackError);
    return null;
  }
}

function pickBestPerfilForCorretor(perfis: Perfil[], corretorId?: string): Perfil | null {
  if (perfis.length === 0) {
    return null;
  }

  const scoped =
    corretorId != null
      ? perfis.filter((perfil) => perfil.corretor_id === corretorId)
      : perfis;

  const pool = scoped.length > 0 ? scoped : perfis;

  if (pool.length > 1) {
    console.warn(`[getPerfilForUser] ${pool.length} perfis for user, picking best`);
  }

  return pickBestPerfil(pool);
}
