import { NextResponse } from "next/server";

import {
  isImoviewImportAccessError,
  requireImoviewImportAccess,
} from "@/lib/auth/imoview-import-access";
import { analyzeSpreadsheet } from "@/lib/imoview/analyze-spreadsheet";

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

  const exportYearRaw = formData.get("exportYear");
  const exportYear =
    typeof exportYearRaw === "string" && exportYearRaw
      ? Number.parseInt(exportYearRaw, 10)
      : undefined;

  const supabasePlanRaw = formData.get("supabasePlan");
  const supabasePlan =
    supabasePlanRaw === "pro" || supabasePlanRaw === "free" ? supabasePlanRaw : undefined;

  const skipApi = formData.get("skipImobeeApi") === "true";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await analyzeSpreadsheet({
      buffer,
      filename: file.name,
      exportYear: Number.isFinite(exportYear) ? exportYear : undefined,
      supabasePlan,
      skipImobeeApi: skipApi,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao analisar planilha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
