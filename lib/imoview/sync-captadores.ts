import {
  getExternalCaptadoresFromRow,
  normalizeCaptadorName,
  parseCaptadoresFromRow,
} from "@/lib/imoview/parse-captadores";
import type { ImoviewImportTarget } from "@/lib/imoview/import-target";
import type { XlsRow } from "@/lib/imoview/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncCaptadoresResult = {
  imovelId: string;
  codigo: string;
  added: string[];
  skippedExisting: string[];
  ensuredPrincipal: boolean;
};

async function getExistingExternos(
  admin: SupabaseClient,
  imovelId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from("imovel_captadores")
    .select("nome_externo")
    .eq("imovel_id", imovelId);

  const names = new Set<string>();
  for (const row of data ?? []) {
    if (row.nome_externo?.trim()) {
      names.add(normalizeCaptadorName(row.nome_externo));
    }
  }
  return names;
}

async function ensurePrincipalCaptador(
  admin: SupabaseClient,
  imovelId: string,
  captadorPerfilId: string,
): Promise<boolean> {
  const { data: captadores } = await admin
    .from("imovel_captadores")
    .select("id, perfil_id, principal, nome_externo")
    .eq("imovel_id", imovelId);

  const rows = captadores ?? [];
  const principal = rows.find((row) => row.principal);

  if (principal?.perfil_id === captadorPerfilId) {
    return false;
  }

  if (principal) {
    await admin
      .from("imovel_captadores")
      .update({ perfil_id: captadorPerfilId, nome_externo: null, principal: true })
      .eq("id", principal.id);
  } else {
    await admin.from("imovel_captadores").insert({
      imovel_id: imovelId,
      perfil_id: captadorPerfilId,
      nome_externo: null,
      principal: true,
    });
  }

  await admin.from("imoveis").update({ captador_id: captadorPerfilId }).eq("id", imovelId);
  return true;
}

export async function syncCaptadoresFromRow(
  admin: SupabaseClient,
  imovelId: string,
  codigo: string,
  row: XlsRow,
  target: ImoviewImportTarget,
): Promise<SyncCaptadoresResult> {
  const externalNames = getExternalCaptadoresFromRow(row, target);
  const ensuredPrincipal = await ensurePrincipalCaptador(
    admin,
    imovelId,
    target.captadorPerfilId,
  );

  const existing = await getExistingExternos(admin, imovelId);
  const added: string[] = [];
  const skippedExisting: string[] = [];

  for (const nome of externalNames) {
    const key = normalizeCaptadorName(nome);
    if (existing.has(key)) {
      skippedExisting.push(nome);
      continue;
    }

    const { error } = await admin.from("imovel_captadores").insert({
      imovel_id: imovelId,
      perfil_id: null,
      nome_externo: nome,
      principal: false,
    });

    if (error) {
      throw new Error(`Imóvel ${codigo}: falha ao inserir captador externo "${nome}": ${error.message}`);
    }

    existing.add(key);
    added.push(nome);
  }

  return {
    imovelId,
    codigo,
    added,
    skippedExisting,
    ensuredPrincipal,
  };
}

export function describeCaptadoresRow(row: XlsRow): string {
  const names = parseCaptadoresFromRow(row);
  return names.length > 0 ? names.join(" | ") : "(vazio)";
}
