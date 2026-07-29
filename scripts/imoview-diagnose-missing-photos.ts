/**
 * Diagnóstico: imóveis migrados sem fotos.
 * Uso: npx tsx scripts/imoview-diagnose-missing-photos.ts [codigos...]
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

async function main() {
  const codes = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_CODES;

  const { parseXlsBuffer, normalizeCodigo, isPhotoEligible, getRowSituacao, isSim } =
    await import("../lib/imoview/parse-xls");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const { fetchImobeeMetadata } = await import("../lib/imoview/fetch-imobee-metadata");

  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const byCodigo = new Map(parsed.rows.map((r) => [normalizeCodigo(r.Codigo), r]));

  const admin = createServiceRoleClient();

  const summary: Record<string, number> = {
    not_in_spreadsheet: 0,
    not_photo_eligible: 0,
    photo_eligible: 0,
    not_in_db: 0,
    in_db_no_photos: 0,
    in_db_with_photos: 0,
    imobee_no_metadata: 0,
    imobee_zero_fotos: 0,
    imobee_has_fotos: 0,
  };

  console.log("\n=== Diagnóstico fotos ausentes ===\n");
  console.log(
    "codigo | planilha (Situacao/ExibirMeuSite/elegivel) | DB (fotos/publicado) | Imobee (fotos) | causa provável",
  );
  console.log("-".repeat(120));

  for (const codigo of codes) {
    const row = byCodigo.get(codigo);
    if (!row) {
      summary.not_in_spreadsheet += 1;
      console.log(`${codigo} | NÃO NA PLANILHA | — | — | fora da planilha`);
      continue;
    }

    const elegivel = isPhotoEligible(row);
    if (elegivel) summary.photo_eligible += 1;
    else summary.not_photo_eligible += 1;

    const planilha = `${getRowSituacao(row)} / Exibir=${row.ExibirMeuSite ?? ""} / elegivel=${elegivel}`;

    const { data: imovel } = await admin
      .from("imoveis")
      .select("id, publicado_site, titulo")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .eq("codigo", codigo)
      .maybeSingle();

    if (!imovel) {
      summary.not_in_db += 1;
      console.log(`${codigo} | ${planilha} | NÃO NO BANCO | — | não migrado`);
      continue;
    }

    const { count: fotoCount } = await admin
      .from("imovel_fotos")
      .select("id", { count: "exact", head: true })
      .eq("imovel_id", imovel.id);

    const fotos = fotoCount ?? 0;
    if (fotos > 0) {
      summary.in_db_with_photos += 1;
    } else {
      summary.in_db_no_photos += 1;
    }

    let imobeeFotos = "—";
    let causa = "";

    if (!elegivel) {
      causa = "filtro isPhotoEligible (precisa Vago/Disponível + ExibirMeuSite=Sim)";
    } else {
      try {
        const meta = await fetchImobeeMetadata(codigo);
        if (!meta) {
          summary.imobee_no_metadata += 1;
          imobeeFotos = "sem metadata";
          causa = "Imobee sem metadados na importação";
        } else {
          imobeeFotos = String(meta.fotos.length);
          if (meta.fotos.length === 0) {
            summary.imobee_zero_fotos += 1;
            causa = "Imobee retorna 0 fotos";
          } else {
            summary.imobee_has_fotos += 1;
            causa = fotos === 0
              ? "elegível + Imobee tem fotos → provável import SEM --photos ou skipped na re-run"
              : "ok";
          }
        }
      } catch (err) {
        imobeeFotos = "erro fetch";
        causa = err instanceof Error ? err.message : "erro Imobee";
      }
    }

    console.log(
      `${codigo} | ${planilha} | fotos=${fotos} pub=${imovel.publicado_site} | Imobee=${imobeeFotos} | ${causa}`,
    );
  }

  console.log("\n=== Resumo ===");
  for (const [k, v] of Object.entries(summary)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
