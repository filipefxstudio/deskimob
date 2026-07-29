import { parseLeadObservacoes } from "@/lib/leads/observacoes";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import { createClient } from "@/lib/supabase/server";
import type { Corretor } from "@/types";

export type TenantAccess = {
  verTodos: boolean;
  perfilAtualId: string | null;
  isContaDono: boolean;
};

export type TenantDbClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveTenantAccess(corretor: Corretor): Promise<TenantAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isContaDono = Boolean(user && user.id === corretor.user_id);
  const perfil = await getPerfilForUser(corretor.id);

  return {
    isContaDono,
    verTodos: isContaDono || perfil?.papel === "admin" || perfil?.papel === "gerente",
    perfilAtualId: perfil?.id ?? null,
  };
}

export function resolveLeadPerfilId(lead: {
  perfil_id?: string | null;
  observacoes?: string | null;
}): string | null {
  if (lead.perfil_id) {
    return lead.perfil_id;
  }

  return parseLeadObservacoes(lead.observacoes).meta.perfil_id ?? null;
}

export function registroVisivelPorPerfil(
  perfilId: string | null | undefined,
  access: TenantAccess,
): boolean {
  if (access.verTodos) {
    return true;
  }

  if (!perfilId) {
    return true;
  }

  if (!access.perfilAtualId) {
    return false;
  }

  return perfilId === access.perfilAtualId;
}

export function leadVisivelParaUsuario(
  lead: { perfil_id?: string | null; observacoes?: string | null },
  access: TenantAccess,
): boolean {
  return registroVisivelPorPerfil(resolveLeadPerfilId(lead), access);
}

export async function createTenantDataClient(): Promise<TenantDbClient | null> {
  try {
    return createServiceRoleClient();
  } catch (error) {
    console.error("[createTenantDataClient] service role unavailable", error);
    return null;
  }
}

export async function fetchWithTenantFallback<T>(
  corretorId: string,
  fetch: (client: TenantDbClient) => Promise<T>,
  isEmpty: (result: T) => boolean,
): Promise<T> {
  const supabase = await createClient();
  const primary = await fetch(supabase);

  if (!isEmpty(primary)) {
    return primary;
  }

  const admin = await createTenantDataClient();
  if (!admin) {
    return primary;
  }

  const fallback = await fetch(admin);

  if (!isEmpty(fallback)) {
    console.warn(
      "[fetchWithTenantFallback] authenticated query returned empty; used service role fallback",
      { corretorId },
    );
  }

  return isEmpty(fallback) ? primary : fallback;
}
