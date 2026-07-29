import fs from "node:fs";
import * as XLSX from "xlsx";

const wb = XLSX.read(
  fs.readFileSync("data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  { type: "buffer" },
);
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!, {
  defval: "",
});

const samples = [
  { codigo: "13", label: "Bl no complemento" },
  { codigo: "1886", label: "Bloco coluna" },
  { codigo: "2161", label: "collision" },
  { codigo: "2158", label: "collision" },
];

for (const { codigo, label } of samples) {
  const row = rows.find((r) => String(r.Codigo).trim() === codigo);
  console.log(`\n${label} — ${codigo}:`, {
    Complemento: row?.Complemento,
    Bloco: row?.Bloco,
    Tipo: row?.Tipo,
    Endereco: row?.Endereco,
    Numero: row?.EnderecoNumero,
  });
}

const withBlInComp = rows.filter((r) => /\bbl\.?\s*\d+/i.test(String(r.Complemento ?? "")));
const withBlocoCol = rows.filter((r) => String(r.Bloco ?? "").trim());
console.log(`\nCom 'Bl' no Complemento: ${withBlInComp.length}`);
console.log(`Com coluna Bloco preenchida: ${withBlocoCol.length}`);

console.log("\nAmostra Bl no Complemento:");
for (const r of withBlInComp.slice(0, 8)) {
  console.log(`  ${r.Codigo}: ${r.Complemento}`);
}
console.log("\nAmostra coluna Bloco:");
for (const r of withBlocoCol.slice(0, 8)) {
  console.log(`  ${r.Codigo}: Bloco=${r.Bloco} Complemento=${r.Complemento}`);
}
