/**
 * Corrige criado_em / atualizado_em de imóveis já importados usando a planilha XLS.
 * Uso: npx tsx scripts/imoview-backfill-datas.ts
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

const xlsPath = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

async function main() {
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { parseDataBr } = await import("../lib/imoview/parse-data-br");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");

  const buffer = fs.readFileSync(xlsPath);
  const { rows } = parseXlsBuffer(buffer, {
    filename: path.basename(xlsPath),
    exportYear: 2026,
  });

  const admin = createServiceRoleClient();
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const row of rows) {
    const codigo = normalizeCodigo(row.Codigo);
    if (!codigo) continue;

    const criadoEm = parseDataBr(row.DataCadastro);
    if (!criadoEm) {
      skipped += 1;
      continue;
    }

    const atualizadoEm = parseDataBr(row.DataHoraUltimaAlteracao) ?? criadoEm;

    const { data, error } = await admin
      .from("imoveis")
      .update({
        criado_em: criadoEm,
        atualizado_em: atualizadoEm,
        data_ativacao: criadoEm,
        data_ultima_atualizacao: parseDataBr(row.DataHoraUltimaAlteracao),
      })
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .eq("codigo", codigo)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(`Erro código ${codigo}:`, error.message);
      continue;
    }

    if (data?.id) {
      updated += 1;
    } else {
      notFound += 1;
    }
  }

  console.log(`Atualizados: ${updated}`);
  console.log(`Sem data na planilha: ${skipped}`);
  console.log(`Não encontrados no banco: ${notFound}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
