/**
 * Investiga erros específicos da importação Imoview.
 * Uso: npx tsx scripts/imoview-investigate-errors.ts
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

const PHONE_CODES = ["1129", "1131", "1711", "1995", "2112"];
const ADDRESS_CONFLICTS: Record<string, string> = {
  "1638": "1369",
  "1677": "1385",
  "1845": "1824",
  "1930": "1814",
  "2103": "2039",
};
const ADDRESS_CODES = Object.keys(ADDRESS_CONFLICTS);
const EMAIL_CODE = "2169";

const xlsPath = path.join(
  process.cwd(),
  "data/imoveis-indicadores-2026-07-25-105409.xlsx",
);

async function main() {
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { parseProprietario, normalizeTelefone } = await import("../lib/imoview/parse-proprietario");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");

  const buffer = fs.readFileSync(xlsPath);
  const parsed = parseXlsBuffer(buffer, {
    filename: path.basename(xlsPath),
    exportYear: 2026,
  });

  const byCodigo = new Map(
    parsed.rows.map((row) => [normalizeCodigo(row.Codigo), row]),
  );

  const { mapRowToImovel } = await import("../lib/imoview/map-row-to-imovel");
  const { createDiagnosticMapContext } = await import("../lib/imoview/import-target");
  const mapContext = createDiagnosticMapContext();

  console.log("\n=== 2. varchar(20) — Proprietarios + campos mapeados >20 ===\n");
  for (const codigo of PHONE_CODES) {
    const row = byCodigo.get(codigo);
    if (!row) {
      console.log(`${codigo}: NÃO ENCONTRADO NA PLANILHA`);
      continue;
    }

    const raw = row.Proprietarios ?? "(vazio)";
    const parsedProp = parseProprietario(row.Proprietarios);
    const telefoneNorm = normalizeTelefone(parsedProp?.telefone ?? null);

    console.log(`--- Código ${codigo} ---`);
    console.log(`  Situacao (planilha): ${JSON.stringify(row.Situacao)}`);
    console.log(`Proprietarios (bruto): ${JSON.stringify(raw)}`);
    if (parsedProp) {
      console.log(`  nome: ${parsedProp.nome}`);
      console.log(`  telefone (parseado): ${JSON.stringify(parsedProp.telefone)} (${parsedProp.telefone?.length ?? 0} chars)`);
      console.log(`  telefone (normalizado): ${JSON.stringify(telefoneNorm)} (${telefoneNorm?.length ?? 0} chars)`);
      console.log(`  email: ${JSON.stringify(parsedProp.email)} (${parsedProp.email?.length ?? 0} chars)`);
      console.log(`  cpf: ${JSON.stringify(parsedProp.cpf)} (${parsedProp.cpf?.length ?? 0} chars)`);
    }
    const { mapped } = mapRowToImovel(row, 2026, "temp-slug", mapContext);
    const longFields = Object.entries(mapped).filter(
      ([, v]) => typeof v === "string" && v.length > 20,
    );
    if (longFields.length > 0) {
      console.log("  Campos imóvel >20 chars:");
      for (const [k, v] of longFields) {
        console.log(`    ${k}: ${JSON.stringify(v)} (${(v as string).length} chars)`);
      }
    } else {
      console.log("  Campos imóvel >20 chars: (nenhum)");
    }
    console.log(
      `  IdenticadorChave (bruto): ${JSON.stringify(row.IdenticadorChave)} (${String(row.IdenticadorChave ?? "").length} chars)`,
    );
    console.log(
      `  chaves_codigo (mapeado): ${JSON.stringify(mapped.chaves_codigo)} (${String(mapped.chaves_codigo ?? "").length} chars)`,
    );
    const varchar20Fields = {
      local_chaves: mapped.local_chaves,
      vagas_tipo: mapped.vagas_tipo,
      destinacao: mapped.destinacao,
      exibir_endereco_site: mapped.exibir_endereco_site,
      exibir_endereco_portais: mapped.exibir_endereco_portais,
      status: mapped.status,
      status_aprovacao: mapped.status_aprovacao,
      TipoVaga_raw: row.TipoVaga,
      LocalChave_raw: row.LocalChave,
    };
    console.log("  Campos VARCHAR(20) candidatos:");
    for (const [k, v] of Object.entries(varchar20Fields)) {
      const s = v == null ? "" : String(v);
      const flag = s.length > 20 ? " *** EXCEDE ***" : "";
      console.log(`    ${k}: ${JSON.stringify(v)} (${s.length} chars)${flag}`);
    }
    console.log("");
  }

  console.log("\n=== 3. imoveis_endereco_unique ===\n");
  const admin = createServiceRoleClient();

  for (const codigo of ADDRESS_CODES) {
    const row = byCodigo.get(codigo);
    if (!row) {
      console.log(`${codigo}: NÃO ENCONTRADO NA PLANILHA`);
      continue;
    }

    const logradouro = String(row.Endereco ?? "").trim();
    const numero = String(row.EnderecoNumero ?? "").trim() || "S/N";
    const complemento = String(row.Complemento ?? "").trim() || "";
    const bairro = String(row.Bairro ?? "").trim();
    const cidade = String(row.Cidade ?? "").trim();
    const estado = String(row.Estado ?? "").trim();

    console.log(`--- Código ${codigo} (planilha) ---`);
    console.log(`  Endereco: ${logradouro}`);
    console.log(`  Numero: ${numero}`);
    console.log(`  Complemento: ${complemento || "(vazio)"}`);
    console.log(`  Bairro: ${bairro}`);
    console.log(`  Cidade/UF: ${cidade}/${estado}`);
    console.log(`  Chave única: logradouro=${logradouro.toLowerCase()}, numero=${numero.toLowerCase()}, complemento=${complemento.toLowerCase()}`);
    console.log(`  Situacao/Tipo/Valor: ${row.Situacao} / ${row.Tipo} / ${row.Valor}`);
    const conflictCodigo = ADDRESS_CONFLICTS[codigo];
    const conflictRow = conflictCodigo ? byCodigo.get(conflictCodigo) : undefined;
    if (conflictRow) {
      console.log(
        `  Planilha conflito ${conflictCodigo}: Situacao=${conflictRow.Situacao}, Tipo=${conflictRow.Tipo}, Valor=${conflictRow.Valor}, Bairro=${conflictRow.Bairro}`,
      );
    }

    const { data: conflicts } = await admin
      .from("imoveis")
      .select("id, codigo, titulo, logradouro, numero, complemento, complemento_valor, bairro, cidade, estado")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .ilike("logradouro", logradouro)
      .ilike("numero", numero);

    const matching = (conflicts ?? []).filter((imovel) => {
      const comp = (imovel.complemento_valor ?? imovel.complemento ?? "").trim().toLowerCase();
      return comp === complemento.toLowerCase();
    });

    if (matching.length === 0) {
      console.log(`  Conflito no banco: NENHUM (busca parcial por logradouro+numero:`);
      for (const c of conflicts ?? []) {
        console.log(
          `    - codigo=${c.codigo}, comp="${c.complemento_valor ?? c.complemento ?? ""}", bairro=${c.bairro}, titulo=${c.titulo?.slice(0, 60)}`,
        );
      }
    } else {
      console.log(`  Conflito no banco:`);
      for (const c of matching) {
        console.log(
          `    - codigo=${c.codigo}, id=${c.id}, comp="${c.complemento_valor ?? c.complemento ?? ""}", bairro=${c.bairro}, titulo=${c.titulo?.slice(0, 80)}`,
        );
      }
    }
    console.log("");
  }

  console.log("\n=== 4. clientes_corretor_email_unique — código 2169 ===\n");
  const row2169 = byCodigo.get(EMAIL_CODE);
  if (row2169) {
    const raw = row2169.Proprietarios ?? "(vazio)";
    const parsedProp = parseProprietario(row2169.Proprietarios);
    const telefoneNorm = normalizeTelefone(parsedProp?.telefone ?? null);
    console.log(`Proprietarios (bruto): ${JSON.stringify(raw)}`);
    console.log(`  telefone normalizado: ${JSON.stringify(telefoneNorm)}`);
    console.log(`  email: ${JSON.stringify(parsedProp?.email)}`);

    if (parsedProp?.email) {
      const { data: byEmail } = await admin
        .from("clientes")
        .select("id, nome, telefone, email")
        .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
        .ilike("email", parsedProp.email)
        .maybeSingle();
      console.log(`  Cliente existente com mesmo email:`, byEmail ?? "(nenhum)");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
