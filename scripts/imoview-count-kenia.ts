import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const admin = createServiceRoleClient();
  const { count } = await admin
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", "7f6df903-f2cf-4852-80c5-b505e6e2968f");
  console.log("Imoveis Kenia:", count);
}

main();
