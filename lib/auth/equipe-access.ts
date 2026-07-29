import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";
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

/** Dados pessoais do usuário logado (dono da conta ou membro da equipe). */
export type UsuarioLogadoDisplay = {
  nome: string;
  email: string;
  telefone: string | null;
  fotoUrl: string | null;
  isAccountOwner: boolean;
};

export function getUsuarioLogadoDisplay(
  ctx: EquipeAccessContext,
  authEmail?: string | null,
): UsuarioLogadoDisplay {
  const { corretor, perfil, isAccountOwner } = ctx;

  if (isAccountOwner || !perfil) {
    return {
      nome: corretor.nome,
      email: corretor.email,
      telefone: corretor.telefone ?? null,
      fotoUrl: corretor.foto_url ?? null,
      isAccountOwner: true,
    };
  }

  return {
    nome: perfil.nome,
    email: perfil.email || authEmail || corretor.email,
    telefone: perfil.telefone ?? null,
    fotoUrl: perfil.foto_url ?? null,
    isAccountOwner: false,
  };
}

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

export async function getEquipeAccessContext(): Promise<EquipeAccessContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  const perfil = await getPerfilForUser(corretor.id);

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

