/**
 * Diagnóstico: colunas VARCHAR(20) em imoveis + campos dos códigos Em reforma.
 * Uso: npx tsx scripts/imoview-diagnose-varchar20.ts
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

const CODES = ["1129", "1131", "1711", "1995", "2112"];

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { mapRowToImovel } = await import("../lib/imoview/map-row-to-imovel");
  const { createDiagnosticMapContext } = await import("../lib/imoview/import-target");
  const mapContext = createDiagnosticMapContext();
  const { parseProprietario, normalizeTelefone } = await import("../lib/imoview/parse-proprietario");

  const admin = createServiceRoleClient();

  const { data: sample } = await admin.from("imoveis").select("status").limit(1);
  console.log("Amostra status existente no banco:", sample?.[0]?.status, sample?.[0]?.status?.length);

  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const byCodigo = new Map(parsed.rows.map((r) => [normalizeCodigo(r.Codigo), r]));

  console.log("\n=== Campos string >20 nos 5 códigos ===\n");

  for (const codigo of CODES) {
    const row = byCodigo.get(codigo);
    if (!row) continue;

    const { mapped } = mapRowToImovel(row, 2026, "diag-slug", mapContext);
    const parsedProp = parseProprietario(row.Proprietarios);
    const telefone = normalizeTelefone(parsedProp?.telefone ?? null);

    console.log(`--- ${codigo} (Situacao: ${row.Situacao}) ---`);

    for (const [k, v] of Object.entries(mapped)) {
      if (typeof v === "string" && v.length > 20) {
        console.log(`  imoveis.${k}: ${JSON.stringify(v)} (${v.length})`);
      }
    }

    if (telefone && telefone.length > 20) {
      console.log(`  clientes.telefone: ${telefone} (${telefone.length})`);
    }
    if (parsedProp?.cpf && parsedProp.cpf.length > 20) {
      console.log(`  clientes.cpf: ${parsedProp.cpf} (${parsedProp.cpf.length})`);
    }
  }

  // Test insert mínimo com status longo (rollback manual se criar)
  console.log("\n=== Teste insert status desativado_temporariamente ===");
  const { IMOVIEW_IMPORT_CORRETOR_ID, IMOVIEW_CAPTADOR_PRINCIPAL_ID } = await import(
    "../lib/imoview/constants"
  );

  const testPayload = {
    corretor_id: IMOVIEW_IMPORT_CORRETOR_ID,
    codigo: "9999999999",
    titulo: "Teste diag",
    slug: `diag-varchar-test-${Date.now()}`,
    tipo: "casa" as const,
    finalidade: "venda" as const,
    status: "desativado_temporariamente",
    status_imovel_id: "dd9caa14-43e7-495e-9612-6c6a9875b530",
    status_aprovacao: "aprovado" as const,
    logradouro: "Diag",
    numero: "0",
    bairro: "Diag",
    cidade: "Diag",
    estado: "MG",
    captador_id: IMOVIEW_CAPTADOR_PRINCIPAL_ID,
  };

  const { data: inserted, error: insertError } = await admin
    .from("imoveis")
    .insert(testPayload)
    .select("id, status")
    .single();

  if (insertError) {
    console.log("INSERT FALHOU:", insertError.message);
    console.log("Código PG:", insertError.code);
  } else {
    console.log("INSERT OK — status aceito:", inserted?.status);
    await admin.from("imoveis").delete().eq("id", inserted!.id);
    console.log("Registro de teste removido.");
  }

  console.log("\n=== Verifique no SQL Editor (mesmo projeto do .env.local) ===");
  console.log(`SELECT column_name, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'imoveis' AND column_name = 'status';`);
  console.log("Esperado após migration: character_maximum_length = 40");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
