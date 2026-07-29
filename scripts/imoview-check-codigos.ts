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

const codigos = process.argv.slice(2).length ? process.argv.slice(2) : ["2157", "2160"];

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const admin = createServiceRoleClient();

  for (const codigo of codigos) {
    const { data } = await admin
      .from("imoveis")
      .select("id, codigo, titulo, logradouro, numero, complemento_valor, complemento_tipo, complemento_numero, complemento_torre, publicado_site")
      .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
      .eq("codigo", codigo)
      .maybeSingle();

    console.log(codigo, data ?? "NAO NO BANCO");
  }
}

main();
