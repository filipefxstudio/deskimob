/**
 * Auditoria pós-migração Kenia — proprietários e complementos.
 * Uso: npx tsx scripts/imoview-audit-kenia.ts
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

const KENIA_CORRETOR_ID = "7f6df903-f2cf-4852-80c5-b505e6e2968f";

function isCasaOuTerreno(tipo: string): boolean {
  return tipo === "casa" || tipo === "terreno";
}

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const admin = createServiceRoleClient();

  const { data: imoveis, error } = await admin
    .from("imoveis")
    .select(
      "id, codigo, tipo, cliente_id, complemento, complemento_valor, complemento_tipo, complemento_numero, complemento_torre",
    )
    .eq("corretor_id", KENIA_CORRETOR_ID)
    .not("codigo", "is", null)
    .order("codigo");

  if (error) throw error;

  const list = imoveis ?? [];
  console.log(`Total imóveis Kenia: ${list.length}\n`);

  // --- Proprietários ---
  const semCliente = list.filter((i) => !i.cliente_id);
  console.log("=== PROPRIETÁRIOS ===");
  console.log(`Sem cliente_id: ${semCliente.length}`);
  if (semCliente.length) {
    console.log("Códigos:", semCliente.map((i) => i.codigo).join(", "));
  }

  // --- Complementos ---
  const comComplementoBruto = list.filter((i) => {
    const raw = (i.complemento_valor ?? i.complemento ?? "").trim();
    return raw.length > 0;
  });

  const complementoIncompleto = comComplementoBruto.filter((i) => {
    if (isCasaOuTerreno(i.tipo)) {
      // casa: complemento_numero ou complemento_tipo "casa" + identificação
      return !i.complemento_tipo?.trim() && !i.complemento_numero?.trim();
    }
    return !i.complemento_tipo?.trim() || !i.complemento_numero?.trim();
  });

  const comTipoNumeroSemTorreQuandoBloco = list.filter((i) => {
    const raw = (i.complemento_valor ?? "").toLowerCase();
    const mencionaBloco =
      raw.includes("bl ") ||
      raw.includes("bloco") ||
      raw.includes("bl.") ||
      Boolean(i.complemento_torre?.trim());
    if (!mencionaBloco) return false;
    return !i.complemento_torre?.trim();
  });

  console.log("\n=== COMPLEMENTOS ===");
  console.log(`Com complemento_valor/complemento preenchido: ${comComplementoBruto.length}`);
  console.log(`Com complemento bruto mas campos UI incompletos: ${complementoIncompleto.length}`);

  if (complementoIncompleto.length) {
    console.log("\nIncompletos (codigo | tipo | bruto | tipo | num | torre):");
    for (const i of complementoIncompleto.slice(0, 30)) {
      console.log(
        `  ${i.codigo} | ${i.tipo} | ${JSON.stringify(i.complemento_valor ?? i.complemento)} | ` +
          `tipo=${i.complemento_tipo ?? "-"} num=${i.complemento_numero ?? "-"} torre=${i.complemento_torre ?? "-"}`,
      );
    }
    if (complementoIncompleto.length > 30) {
      console.log(`  ... e mais ${complementoIncompleto.length - 30}`);
    }
  }

  console.log(`\nMencionam bloco no bruto mas sem complemento_torre: ${comTipoNumeroSemTorreQuandoBloco.length}`);
  if (comTipoNumeroSemTorreQuandoBloco.length) {
    console.log(
      "Códigos:",
      comTipoNumeroSemTorreQuandoBloco.map((i) => i.codigo).join(", "),
    );
  }

  // Apartamentos/cobertura etc. sem complemento bruto — ok
  const aptSemComplemento = list.filter(
    (i) =>
      !isCasaOuTerreno(i.tipo) &&
      !(i.complemento_valor ?? i.complemento ?? "").trim() &&
      !i.complemento_tipo &&
      !i.complemento_numero,
  );
  console.log(`\nApartamentos/similares sem nenhum complemento (planilha vazia): ${aptSemComplemento.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
