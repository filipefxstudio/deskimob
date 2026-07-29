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

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const admin = createServiceRoleClient();
  const codes = ["1774", "1775", "1815", "1813", "1792", "1793", "1789"];

  const { data } = await admin
    .from("imoveis")
    .select(
      "codigo,tipo,complemento,complemento_valor,complemento_tipo,complemento_numero,complemento_torre",
    )
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .in("codigo", codes);

  for (const row of data ?? []) {
    console.log(row);
  }

  const { count: withValor } = await admin
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .not("complemento_valor", "is", null)
    .neq("complemento_valor", "");

  const { count: withNumero } = await admin
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .not("complemento_numero", "is", null)
    .neq("complemento_numero", "");

  const { count: total } = await admin
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID);

  console.log("\nTotal imoveis:", total);
  console.log("Com complemento_valor preenchido:", withValor);
  console.log("Com complemento_numero preenchido:", withNumero);
}

main();
