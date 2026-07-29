/**
 * Migrador Imoview — versão final multi-conta.
 *
 * Uso:
 *   npx tsx scripts/imoview-import.ts kenia --analyze
 *   npx tsx scripts/imoview-import.ts kenia [limit] [--photos]
 *   npx tsx scripts/imoview-import.ts imobee [limit] [--photos]
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
  const args = process.argv.slice(2);
  const targetId = args[0] ?? "kenia";
  const analyzeOnly = args.includes("--analyze");
  const withPhotos = args.includes("--photos");
  const limitArg = args.find((a) => a !== "--photos" && a !== "--analyze" && a !== targetId);
  const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

  const { analyzeSpreadsheet, summarizeRowsForImport } = await import(
    "../lib/imoview/analyze-spreadsheet"
  );
  const { importSpreadsheetRows } = await import("../lib/imoview/import-single-imovel");
  const { resolveImportTarget } = await import("../lib/imoview/import-target");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { filterMigratableRows, parseXlsBuffer } = await import("../lib/imoview/parse-xls");
  const { isKeniaCaptadoraRow } = await import("../lib/imoview/import-target");
  const { countProprietariosSemTelefone } = await import("../lib/imoview/parse-proprietario");

  const admin = createServiceRoleClient();
  const target = await resolveImportTarget(admin, targetId);
  const buffer = fs.readFileSync(XLS_PATH);

  console.log(`Destino: ${target.label}`);
  console.log(`Corretor: ${target.corretorId}`);
  console.log(`Captador: ${target.captadorPerfilId}`);

  const parsed = parseXlsBuffer(buffer, {
    filename: path.basename(XLS_PATH),
    exportYear: 2026,
  });

  const keniaRows = parsed.rows.filter(isKeniaCaptadoraRow);
  const keniaDesativados = keniaRows.filter((r) => String(r.Situacao ?? "").trim() === "Desativado");
  const migratable = filterMigratableRows(parsed.rows, {
    excludedCodigos: target.excludedCodigos,
    rowFilter: target.rowFilter,
  });
  const semTelefone = countProprietariosSemTelefone(migratable);

  console.log("\n--- Planilha ---");
  console.log("Total linhas:", parsed.rows.length);
  if (target.id === "kenia") {
    console.log("Kenia captadora (total):", keniaRows.length);
    console.log("Kenia desativados (excluídos):", keniaDesativados.length);
  }
  console.log("A migrar:", migratable.length);
  console.log("Proprietários sem telefone:", semTelefone.count);

  if (analyzeOnly) {
    const analysis = await analyzeSpreadsheet(
      {
        buffer,
        filename: path.basename(XLS_PATH),
        exportYear: 2026,
        skipImobeeApi: !withPhotos,
      },
      target,
    );
    console.log("\n--- Fotos ---");
    console.log("Elegíveis:", analysis.photos.eligibleCount);
    console.log("Estimativa:", analysis.photos.estimatedLabel);
    return;
  }

  const rows = summarizeRowsForImport(
    parsed.rows,
    limit && limit > 0 ? limit : undefined,
    target,
  );

  console.log(`\nImportando ${rows.length} imóveis${withPhotos ? " com fotos" : " (sem fotos)"}…`);

  const summary = await importSpreadsheetRows(
    admin,
    rows,
    parsed.exportYear,
    target,
    undefined,
    { skipPhotos: !withPhotos },
  );

  console.log("\n--- Resultado ---");
  console.log("Importados:", summary.imported);
  console.log("Pulados:", summary.skipped);
  console.log("Erros:", summary.errors);
  console.log("Fotos baixadas:", summary.photosDownloaded);
  console.log("Fotos falha:", summary.photosFailed);
  console.log("Clientes criados:", summary.clientesCreated);
  console.log("Clientes reutilizados:", summary.clientesReused);
  console.log("Sem telefone:", summary.semTelefone.join(", ") || "(nenhum)");

  if (summary.errors > 0) {
    for (const r of summary.results.filter((x) => x.status === "error")) {
      console.log(`  ERRO ${r.codigo}: ${r.message}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
