import { enrichImovelWithPhotos } from "@/lib/imoview/enrich-from-imobee";
import { findOrCreateCliente } from "@/lib/imoview/dedupe-clientes";
import {
  loadStatusImovelLookup,
  type ImoviewImportTarget,
} from "@/lib/imoview/import-target";
import { mapRowToImovel } from "@/lib/imoview/map-row-to-imovel";
import { isPhotoEligible, normalizeCodigo } from "@/lib/imoview/parse-xls";
import { ensureUniqueImovelSlug, imovelExistsByCodigo } from "@/lib/imoview/slug-unique";
import type { ImportRowResult, ImportSingleOptions, XlsRow } from "@/lib/imoview/types";
import { generateImovelSlug } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function importSingleImovel(
  admin: SupabaseClient,
  row: XlsRow,
  exportYear: number,
  target: ImoviewImportTarget,
  options: ImportSingleOptions = {},
): Promise<ImportRowResult> {
  const codigo = normalizeCodigo(row.Codigo);

  if (!codigo) {
    return { codigo: "(vazio)", status: "error", message: "Código ausente na planilha." };
  }

  const existingId = await imovelExistsByCodigo(admin, codigo, target.corretorId);
  if (existingId) {
    return { codigo, status: "skipped", message: "Imóvel já existe.", imovelId: existingId };
  }

  try {
    const statusImovelLookup =
      options.statusImovelLookup ??
      (await loadStatusImovelLookup(admin, target.corretorId));
    const mapContext = {
      captadorPerfilId: target.captadorPerfilId,
      statusImovelLookup,
    };

    const tempSlug = generateImovelSlug("temp", String(row.Cidade ?? ""));
    const { mapped: draft, warnings } = mapRowToImovel(row, exportYear, tempSlug, mapContext);
    const baseSlug = generateImovelSlug(draft.titulo, draft.cidade);
    const slug = await ensureUniqueImovelSlug(admin, baseSlug, target.corretorId);
    const mapped = { ...draft, slug };

    const clienteResult = await findOrCreateCliente(
      admin,
      row.Proprietarios,
      target.corretorId,
    );

    const { data: imovel, error: insertError } = await admin
      .from("imoveis")
      .insert({
        corretor_id: target.corretorId,
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
      perfil_id: target.captadorPerfilId,
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

    let photosDownloaded = 0;
    let photosFailed = 0;

    if (!options.skipPhotos && isPhotoEligible(row)) {
      const enrichment = await enrichImovelWithPhotos(
        admin,
        imovel.id,
        codigo,
        mapped.cidade,
        target.corretorId,
      );

      photosDownloaded = enrichment.photosDownloaded;
      photosFailed = enrichment.photosFailed;

      if (enrichment.warning) messages.push(enrichment.warning);
      if (enrichment.photosSkipped) messages.push("Fotos já existiam — download ignorado.");
      if (enrichment.tituloAtualizado) messages.push("Título/slug atualizados via Imobee.");
    }

    return {
      codigo,
      status: "ok",
      message: messages.length > 0 ? messages.join("; ") : undefined,
      imovelId: imovel.id,
      clienteCreated: clienteResult.created,
      clienteReused: clienteResult.reused,
      semTelefone: clienteResult.semTelefone,
      photosDownloaded,
      photosFailed,
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
  target: ImoviewImportTarget,
  limit?: number,
  options: ImportSingleOptions = {},
): Promise<{
  imported: number;
  skipped: number;
  errors: number;
  excludedDesativado: number;
  clientesCreated: number;
  clientesReused: number;
  semTelefone: string[];
  photosDownloaded: number;
  photosFailed: number;
  results: ImportRowResult[];
}> {
  const toProcess = limit && limit > 0 ? rows.slice(0, limit) : rows;
  const results: ImportRowResult[] = [];
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let clientesCreated = 0;
  let clientesReused = 0;
  let photosDownloaded = 0;
  let photosFailed = 0;
  const semTelefone: string[] = [];

  const statusImovelLookup = await loadStatusImovelLookup(admin, target.corretorId);
  const importOptions: ImportSingleOptions = {
    ...options,
    statusImovelLookup,
  };

  for (const row of toProcess) {
    const result = await importSingleImovel(admin, row, exportYear, target, importOptions);
    results.push(result);

    if (result.status === "ok") {
      imported += 1;
      if (result.clienteCreated) clientesCreated += 1;
      if (result.clienteReused) clientesReused += 1;
      if (result.semTelefone) semTelefone.push(result.codigo);
      photosDownloaded += result.photosDownloaded ?? 0;
      photosFailed += result.photosFailed ?? 0;
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
    excludedDesativado: 0,
    clientesCreated,
    clientesReused,
    semTelefone,
    photosDownloaded,
    photosFailed,
    results,
  };
}
