/**
 * Importa imóveis da planilha Imoview via service role.
 * Uso: npx tsx scripts/imoview-import-test.ts [limit] [--photos]
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

const args = process.argv.slice(2);
const withPhotos = args.includes("--photos");
const limitArg = args.find((a) => a !== "--photos");
const limit = Number.parseInt(limitArg ?? "10", 10);
const xlsPath = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

async function main() {
  const { summarizeRowsForImport, analyzeSpreadsheet } = await import(
    "../lib/imoview/analyze-spreadsheet"
  );
  const { importSpreadsheetRows } = await import("../lib/imoview/import-single-imovel");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { parseXlsBuffer, filterMigratableRows } = await import("../lib/imoview/parse-xls");

  const buffer = fs.readFileSync(xlsPath);
  console.log("Analisando planilha…");
  const analysis = await analyzeSpreadsheet({
    buffer,
    filename: path.basename(xlsPath),
    exportYear: 2026,
    skipImobeeApi: !withPhotos,
  });
  console.log("Total planilha:", analysis.spreadsheet.totalRows);
  console.log("A migrar:", analysis.spreadsheet.migratableRows);
  console.log("Excluídos Desativado:", analysis.spreadsheet.excludedDesativado);
  console.log("Elegíveis fotos:", analysis.photos.eligibleCount);
  console.log("Destino fotos:", analysis.photos.destination);

  const parsed = parseXlsBuffer(buffer, { filename: path.basename(xlsPath), exportYear: 2026 });
  const rows = summarizeRowsForImport(parsed.rows, limit);
  const excludedDesativado = parsed.rows.length - filterMigratableRows(parsed.rows).length;
  const admin = createServiceRoleClient();

  console.log(
    `Importando ${rows.length} imóveis${withPhotos ? " com fotos (Cloudinary)" : " (sem fotos)"}…`,
  );

  const summary = await importSpreadsheetRows(admin, rows, parsed.exportYear, undefined, {
    skipPhotos: !withPhotos,
  });
  summary.excludedDesativado = excludedDesativado;

  console.log("\n--- Resultado ---");
  console.log("Importados:", summary.imported);
  console.log("Pulados:", summary.skipped);
  console.log("Erros:", summary.errors);
  console.log("Fotos baixadas:", summary.photosDownloaded);
  console.log("Fotos falha:", summary.photosFailed);
  console.log("Clientes criados:", summary.clientesCreated);
  console.log("Clientes reutilizados:", summary.clientesReused);
  console.log("Sem telefone:", summary.semTelefone.join(", ") || "(nenhum)");

  for (const r of summary.results) {
    console.log(`  ${r.codigo}: ${r.status}${r.message ? ` — ${r.message}` : ""}`);
  }

  if (summary.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
