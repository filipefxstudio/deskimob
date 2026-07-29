/**
 * Atualiza Situação e ExibirMeuSite na planilha Imoview para códigos informados.
 *
 * Uso:
 *   npx tsx scripts/imoview-update-planilha-codigo.ts 1997
 *   npx tsx scripts/imoview-update-planilha-codigo.ts 1997 2000 2001
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const XLS_PATH = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

const SITUACAO_ATIVA = "Vago/Disponível";
const EXIBIR_MEU_SITE = "Sim";

function normalizeCodigo(value: unknown): string {
  return String(value ?? "").trim();
}

function main() {
  const codigos = process.argv.slice(2).filter(Boolean);
  if (codigos.length === 0) {
    console.error("Informe ao menos um código. Ex.: npx tsx scripts/imoview-update-planilha-codigo.ts 1997");
    process.exit(1);
  }

  const codigoSet = new Set(codigos);
  const wb = XLSX.read(fs.readFileSync(XLS_PATH), { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0]!;
  const ws = wb.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  let updated = 0;
  for (const row of rows) {
    const codigo = normalizeCodigo(row.Codigo);
    if (!codigoSet.has(codigo)) continue;

    const situacaoAntes = String(row.Situacao ?? "");
    const exibirAntes = String(row.ExibirMeuSite ?? "");

    row.Situacao = SITUACAO_ATIVA;
    row.ExibirMeuSite = EXIBIR_MEU_SITE;

    console.log(`${codigo}:`);
    console.log(`  Situacao: "${situacaoAntes}" → ${SITUACAO_ATIVA}`);
    console.log(`  ExibirMeuSite: "${exibirAntes}" → ${EXIBIR_MEU_SITE}`);
    updated += 1;
  }

  const missing = codigos.filter(
    (codigo) => !rows.some((row) => normalizeCodigo(row.Codigo) === codigo),
  );

  if (missing.length > 0) {
    console.error("\nCódigos não encontrados na planilha:", missing.join(", "));
  }

  if (updated === 0) {
    process.exit(1);
  }

  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
  XLSX.writeFile(wb, XLS_PATH);
  console.log(`\n${updated} linha(s) atualizada(s) em ${XLS_PATH}`);
}

main();
