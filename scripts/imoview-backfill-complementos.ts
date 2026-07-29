/**
 * Preenche complemento_tipo / complemento_numero nos imóveis já importados.
 * Uso: npx tsx scripts/imoview-backfill-complementos.ts
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
  const { mapComplementoFromImoview } = await import("../lib/imoview/map-complemento");
  const { mapTipoImoview } = await import("../lib/imoview/normalize-enums");

  const admin = createServiceRoleClient();

  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });
  const rowByCodigo = new Map(
    parsed.rows.map((r) => [normalizeCodigo(r.Codigo), r]),
  );

  const { data: imoveis, error } = await admin
    .from("imoveis")
    .select("id, codigo, tipo, complemento_valor, complemento_numero")
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .not("codigo", "is", null);

  if (error) throw error;

  let updated = 0;
  let skipped = 0;

  for (const imovel of imoveis ?? []) {
    const codigo = String(imovel.codigo ?? "").trim();
    if (!codigo) continue;

    const row = rowByCodigo.get(codigo);
    const rawComplemento = row
      ? String(row.Complemento ?? "").trim()
      : String(imovel.complemento_valor ?? "").trim();
    const blocoCol = row ? String(row.Bloco ?? "").trim() : "";

    if (!rawComplemento && !blocoCol) {
      skipped += 1;
      continue;
    }

    const tipoImovel = row
      ? mapTipoImoview(row.Tipo).tipo
      : (imovel.tipo as import("@/types").TipoImovel);

    const mapped = mapComplementoFromImoview(
      rawComplemento || null,
      tipoImovel,
      blocoCol || null,
    );

    if (!mapped.complemento_tipo && !mapped.complemento_numero && !mapped.complemento_torre) {
      skipped += 1;
      continue;
    }

    if (
      imovel.complemento_numero === mapped.complemento_numero &&
      imovel.complemento_valor === mapped.complemento_valor
    ) {
      const { data: check } = await admin
        .from("imoveis")
        .select("complemento_tipo, complemento_torre")
        .eq("id", imovel.id)
        .single();
      if (
        check?.complemento_tipo === mapped.complemento_tipo &&
        (check?.complemento_torre ?? null) === (mapped.complemento_torre ?? null)
      ) {
        skipped += 1;
        continue;
      }
    }

    const { error: updateError } = await admin
      .from("imoveis")
      .update({
        complemento: mapped.complemento,
        complemento_valor: mapped.complemento_valor,
        complemento_tipo: mapped.complemento_tipo,
        complemento_numero: mapped.complemento_numero,
        complemento_torre: mapped.complemento_torre,
      })
      .eq("id", imovel.id);

    if (updateError) {
      console.error(`${codigo}: ERRO — ${updateError.message}`);
      continue;
    }

    console.log(
      `${codigo}: ${mapped.complemento_tipo} / ${mapped.complemento_numero ?? "(vazio)"} / torre=${mapped.complemento_torre ?? "(vazio)"}`,
    );
    updated += 1;
  }

  console.log(`\nAtualizados: ${updated}`);
  console.log(`Pulados: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
