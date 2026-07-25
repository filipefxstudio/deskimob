import {
  IMOVIEW_CAPTADOR_PRINCIPAL_ID,
  IMOVIEW_IMPORT_CORRETOR_ID,
} from "@/lib/imoview/constants";
import { findOrCreateCliente } from "@/lib/imoview/dedupe-clientes";
import { mapRowToImovel } from "@/lib/imoview/map-row-to-imovel";
import { normalizeCodigo } from "@/lib/imoview/parse-xls";
import { ensureUniqueImovelSlug, imovelExistsByCodigo } from "@/lib/imoview/slug-unique";
import type { ImportRowResult, XlsRow } from "@/lib/imoview/types";
import { generateImovelSlug } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function importSingleImovel(
  admin: SupabaseClient,
  row: XlsRow,
  exportYear: number,
): Promise<ImportRowResult> {
  const codigo = normalizeCodigo(row.Codigo);

  if (!codigo) {
    return { codigo: "(vazio)", status: "error", message: "Código ausente na planilha." };
  }

  const existingId = await imovelExistsByCodigo(admin, codigo);
  if (existingId) {
    return { codigo, status: "skipped", message: "Imóvel já existe.", imovelId: existingId };
  }

  try {
    const tempSlug = generateImovelSlug("temp", String(row.Cidade ?? ""));
    const { mapped: draft, warnings } = mapRowToImovel(row, exportYear, tempSlug);
    const baseSlug = generateImovelSlug(draft.titulo, draft.cidade);
    const slug = await ensureUniqueImovelSlug(admin, baseSlug);
    const mapped = { ...draft, slug };

    const clienteResult = await findOrCreateCliente(admin, row.Proprietarios);

    const { data: imovel, error: insertError } = await admin
      .from("imoveis")
      .insert({
        corretor_id: IMOVIEW_IMPORT_CORRETOR_ID,
        ...mapped,
        cliente_id: clienteResult.clienteId,
      })
      .select("id")
      .single();

    if (insertError || !imovel) {
      return {
        codigo,
        status: "error",
        message: insertError?.message ?? "Falha ao inserir imóvel.",
      };
    }

    const { error: captadorError } = await admin.from("imovel_captadores").insert({
      imovel_id: imovel.id,
      perfil_id: IMOVIEW_CAPTADOR_PRINCIPAL_ID,
      principal: true,
      nome_externo: null,
    });

    if (captadorError) {
      await admin.from("imoveis").delete().eq("id", imovel.id);
      return {
        codigo,
        status: "error",
        message: `Captador: ${captadorError.message}`,
      };
    }

    const messages = [...warnings];
    if (clienteResult.semTelefone) {
      messages.push("Proprietário sem telefone — cliente_id null.");
    }

    return {
      codigo,
      status: "ok",
      message: messages.length > 0 ? messages.join("; ") : undefined,
      imovelId: imovel.id,
      clienteCreated: clienteResult.created,
      clienteReused: clienteResult.reused,
      semTelefone: clienteResult.semTelefone,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return { codigo, status: "error", message };
  }
}

export async function importSpreadsheetRows(
  admin: SupabaseClient,
  rows: XlsRow[],
  exportYear: number,
  limit?: number,
): Promise<{
  imported: number;
  skipped: number;
  errors: number;
  clientesCreated: number;
  clientesReused: number;
  semTelefone: string[];
  results: ImportRowResult[];
}> {
  const toProcess = limit && limit > 0 ? rows.slice(0, limit) : rows;
  const results: ImportRowResult[] = [];
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let clientesCreated = 0;
  let clientesReused = 0;
  const semTelefone: string[] = [];

  for (const row of toProcess) {
    const result = await importSingleImovel(admin, row, exportYear);
    results.push(result);

    if (result.status === "ok") {
      imported += 1;
      if (result.clienteCreated) clientesCreated += 1;
      if (result.clienteReused) clientesReused += 1;
      if (result.semTelefone) semTelefone.push(result.codigo);
    } else if (result.status === "skipped") {
      skipped += 1;
    } else {
      errors += 1;
    }
  }

  return {
    imported,
    skipped,
    errors,
    clientesCreated,
    clientesReused,
    semTelefone,
    results,
  };
}
