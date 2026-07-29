/**
 * Importa um imóvel da planilha Imoview por código em uma ou mais contas.
 *
 * Uso:
 *   npx tsx scripts/imoview-import-codigo.ts 1997 imobee --photos
 *   npx tsx scripts/imoview-import-codigo.ts 1997 kenia --photos
 *   npx tsx scripts/imoview-import-codigo.ts 1997 imobee kenia --photos
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
  const withPhotos = args.includes("--photos");
  const codigoArg = args.find((arg) => !arg.startsWith("--") && /^\d+$/.test(arg));
  const targetIds = args.filter(
    (arg) => !arg.startsWith("--") && arg !== codigoArg,
  ) as ("imobee" | "kenia")[];

  if (!codigoArg) {
    console.error("Informe o código do imóvel. Ex.: npx tsx scripts/imoview-import-codigo.ts 1997 imobee kenia --photos");
    process.exit(1);
  }

  const targets = targetIds.length > 0 ? targetIds : (["imobee", "kenia"] as const);

  const { normalizeCodigo, parseXlsBuffer } = await import("../lib/imoview/parse-xls");
  const { importSingleImovel } = await import("../lib/imoview/import-single-imovel");
  const { resolveImportTarget } = await import("../lib/imoview/import-target");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");

  const buffer = fs.readFileSync(XLS_PATH);
  const parsed = parseXlsBuffer(buffer, {
    filename: path.basename(XLS_PATH),
    exportYear: 2026,
  });

  const row = parsed.rows.find((item) => normalizeCodigo(item.Codigo) === codigoArg);
  if (!row) {
    console.error(`Código ${codigoArg} não encontrado na planilha.`);
    process.exit(1);
  }

  console.log(`Planilha — código ${codigoArg}:`);
  console.log(`  Situação: ${row.Situacao}`);
  console.log(`  ExibirMeuSite: ${row.ExibirMeuSite}`);
  console.log(`  Captadores: ${row.Captadores}`);
  console.log(`  Cidade/Bairro: ${row.Cidade} / ${row.Bairro}`);

  const admin = createServiceRoleClient();

  for (const targetId of targets) {
    console.log(`\n=== Importando em ${targetId} ===`);
    const target = await resolveImportTarget(admin, targetId);
    const result = await importSingleImovel(admin, row, parsed.exportYear, target, {
      skipPhotos: !withPhotos,
    });

    console.log(`Status: ${result.status}`);
    if (result.message) console.log(`Mensagem: ${result.message}`);
    if (result.imovelId) console.log(`Imóvel ID: ${result.imovelId}`);
    if (result.photosDownloaded != null) {
      console.log(`Fotos: ${result.photosDownloaded} ok, ${result.photosFailed ?? 0} falha`);
    }

    if (result.status === "error") {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
