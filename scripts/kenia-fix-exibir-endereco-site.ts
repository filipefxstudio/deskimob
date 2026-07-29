/**
 * Define exibir_endereco_site = oculto para todos os imóveis da Kenia.
 * Uso: npx tsx scripts/kenia-fix-exibir-endereco-site.ts
 */
import fs from "node:fs";
import path from "node:path";

import { KENIA_CORRETOR_ID } from "../lib/imoview/import-target";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

async function main() {
  loadEnv();

  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const admin = createServiceRoleClient();

  const { data: antes, error: readError } = await admin
    .from("imoveis")
    .select("id, exibir_endereco_site")
    .eq("corretor_id", KENIA_CORRETOR_ID);

  if (readError) throw readError;

  const porModo = new Map<string, number>();
  for (const imovel of antes ?? []) {
    const modo = imovel.exibir_endereco_site ?? "(null)";
    porModo.set(modo, (porModo.get(modo) ?? 0) + 1);
  }

  console.log("Antes da atualização:");
  for (const [modo, count] of [...porModo.entries()].sort()) {
    console.log(`  ${modo}: ${count}`);
  }
  console.log(`  total: ${(antes ?? []).length}`);

  const { data: atualizados, error: updateError } = await admin
    .from("imoveis")
    .update({ exibir_endereco_site: "oculto" })
    .eq("corretor_id", KENIA_CORRETOR_ID)
    .select("id");

  if (updateError) throw updateError;

  console.log(`\nAtualizados: ${atualizados?.length ?? 0} imóveis → exibir_endereco_site = oculto`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
