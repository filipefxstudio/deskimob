/**
 * Atualiza nomes e telefones de proprietários na planilha Imoview.
 * Uso: npx tsx scripts/imoview-update-proprietarios-planilha.ts
 */
import fs from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import { parseProprietario } from "../lib/imoview/parse-proprietario";

const XLS_PATH = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

/** codigo -> { nome, telefone } */
const UPDATES: Record<string, { nome: string; telefone: string }> = {
  "1619": { nome: "Nem Construtor", telefone: "(31) 98671-0354" },
  "1620": { nome: "Nem Construtor", telefone: "(31) 98671-0354" },
  "1650": { nome: "Bolinha Martins Oliveira Construtora", telefone: "(31) 99627-8399" },
  "1696": { nome: "Gerson", telefone: "(31) 98803-3815" },
  "1705": { nome: "Geraldo", telefone: "(31) 99420-4927" },
  "1709": { nome: "André Pinheiro - Nossa Casa", telefone: "(31) 98888-1297" },
  "1712": { nome: "Jorge", telefone: "(31) 98729-5081" },
  "1713": { nome: "Leandro Construtora Mais", telefone: "(31) 98793-1731" },
  "1727": { nome: "Wanderson", telefone: "(31) 98989-0053" },
  "1761": { nome: "André Pinheiro - Nossa Casa", telefone: "(31) 98888-1297" },
  /** Usuário digitou 1727 por engano — código correto é 1786. */
  "1786": { nome: "Leandro Construtora Mais", telefone: "(31) 98793-1731" },
  "1814": { nome: "Ana Paula Fahel Construtora", telefone: "(31) 99941-9749" },
  "1851": { nome: "Medeiros", telefone: "(31) 99992-8779" },
  "1870": { nome: "Tiago", telefone: "(31) 98819-8860" },
  "1934": { nome: "Leandro Construtora Mais", telefone: "(31) 98793-1731" },
  "1939": { nome: "Viana", telefone: "(31) 98236-1483" },
  "1979": { nome: "Fabricio Construtora Alcer", telefone: "(31) 98765-7898" },
  "2006": { nome: "Delvair", telefone: "(31) 98831-1203" },
  "2025": { nome: "Narcelo", telefone: "(31) 98694-9431" },
  "2033": { nome: "Construtora Valem", telefone: "(31) 99961-9793" },
  "2036": { nome: "Tharle", telefone: "(31) 99304-1764" },
  "2040": { nome: "Adm Construtora", telefone: "(31) 98533-2402" },
  "2042": { nome: "Adm Construtora", telefone: "(31) 98533-2402" },
  "2048": { nome: "Medeiros", telefone: "(31) 99992-8779" },
  "2090": { nome: "Gilson", telefone: "(31) 99128-5796" },
  "2094": { nome: "Gilson", telefone: "(31) 99128-5796" },
  "2103": { nome: "Bolinha Martins Oliveira Construtora", telefone: "(31) 99627-8399" },
  "2141": { nome: "Rubia Melo Prado", telefone: "(31) 98798-0671" },
  "2157": { nome: "Christiano", telefone: "(31) 99655-6581" },
  "2159": { nome: "Thiago Leonel THC Engenharia", telefone: "(31) 99135-6165" },
  "2166": { nome: "Medeiros", telefone: "(31) 99992-8779" },
  "2167": { nome: "Medeiros", telefone: "(31) 99992-8779" },
  "2174": { nome: "Ana Paula Fahel Construtora", telefone: "(31) 99941-9749" },
  "2176": { nome: "Anderson", telefone: "(31) 98719-1904" },
  "2177": { nome: "Anderson", telefone: "(31) 98719-1904" },
  "2184": { nome: "Gilberto Avante Construtora", telefone: "(31) 99131-2429" },
  "2185": { nome: "Rubia Melo Prado", telefone: "(31) 98798-0671" },
  "2188": { nome: "Medeiros", telefone: "(31) 99992-8779" },
  "2209": { nome: "Medeiros", telefone: "(31) 99992-8779" },
};

function buildProprietariosField(
  nome: string,
  telefone: string,
  existingRaw: string | undefined,
): string {
  const parsed = parseProprietario(existingRaw);
  const parts = [nome, telefone];

  if (parsed?.cpf) {
    parts.splice(1, 0, `CPF: ${parsed.cpf}`);
  }

  if (parsed?.email) {
    parts.push(parsed.email);
  }

  return parts.join(" | ");
}

function main() {
  const wb = XLSX.read(fs.readFileSync(XLS_PATH), { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0]!;
  const ws = wb.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  let updated = 0;
  const notFound: string[] = [];

  for (const row of rows) {
    const codigo = String(row.Codigo ?? "").trim();
    const update = UPDATES[codigo];
    if (!update) continue;

    const before = String(row.Proprietarios ?? "");
    const after = buildProprietariosField(update.nome, update.telefone, before);

    if (before === after) {
      console.log(`${codigo}: já atualizado`);
      continue;
    }

    row.Proprietarios = after;
    console.log(`${codigo}:`);
    console.log(`  antes: ${before}`);
    console.log(`  depois: ${after}`);
    updated += 1;
  }

  for (const codigo of Object.keys(UPDATES)) {
    const found = rows.some((r) => String(r.Codigo ?? "").trim() === codigo);
    if (!found) notFound.push(codigo);
  }

  if (notFound.length) {
    console.warn("\nCódigos não encontrados na planilha:", notFound.join(", "));
  }

  if (updated === 0) {
    console.log("\nNenhuma linha alterada.");
    return;
  }

  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
  XLSX.writeFile(wb, XLS_PATH);
  console.log(`\n${updated} linha(s) atualizada(s) em ${XLS_PATH}`);
}

main();
