/**
 * Re-aplica enriquecimento Imobee (og:title) em um imóvel já importado.
 * Uso: npx tsx scripts/imoview-re-enrich-codigo.ts 14
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

const codigo = process.argv[2] ?? "14";

async function main() {
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { enrichImovelFromImobee } = await import("../lib/imoview/enrich-from-imobee");
  const { fetchImobeeMetadata } = await import("../lib/imoview/fetch-imobee-metadata");

  const admin = createServiceRoleClient();
  const { data: imovel, error } = await admin
    .from("imoveis")
    .select("id, codigo, titulo, cidade, corretor_id")
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .eq("codigo", codigo)
    .maybeSingle();

  if (error || !imovel) {
    console.error("Imóvel não encontrado:", codigo, error?.message);
    process.exit(1);
  }

  console.log("Antes:", imovel.titulo);

  const metadata = await fetchImobeeMetadata(codigo);
  if (!metadata) {
    console.error("Metadados Imobee indisponíveis");
    process.exit(1);
  }

  const result = await enrichImovelFromImobee(
    admin,
    imovel.id,
    codigo,
    imovel.cidade ?? "",
    metadata,
    imovel.corretor_id,
  );

  const { data: updated } = await admin
    .from("imoveis")
    .select("titulo, slug")
    .eq("id", imovel.id)
    .single();

  console.log("Depois:", updated?.titulo);
  console.log("Slug:", updated?.slug);
  console.log("og:title extraído:", result.titulo);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
