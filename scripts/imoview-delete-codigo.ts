/**
 * Remove imóvel 2039 (duplicata de endereço — manter 2103).
 * Uso: npx tsx scripts/imoview-delete-codigo.ts 2039
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

const codigo = process.argv[2]?.trim();
if (!codigo) {
  console.error("Informe o código: npx tsx scripts/imoview-delete-codigo.ts 2039");
  process.exit(1);
}

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");

  const admin = createServiceRoleClient();

  const { data: imovel, error: findError } = await admin
    .from("imoveis")
    .select("id, codigo, titulo, logradouro, numero, complemento_valor")
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .eq("codigo", codigo)
    .maybeSingle();

  if (findError) throw findError;
  if (!imovel) {
    console.log(`Imóvel código ${codigo} não encontrado — nada a fazer.`);
    return;
  }

  console.log("Removendo:", imovel);

  const { error: deleteError } = await admin.from("imoveis").delete().eq("id", imovel.id);

  if (deleteError) throw deleteError;

  console.log(`Imóvel ${codigo} (${imovel.id}) removido.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
