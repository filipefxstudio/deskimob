import { NextResponse } from "next/server";

import {
  isImoviewImportAccessError,
  requireImoviewImportAccess,
} from "@/lib/auth/imoview-import-access";
import { importSpreadsheetRows } from "@/lib/imoview/import-single-imovel";
import { parseXlsBuffer } from "@/lib/imoview/parse-xls";
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
    typeof limitRaw === "string" && limitRaw ? Number.parseInt(limitRaw, 10) : 10;

  const exportYearRaw = formData.get("exportYear");
  const exportYear =
    typeof exportYearRaw === "string" && exportYearRaw
      ? Number.parseInt(exportYearRaw, 10)
      : undefined;

  try {
    const admin = createServiceRoleClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseXlsBuffer(buffer, {
      filename: file.name,
      exportYear: Number.isFinite(exportYear) ? exportYear : undefined,
    });

    const summary = await importSpreadsheetRows(
      admin,
      parsed.rows,
      parsed.exportYear,
      Number.isFinite(limit) ? limit : 10,
    );

    const { data: job, error: jobError } = await admin
      .from("imoview_import_jobs")
      .insert({
        corretor_id: access.corretor.id,
        status: "completed",
        total_rows: parsed.rows.length,
        processed_rows: summary.results.length,
        imported_count: summary.imported,
        skipped_count: summary.skipped,
        error_count: summary.errors,
        options: { limit, skipPhotos: true },
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
        details: r.imovelId ? { imovelId: r.imovelId } : null,
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
