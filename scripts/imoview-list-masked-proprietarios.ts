/**
 * Lista imóveis com telefone mascarado na planilha Imoview.
 * Uso: npx tsx scripts/imoview-list-masked-proprietarios.ts
 */
import fs from "node:fs";
import path from "node:path";

import { parseXlsBuffer, normalizeCodigo } from "../lib/imoview/parse-xls";
import {
  parseProprietario,
  normalizeTelefone,
  extractVisiblePhoneSuffix,
  isMaskedPhone,
} from "../lib/imoview/parse-proprietario";

const XLS_PATH = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

async function main() {
  const buf = fs.readFileSync(XLS_PATH);
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });

  const rows: {
    codigo: string;
    nome: string;
    telefoneMascarado: string;
    sufixo: string;
    cpf: string | null;
  }[] = [];

  for (const row of parsed.rows) {
    const codigo = normalizeCodigo(row.Codigo);
    if (!codigo) continue;

    const p = parseProprietario(row.Proprietarios);
    if (!p?.telefone) continue;

    const telefoneNorm = normalizeTelefone(p.telefone);
    if (telefoneNorm) continue;

    if (!isMaskedPhone(p.telefone)) continue;

    const sufixo = extractVisiblePhoneSuffix(p.telefone);
    if (!sufixo) continue;

    rows.push({
      codigo,
      nome: p.nome,
      telefoneMascarado: p.telefone.trim(),
      sufixo,
      cpf: p.cpf,
    });
  }

  rows.sort((a, b) => Number(a.codigo) - Number(b.codigo));

  console.log(`Total com telefone mascarado: ${rows.length}\n`);
  console.log("codigo\tnome\tsufixo\ttelefone_mascarado\tcpf");
  for (const r of rows) {
    console.log(
      `${r.codigo}\t${r.nome}\t${r.sufixo}\t${r.telefoneMascarado}\t${r.cpf ?? ""}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
