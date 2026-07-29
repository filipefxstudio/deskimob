import fs from "node:fs";
import * as XLSX from "xlsx";

const wb = XLSX.read(
  fs.readFileSync("data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  { type: "buffer" },
);
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, {
  defval: "",
});

const patterns = new Map<string, number>();
for (const r of rows) {
  const comp = String(r.Complemento ?? "").trim();
  if (!comp) continue;
  const tipo = String(r.Tipo ?? "").trim();
  const key = `${tipo} :: ${comp.slice(0, 40)}`;
  patterns.set(key, (patterns.get(key) ?? 0) + 1);
}

const sorted = [...patterns.entries()].sort((a, b) => b[1] - a[1]);
console.log("Top 40 padrões Complemento por Tipo:");
for (const [k, n] of sorted.slice(0, 40)) {
  console.log(`${n}x  ${k}`);
}
