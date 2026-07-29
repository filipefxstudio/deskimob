/**
 * Lista imóveis migrados sem cliente_id e cruza com a planilha Imoview.
 * Uso: npx tsx scripts/imoview-check-proprietarios.ts
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

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { parseProprietario, normalizeTelefone } = await import("../lib/imoview/parse-proprietario");

  const admin = createServiceRoleClient();
  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const rowByCodigo = new Map(parsed.rows.map((r) => [normalizeCodigo(r.Codigo), r]));

  const { data: imoveis, error } = await admin
    .from("imoveis")
    .select("id, codigo, cliente_id")
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .not("codigo", "is", null);

  if (error) throw error;

  const semCliente = (imoveis ?? []).filter((i) => !i.cliente_id);
  console.log(`Total imóveis: ${imoveis?.length ?? 0}`);
  console.log(`Sem cliente_id: ${semCliente.length}`);

  const fixable: string[] = [];
  const semTelefone: { codigo: string; raw: string; nome: string }[] = [];
  const semPlanilha: string[] = [];

  for (const im of semCliente) {
    const codigo = String(im.codigo ?? "").trim();
    const row = rowByCodigo.get(codigo);
    const parsedP = parseProprietario(row?.Proprietarios);

    if (!parsedP) {
      semPlanilha.push(codigo);
      continue;
    }

    if (!normalizeTelefone(parsedP.telefone)) {
      semTelefone.push({
        codigo,
        raw: String(row?.Proprietarios ?? ""),
        nome: parsedP.nome,
      });
      continue;
    }

    fixable.push(codigo);
  }

  console.log(`\nCorrigíveis (telefone na planilha): ${fixable.length}`);
  if (fixable.length) console.log(fixable.join(", "));

  console.log(`\nSem telefone na planilha: ${semTelefone.length}`);
  for (const item of semTelefone) {
    console.log(`  ${item.codigo}: ${item.nome} | ${item.raw}`);
  }

  console.log(`\nSem proprietário na planilha: ${semPlanilha.length}`);
  if (semPlanilha.length) console.log(semPlanilha.join(", "));

  const row2157 = rowByCodigo.get("2157");
  console.log("\n--- 2157 ---");
  console.log("Raw:", row2157?.Proprietarios);
  console.log("Parsed:", parseProprietario(row2157?.Proprietarios));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
