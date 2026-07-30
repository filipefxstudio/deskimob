/**
 * Backfill captadores externos a partir da planilha Imoview.
 *
 * Uso:
 *   npx tsx scripts/imoview-backfill-captadores.ts imobee
 *   npx tsx scripts/imoview-backfill-captadores.ts kenia
 *   npx tsx scripts/imoview-backfill-captadores.ts imobee kenia
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

loadEnv();

const XLS_PATH = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

async function main() {
  const targetIds = (process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ["imobee", "kenia"]) as ("imobee" | "kenia")[];

  const { normalizeCodigo, parseXlsBuffer } = await import("../lib/imoview/parse-xls");
  const { getExternalCaptadoresFromRow } = await import("../lib/imoview/parse-captadores");
  const { resolveImportTarget } = await import("../lib/imoview/import-target");
  const { syncCaptadoresFromRow, describeCaptadoresRow } = await import(
    "../lib/imoview/sync-captadores"
  );
  const { createServiceRoleClient } = await import("../lib/supabase/admin");

  const buffer = fs.readFileSync(XLS_PATH);
  const parsed = parseXlsBuffer(buffer, {
    filename: path.basename(XLS_PATH),
    exportYear: 2026,
  });

  const rowByCodigo = new Map(
    parsed.rows.map((row) => [normalizeCodigo(row.Codigo), row] as const),
  );

  const admin = createServiceRoleClient();

  for (const targetId of targetIds) {
    console.log(`\n========== ${targetId.toUpperCase()} ==========`);
    const target = await resolveImportTarget(admin, targetId);

    const { data: imoveis, error } = await admin
      .from("imoveis")
      .select("id, codigo")
      .eq("corretor_id", target.corretorId)
      .not("codigo", "is", null)
      .order("codigo");

    if (error) throw error;

    let processed = 0;
    let withExternalsExpected = 0;
    let totalAdded = 0;
    let imoveisUpdated = 0;
    const samples: string[] = [];

    for (const imovel of imoveis ?? []) {
      const codigo = normalizeCodigo(imovel.codigo);
      const row = rowByCodigo.get(codigo);
      if (!row) continue;

      processed += 1;
      const expected = getExternalCaptadoresFromRow(row, target);
      if (expected.length > 0) {
        withExternalsExpected += 1;
      }

      const result = await syncCaptadoresFromRow(admin, imovel.id, codigo, row, target);
      if (result.added.length > 0) {
        imoveisUpdated += 1;
        totalAdded += result.added.length;
        if (samples.length < 8) {
          samples.push(
            `${codigo}: +[${result.added.join(", ")}] (planilha: ${describeCaptadoresRow(row)})`,
          );
        }
      }
    }

    console.log(`Imóveis no banco: ${(imoveis ?? []).length}`);
    console.log(`Com linha na planilha: ${processed}`);
    console.log(`Com captador externo esperado: ${withExternalsExpected}`);
    console.log(`Imóveis atualizados: ${imoveisUpdated}`);
    console.log(`Captadores externos adicionados: ${totalAdded}`);
    if (samples.length > 0) {
      console.log("\nExemplos:");
      for (const sample of samples) console.log(`  ${sample}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
