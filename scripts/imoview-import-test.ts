/**
 * Teste Fase 1 — importa N imóveis da planilha local via service role.
 * Uso: npx tsx scripts/imoview-import-test.ts [limit]
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

const limit = Number.parseInt(process.argv[2] ?? "10", 10);
const xlsPath = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

async function main() {
  const { parseXlsBuffer } = await import("../lib/imoview/parse-xls");
  const { importSpreadsheetRows } = await import("../lib/imoview/import-single-imovel");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { analyzeSpreadsheet } = await import("../lib/imoview/analyze-spreadsheet");

  const buffer = fs.readFileSync(xlsPath);
  console.log("Analisando planilha…");
  const analysis = await analyzeSpreadsheet({
    buffer,
    filename: path.basename(xlsPath),
    exportYear: 2026,
    skipImobeeApi: true,
  });
  console.log("Total:", analysis.spreadsheet.totalRows);
  console.log("Elegíveis fotos:", analysis.photos.eligibleCount);
  console.log("Storage:", analysis.storage.status, analysis.storage.percentUsed + "%");

  const parsed = parseXlsBuffer(buffer, { filename: path.basename(xlsPath), exportYear: 2026 });
  const admin = createServiceRoleClient();

  console.log(`Importando ${limit} imóveis (sem fotos)…`);
  const summary = await importSpreadsheetRows(admin, parsed.rows, parsed.exportYear, limit);

  console.log("\n--- Resultado ---");
  console.log("Importados:", summary.imported);
  console.log("Pulados:", summary.skipped);
  console.log("Erros:", summary.errors);
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
