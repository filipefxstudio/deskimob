/**
 * Migração completa Kenia — fotos primeiro, depois o restante.
 * Uso: npx tsx scripts/imoview-import-kenia-full.ts
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

async function runPhase(
  label: string,
  rows: import("@/lib/imoview/types").XlsRow[],
  exportYear: number,
  withPhotos: boolean,
) {
  const { importSpreadsheetRows } = await import("../lib/imoview/import-single-imovel");
  const { buildKeniaImportTarget } = await import("../lib/imoview/import-target");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");

  const admin = createServiceRoleClient();
  const target = await buildKeniaImportTarget(admin);

  console.log(`\n========== ${label} (${rows.length} imóveis) ==========`);

  const summary = await importSpreadsheetRows(
    admin,
    rows,
    exportYear,
    target,
    undefined,
    { skipPhotos: !withPhotos },
  );

  console.log(`Importados: ${summary.imported}`);
  console.log(`Pulados: ${summary.skipped}`);
  console.log(`Erros: ${summary.errors}`);
  console.log(`Fotos baixadas: ${summary.photosDownloaded}`);
  console.log(`Fotos falha: ${summary.photosFailed}`);
  console.log(`Clientes criados: ${summary.clientesCreated}`);
  console.log(`Sem telefone: ${summary.semTelefone.join(", ") || "(nenhum)"}`);

  if (summary.errors > 0) {
    for (const r of summary.results.filter((x) => x.status === "error")) {
      console.error(`  ERRO ${r.codigo}: ${r.message}`);
    }
  }

  return summary;
}

async function main() {
  const { filterMigratableRows, parseXlsBuffer, isPhotoEligible } = await import(
    "../lib/imoview/parse-xls"
  );
  const { isKeniaCaptadoraRow, buildKeniaImportTarget } = await import(
    "../lib/imoview/import-target"
  );
  const { createServiceRoleClient } = await import("../lib/supabase/admin");

  const buffer = fs.readFileSync(XLS_PATH);
  const parsed = parseXlsBuffer(buffer, {
    filename: path.basename(XLS_PATH),
    exportYear: 2026,
  });

  const admin = createServiceRoleClient();
  const target = await buildKeniaImportTarget(admin);

  const allRows = filterMigratableRows(parsed.rows, {
    excludedCodigos: target.excludedCodigos,
    rowFilter: isKeniaCaptadoraRow,
  });

  const withPhotosRows = allRows.filter(isPhotoEligible);
  const restRows = allRows.filter((row) => !isPhotoEligible(row));

  console.log("Total a migrar:", allRows.length);
  console.log("Fase 1 (com fotos):", withPhotosRows.length);
  console.log("Fase 2 (restante):", restRows.length);

  const phase1 = await runPhase("FASE 1 — com fotos", withPhotosRows, parsed.exportYear, true);
  const phase2 = await runPhase("FASE 2 — restante", restRows, parsed.exportYear, false);

  const { count } = await admin
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", target.corretorId);

  console.log("\n========== RESUMO FINAL ==========");
  console.log("Fase 1 importados:", phase1.imported, "| erros:", phase1.errors);
  console.log("Fase 2 importados:", phase2.imported, "| erros:", phase2.errors);
  console.log("Total imóveis na conta Kenia:", count ?? "?");

  if (phase1.errors + phase2.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
