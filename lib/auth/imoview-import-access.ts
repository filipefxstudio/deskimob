import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { IMOVIEW_IMPORT_CORRETOR_ID } from "@/lib/imoview/constants";
import { getEquipeAccessContext } from "@/lib/auth/equipe-access";
import type { EquipeAccessContext } from "@/lib/auth/equipe-access";

export type ImoviewImportAccessContext = EquipeAccessContext;

function isAuthorizedCorretor(corretorId: string): boolean {
  return corretorId === IMOVIEW_IMPORT_CORRETOR_ID;
}

export async function getImoviewImportAccessContext(): Promise<ImoviewImportAccessContext | null> {
  const ctx = await getEquipeAccessContext();
  if (!ctx) return null;
  if (!isAuthorizedCorretor(ctx.corretor.id)) return null;
  return ctx;
}

/** Para páginas — redireciona não autorizados para /dashboard */
export async function requireImoviewImportAccessPage(): Promise<ImoviewImportAccessContext> {
  const ctx = await getImoviewImportAccessContext();
  if (!ctx) {
    redirect("/dashboard");
  }
  return ctx;
}

/** Para API routes — retorna 403 se não autorizado */
export async function requireImoviewImportAccess(): Promise<
  ImoviewImportAccessContext | NextResponse
> {
  const ctx = await getEquipeAccessContext();

  if (!ctx) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  if (!isAuthorizedCorretor(ctx.corretor.id)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  return ctx;
}

export function isImoviewImportAccessError(
  result: ImoviewImportAccessContext | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
