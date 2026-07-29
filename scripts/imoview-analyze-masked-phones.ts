/**
 * Analisa telefones mascarados na planilha vs clientes no banco.
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

function extractVisiblePhoneSuffix(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return null;
  if (digits.length >= 4) return digits.slice(-4);
  return null;
}

function isMaskedPhone(raw: string | null | undefined): boolean {
  return Boolean(raw?.includes("*"));
}

async function main() {
  const { createServiceRoleClient } = await import("../lib/supabase/admin");
  const { IMOVIEW_IMPORT_CORRETOR_ID } = await import("../lib/imoview/constants");
  const { parseXlsBuffer, normalizeCodigo } = await import("../lib/imoview/parse-xls");
  const { parseProprietario, normalizeTelefone } = await import("../lib/imoview/parse-proprietario");

  const admin = createServiceRoleClient();
  const buf = fs.readFileSync(
    path.join(process.cwd(), "data/imoveis-indicadores-2026-07-25-105409.xlsx"),
  );
  const parsed = parseXlsBuffer(buf, { filename: "x.xlsx", exportYear: 2026 });

  const owners = new Map<string, { full: string[]; masked: string[] }>();
  for (const r of parsed.rows) {
    const p = parseProprietario(r.Proprietarios);
    if (!p) continue;
    const key = p.nome.toLowerCase().trim();
    if (!owners.has(key)) owners.set(key, { full: [], masked: [] });
    const tel = normalizeTelefone(p.telefone);
    const codigo = normalizeCodigo(r.Codigo);
    if (tel) owners.get(key)!.full.push(`${codigo}:${tel}`);
    else if (isMaskedPhone(p.telefone)) owners.get(key)!.masked.push(`${codigo}:${p.telefone}`);
  }

  console.log("Owners with BOTH full and masked phones:");
  for (const [name, data] of owners) {
    if (data.masked.length && data.full.length) {
      console.log(`  ${name}: full=${data.full.join("; ")} masked=${data.masked.length}`);
    }
  }

  const { data: clientes } = await admin
    .from("clientes")
    .select("id, nome, telefone, cpf")
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID);

  const { data: imoveis } = await admin
    .from("imoveis")
    .select("id, codigo, cliente_id")
    .eq("corretor_id", IMOVIEW_IMPORT_CORRETOR_ID)
    .is("cliente_id", null);

  console.log("\nMatching sem cliente_id against existing clientes:");
  for (const im of imoveis ?? []) {
    const row = parsed.rows.find((r) => normalizeCodigo(r.Codigo) === String(im.codigo));
    const p = parseProprietario(row?.Proprietarios);
    if (!p) continue;

    const suffix = extractVisiblePhoneSuffix(p.telefone);
    const cpfDigits = p.cpf?.replace(/\D/g, "") ?? null;
    const bySuffix = suffix
      ? (clientes ?? []).filter((c) => c.telefone?.replace(/\D/g, "").endsWith(suffix))
      : [];
    const byCpf = cpfDigits
      ? (clientes ?? []).filter((c) => c.cpf?.replace(/\D/g, "") === cpfDigits)
      : [];

    console.log(
      `${im.codigo} ${p.nome} suffix=${suffix ?? "-"} cpf=${cpfDigits ?? "-"} ` +
        `matchSuffix=${bySuffix.map((c) => `${c.nome}/${c.telefone}`).join("|") || "-"} ` +
        `matchCpf=${byCpf.map((c) => c.nome).join("|") || "-"}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
