/**
 * Uso: npx tsx scripts/imoview-check-collision.ts 2161 2158
 */
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

loadEnv();

const codigos = process.argv.slice(2).length ? process.argv.slice(2) : ["2161", "2158"];

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { mapRowToImovel } = await import("../lib/imoview/map-row-to-imovel");
  const { mapComplementoFromImoview } = await import("../lib/imoview/map-complemento");
  const { mapTipoImoview } = await import("../lib/imoview/normalize-enums");

  const admin = createServiceRoleClient();
  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const byCodigo = new Map(parsed.rows.map((r) => [normalizeCodigo(r.Codigo), r]));

  for (const codigo of codigos) {
    const row = byCodigo.get(codigo);
    console.log(`\n=== ${codigo} ===`);
    if (row) {
      console.log("Planilha:", {
        Endereco: row.Endereco,
        Numero: row.EnderecoNumero,
        Complemento: row.Complemento,
        Bloco: (row as Record<string, unknown>).Bloco,
        Tipo: row.Tipo,
      });
      const { tipo } = mapTipoImoview(row.Tipo);
      const blocoCol = String((row as Record<string, unknown>).Bloco ?? "").trim();
      const mapped = mapComplementoFromImoview(String(row.Complemento ?? ""), tipo, blocoCol || null);
      console.log("Mapeado (novo):", mapped);
    }

    const { data: imovel } = await admin
      .from("imoveis")
      .select("*")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .eq("codigo", codigo)
      .maybeSingle();

    if (!imovel) {
      console.log("DB: não encontrado");
      continue;
    }

    console.log("DB atual:", {
      logradouro: imovel.logradouro,
      numero: imovel.numero,
      complemento_valor: imovel.complemento_valor,
      complemento_tipo: imovel.complemento_tipo,
      complemento_numero: imovel.complemento_numero,
      complemento_torre: imovel.complemento_torre,
    });

    const compKey = (imovel.complemento_valor ?? "").trim().toLowerCase();
    const { data: conflicts } = await admin
      .from("imoveis")
      .select("codigo, titulo, logradouro, numero, complemento_valor, complemento_torre, bairro")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .ilike("logradouro", imovel.logradouro)
      .ilike("numero", imovel.numero)
      .neq("id", imovel.id);

    const matching = (conflicts ?? []).filter((c) => {
      const cComp = (c.complemento_valor ?? "").trim().toLowerCase();
      return cComp === compKey;
    });

    console.log("Conflito(s) endereco_unique (mesmo complemento_valor):");
    for (const c of matching) {
      console.log(`  → codigo ${c.codigo} — ${c.titulo?.slice(0, 60)} (comp=${c.complemento_valor}, torre=${c.complemento_torre})`);
    }
    if (matching.length === 0 && conflicts?.length) {
      console.log("  Mesmo log+num, complemento diferente:");
      for (const c of conflicts) {
        console.log(`  → codigo ${c.codigo} comp=${c.complemento_valor}`);
      }
    }
  }
}

main();
