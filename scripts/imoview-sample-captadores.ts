import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const xlsPath = path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx");
const wb = XLSX.read(fs.readFileSync(xlsPath), { type: "buffer", cellDates: true });
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, {
  defval: "",
});

const samples = new Map<string, number>();
for (const row of rows) {
  const c = String(row.Captadores ?? "").trim();
  if (!c) continue;
  samples.set(c, (samples.get(c) ?? 0) + 1);
}

console.log("Unique captadores strings:", samples.size);
[...samples.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(v, JSON.stringify(k)));
