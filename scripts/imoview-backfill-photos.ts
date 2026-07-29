/**
 * Backfill: fotos + enriquecimento Imobee para imóveis já importados sem fotos.
 * Uso:
 *   npx tsx scripts/imoview-backfill-photos.ts 848 919 ...
 *   npx tsx scripts/imoview-backfill-photos.ts --all-eligible
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

const DEFAULT_CODES = [
  "3333", "3283", "3269", "3257", "3244", "2227", "2127", "2104", "2096", "2082",
  "2077", "2059", "2016", "2002", "2001", "1943", "1932", "1934", "1911", "1909",
  "1903", "1899", "1898", "1893", "1891", "1864", "1800", "848", "919", "920",
  "1110", "1113", "1112", "1212",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const allEligible = args.includes("--all-eligible");
  const codigos = allEligible
    ? []
    : args.filter((a) => a !== "--all-eligible").length > 0
      ? args.filter((a) => a !== "--all-eligible")
      : DEFAULT_CODES;

  const { IMOBEE_RATE_LIMIT_MS, IMOVIEW_IMPORT_CORRETOR_ID } = await import(
    "../lib/imoview/constants"
  );
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { enrichImovelWithPhotos } = await import("../lib/imoview/enrich-from-imobee");
  const { imovelHasPhotos } = await import("../lib/imoview/import-photos");
  const {
    parseXlsBuffer,
    normalizeCodigo,
    isPhotoEligible,
    filterMigratableRows,
  } = await import("../lib/imoview/parse-xls");

  const admin = createServiceRoleClient();

  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const rowByCodigo = new Map(
    filterMigratableRows(parsed.rows).map((r) => [normalizeCodigo(r.Codigo), r]),
  );

  let targets: string[];

  if (allEligible) {
    const { data: imoveis } = await admin
      .from("imoveis")
      .select("id, codigo, cidade")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .not("codigo", "is", null);

    targets = [];
    for (const imovel of imoveis ?? []) {
      const codigo = String(imovel.codigo ?? "").trim();
      if (!codigo) continue;
      const row = rowByCodigo.get(codigo);
      if (!row || !isPhotoEligible(row)) continue;
      if (await imovelHasPhotos(admin, imovel.id)) continue;
      targets.push(codigo);
    }
    targets.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  } else {
    targets = codigos;
  }

  console.log(`Backfill de fotos: ${targets.length} imóvel(is)\n`);

  let ok = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const codigo = targets[i];
    const row = rowByCodigo.get(codigo);

    if (!row) {
      console.log(`  ${codigo}: skip — não está na planilha migrável`);
      skipped += 1;
      continue;
    }

    if (!isPhotoEligible(row)) {
      console.log(
        `  ${codigo}: skip — não elegível (Situacao=${row.Situacao}, ExibirMeuSite=${row.ExibirMeuSite})`,
      );
      skipped += 1;
      continue;
    }

    const { data: imovel, error: findError } = await admin
      .from("imoveis")
      .select("id, cidade, corretor_id")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .eq("codigo", codigo)
      .maybeSingle();

    if (findError || !imovel) {
      console.log(`  ${codigo}: skip — não encontrado no banco`);
      skipped += 1;
      continue;
    }

    if (await imovelHasPhotos(admin, imovel.id)) {
      console.log(`  ${codigo}: skip — já tem fotos`);
      skipped += 1;
      continue;
    }

    try {
      console.log(`  ${codigo}: enriquecendo… (${i + 1}/${targets.length})`);
      const result = await enrichImovelWithPhotos(
        admin,
        imovel.id,
        codigo,
        imovel.cidade ?? String(row.Cidade ?? ""),
        imovel.corretor_id,
      );

      const parts = [
        `${result.photosDownloaded} foto(s)`,
        result.photosFailed > 0 ? `${result.photosFailed} falha(s)` : null,
        result.tituloAtualizado ? "título ok" : null,
        result.warning ?? null,
      ].filter(Boolean);

      console.log(`  ${codigo}: ok — ${parts.join("; ")}`);
      ok += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${codigo}: ERRO — ${msg}`);
      errors += 1;
    }

    if (i < targets.length - 1) {
      await sleep(IMOBEE_RATE_LIMIT_MS);
    }
  }

  console.log(`\n--- Resultado ---`);
  console.log(`OK: ${ok}`);
  console.log(`Pulados: ${skipped}`);
  console.log(`Erros: ${errors}`);

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
