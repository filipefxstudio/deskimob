/**
 * Uso: npx tsx scripts/imoview-check-endereco-duplicata.ts 1774 1775
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

const codigos = process.argv.slice(2);
if (codigos.length === 0) codigos.push("1774", "1775");

async function main() {
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { mapRowToImovel } = await import("../lib/imoview/map-row-to-imovel");
  const { createDiagnosticMapContext } = await import("../lib/imoview/import-target");
  const mapContext = createDiagnosticMapContext();
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");

  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const byCodigo = new Map(parsed.rows.map((r) => [normalizeCodigo(r.Codigo), r]));

  const admin = createServiceRoleClient();

  console.log("\n=== Planilha + chave única (logradouro + numero + complemento_valor) ===\n");

  for (const codigo of codigos) {
    const row = byCodigo.get(codigo);
    if (!row) {
      console.log(`${codigo}: não na planilha`);
      continue;
    }

    const { mapped } = mapRowToImovel(row, 2026, "temp", mapContext);
    const log = String(row.Endereco ?? "").trim();
    const num = String(row.EnderecoNumero ?? "").trim() || "S/N";
    const comp = String(row.Complemento ?? "").trim();
    const key = `${log.toLowerCase()}|${num.toLowerCase()}|${comp.toLowerCase()}`;

    console.log(`--- ${codigo} ---`);
    console.log(`  Endereco: ${log}`);
    console.log(`  Numero: ${num}`);
    console.log(`  Complemento (bruto): ${JSON.stringify(row.Complemento)}`);
    console.log(`  complemento_valor (mapeado): ${JSON.stringify(mapped.complemento_valor)}`);
    console.log(`  Bairro: ${row.Bairro}`);
    console.log(`  Tipo: ${row.Tipo} | Situacao: ${row.Situacao}`);
    console.log(`  Chave única: ${key}`);

    const { data: imovel } = await admin
      .from("imoveis")
      .select("id, codigo, logradouro, numero, complemento, complemento_valor, bairro, titulo, criado_em")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .eq("codigo", codigo)
      .maybeSingle();

    if (imovel) {
      const dbComp = (imovel.complemento_valor ?? imovel.complemento ?? "").trim();
      const dbKey = `${imovel.logradouro.trim().toLowerCase()}|${imovel.numero.trim().toLowerCase()}|${dbComp.toLowerCase()}`;
      console.log(`  DB: log=${imovel.logradouro}, num=${imovel.numero}, comp=${JSON.stringify(dbComp)}`);
      console.log(`  DB chave: ${dbKey}`);
      console.log(`  DB criado_em: ${imovel.criado_em}`);
    } else {
      console.log("  DB: não encontrado");
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
