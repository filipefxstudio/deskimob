import { NextResponse } from "next/server";

import {
  isImoviewImportAccessError,
  requireImoviewImportAccess,
} from "@/lib/auth/imoview-import-access";
import { summarizeRowsForImport } from "@/lib/imoview/analyze-spreadsheet";
import { buildImobeeImportTarget } from "@/lib/imoview/import-target";
import { importSpreadsheetRows } from "@/lib/imoview/import-single-imovel";
import { filterMigratableRows, parseXlsBuffer } from "@/lib/imoview/parse-xls";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

export async function POST(request: Request) {
  const access = await requireImoviewImportAccess();
  if (isImoviewImportAccessError(access)) return access;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo XLS obrigatório." }, { status: 400 });
  }

  const limitRaw = formData.get("limit");
  const limit =
    typeof limitRaw === "string" && limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const exportYearRaw = formData.get("exportYear");
  const exportYear =
    typeof exportYearRaw === "string" && exportYearRaw
      ? Number.parseInt(exportYearRaw, 10)
      : undefined;

  const skipPhotos = formData.get("skipPhotos") !== "false";

  try {
    const admin = createServiceRoleClient();
    const target = await buildImobeeImportTarget(admin);
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseXlsBuffer(buffer, {
      filename: file.name,
      exportYear: Number.isFinite(exportYear) ? exportYear : undefined,
    });

    const filterOptions = {
      excludedCodigos: target.excludedCodigos,
      rowFilter: target.rowFilter,
    };
    const excludedDesativado =
      parsed.rows.length - filterMigratableRows(parsed.rows, filterOptions).length;
    const rowsToImport = summarizeRowsForImport(
      parsed.rows,
      Number.isFinite(limit) && limit! > 0 ? limit : undefined,
      target,
    );

    const summary = await importSpreadsheetRows(
      admin,
      rowsToImport,
      parsed.exportYear,
      target,
      undefined,
      { skipPhotos },
    );

    summary.excludedDesativado = excludedDesativado;

    const { data: job, error: jobError } = await admin
      .from("imoview_import_jobs")
      .insert({
        corretor_id: access.corretor.id,
        status: "completed",
        total_rows: rowsToImport.length,
        processed_rows: summary.results.length,
        imported_count: summary.imported,
        skipped_count: summary.skipped,
        error_count: summary.errors,
        photos_downloaded: summary.photosDownloaded,
        options: { limit, skipPhotos, excludedDesativado },
        summary,
      })
      .select("id")
      .single();

    if (jobError) {
      console.error("[imoview/import] job log failed", jobError);
    }

    if (job?.id) {
      const logs = summary.results.map((r) => ({
        job_id: job.id,
        codigo: r.codigo,
        status: r.status,
        message: r.message ?? null,
        details: {
          imovelId: r.imovelId ?? null,
          photosDownloaded: r.photosDownloaded ?? 0,
          photosFailed: r.photosFailed ?? 0,
        },
      }));

      if (logs.length > 0) {
        await admin.from("imoview_import_logs").insert(logs);
      }
    }

    return NextResponse.json({ success: true, jobId: job?.id ?? null, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na importação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
