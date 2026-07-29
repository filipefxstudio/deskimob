/**
 * Vincula proprietários nos imóveis já importados (cliente_id null).
 * Uso: npx tsx scripts/imoview-backfill-proprietarios.ts
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

const TARGET_CODIGOS = [
  "1619", "1620", "1650", "1696", "1705", "1709", "1712", "1713", "1727", "1761",
  "1786", "1814", "1851", "1870", "1934", "1939", "1979", "2006", "2025", "2033",
  "2036", "2040", "2042", "2048", "2090", "2094", "2103", "2141", "2157", "2159",
  "2166", "2167", "2174", "2176", "2177", "2184", "2185", "2188", "2209",
];

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { findOrCreateCliente } = await import("../lib/imoview/dedupe-clientes");

  const admin = createServiceRoleClient();
  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const rowByCodigo = new Map(
    parsed.rows.map((r) => [normalizeCodigo(r.Codigo), r]),
  );

  let linked = 0;
  let skipped = 0;
  let errors = 0;
  const stillMissing: string[] = [];

  for (const codigo of TARGET_CODIGOS) {
    const row = rowByCodigo.get(codigo);
    if (!row) {
      console.warn(`${codigo}: linha não encontrada na planilha`);
      errors += 1;
      continue;
    }

    const { data: imovel, error: findError } = await admin
      .from("imoveis")
      .select("id, codigo, cliente_id")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .eq("codigo", codigo)
      .maybeSingle();

    if (findError) {
      console.error(`${codigo}: erro ao buscar imóvel — ${findError.message}`);
      errors += 1;
      continue;
    }

    if (!imovel) {
      console.warn(`${codigo}: imóvel não encontrado no banco`);
      errors += 1;
      continue;
    }

    if (imovel.cliente_id) {
      console.log(`${codigo}: já possui cliente_id — ignorado`);
      skipped += 1;
      continue;
    }

    const clienteResult = await findOrCreateCliente(
      admin,
      row.Proprietarios,
      IMOVIEW_IMPORT_CORRETOR_ID,
    );
    if (!clienteResult.clienteId) {
      console.error(`${codigo}: não foi possível resolver proprietário — ${row.Proprietarios}`);
      stillMissing.push(codigo);
      errors += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from("imoveis")
      .update({ cliente_id: clienteResult.clienteId })
      .eq("id", imovel.id);

    if (updateError) {
      console.error(`${codigo}: erro ao atualizar — ${updateError.message}`);
      errors += 1;
      continue;
    }

    const action = clienteResult.created
      ? "cliente criado"
      : clienteResult.reused
        ? "cliente reutilizado"
        : "cliente vinculado";

    console.log(`${codigo}: ${action} → ${clienteResult.clienteId}`);
    linked += 1;
  }

  console.log(`\nResumo: ${linked} vinculados, ${skipped} já tinham proprietário, ${errors} erros`);
  if (stillMissing.length) {
    console.log("Sem proprietário:", stillMissing.join(", "));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
