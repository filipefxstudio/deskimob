/**
 * Define ExibirMeuSite = Sim na planilha para códigos informados.
 * Uso: npx tsx scripts/imoview-fix-exibir-meusite.ts
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const GROUP_A_CODES = [
  "3333", "3283", "3269", "3257", "3244", "2227", "2096", "2002", "1911", "1864",
  "1800", "919", "920", "1110", "1113", "1112", "1212",
];

const xlsPath = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

const wb = XLSX.read(fs.readFileSync(xlsPath), { type: "buffer", cellDates: true });
const sheetName = wb.SheetNames[0]!;
const ws = wb.Sheets[sheetName]!;
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

let updated = 0;
for (const row of rows) {
  const codigo = String(row.Codigo ?? "").trim();
  if (!GROUP_A_CODES.includes(codigo)) continue;

  const before = String(row.ExibirMeuSite ?? "");
  row.ExibirMeuSite = "Sim";
  console.log(`${codigo}: ExibirMeuSite "${before}" → Sim`);
  updated += 1;
}

if (updated === 0) {
  console.error("Nenhum código encontrado.");
  process.exit(1);
}

wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
XLSX.writeFile(wb, xlsPath);
console.log(`\n${updated} linha(s) atualizada(s).`);
