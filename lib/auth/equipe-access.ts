import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import type { Corretor, Perfil } from "@/types";

export type {
  CorretorRef,
} from "@/lib/auth/equipe-perfil";
export {
  dedupePerfisEquipe,
  isActiveAdminPerfil,
  isPerfilConvitePendente,
  isPrincipalPerfil,
  perfilTemAuthVinculado,
} from "@/lib/auth/equipe-perfil";

export type EquipeAccessContext = {
  userId: string;
  corretor: Corretor;
  perfil: Perfil | null;
  isAccountOwner: boolean;
  isAdmin: boolean;
  canManageEquipe: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isAccountOwner(corretor: Corretor, userId: string): boolean {
  return corretor.user_id === userId;
}

export function isAdminPerfil(perfil: Perfil | null | undefined): boolean {
  return Boolean(perfil?.ativo && perfil.papel === "admin");
}

export function canManageEquipe(
  corretor: Corretor,
  userId: string,
  perfil: Perfil | null | undefined,
): boolean {
  return isAccountOwner(corretor, userId) || isAdminPerfil(perfil);
}

async function fetchCorretorById(corretorId: string): Promise<Corretor | null> {
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

    return (data as Corretor | null) ?? null;
  } catch (error) {
    console.error("[fetchCorretorById] service role unavailable", error);
    return null;
  }
}

export async function getEquipeAccessContext(): Promise<EquipeAccessContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [ownerCorretor, perfil] = await Promise.all([
    getCorretorForUser(),
    getPerfilForUser(),
  ]);

  let corretor = ownerCorretor;

  if (!corretor && perfil?.corretor_id) {
    corretor = await fetchCorretorById(perfil.corretor_id);
  }

  if (!corretor) {
    return null;
  }

  const owner = isAccountOwner(corretor, user.id);
  const admin = isAdminPerfil(perfil) || owner;

  return {
    userId: user.id,
    corretor,
    perfil,
    isAccountOwner: owner,
    isAdmin: admin,
    canManageEquipe: owner || isAdminPerfil(perfil),
  };
}

export async function requireEquipeManager(): Promise<
  | { error: string }
  | EquipeAccessContext
> {
  const ctx = await getEquipeAccessContext();

  if (!ctx) {
    return { error: "Sessão expirada." };
  }

  if (!ctx.canManageEquipe) {
    return { error: "Sem permissão para gerenciar a equipe." };
  }

  return ctx;
}

export async function requireSiteAdmin(): Promise<
  | { error: string }
  | EquipeAccessContext
> {
  const ctx = await getEquipeAccessContext();

  if (!ctx) {
    return { error: "Sessão expirada." };
  }

  if (!ctx.isAdmin) {
    return { error: "Sem permissão para configurar o site." };
  }

  return ctx;
}
