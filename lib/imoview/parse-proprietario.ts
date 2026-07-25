import type { ParsedProprietario } from "@/lib/imoview/types";

export function parseProprietario(raw: string | undefined | null): ParsedProprietario | null {
  if (!raw?.trim()) return null;

  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const result: ParsedProprietario = {
    nome: parts[0],
    telefone: null,
    email: null,
    cpf: null,
  };

  for (let i = 1; i < parts.length; i += 1) {
    const part = parts[i];
    const lower = part.toLowerCase();

    if (lower.startsWith("cpf:")) {
      result.cpf = part.replace(/^cpf:\s*/i, "").trim() || null;
      continue;
    }

    if (part.includes("@")) {
      result.email = part.trim();
      continue;
    }

    if (!result.telefone) {
      const firstPhone = part.split(",")[0]?.trim();
      result.telefone = firstPhone || null;
    }
  }

  return result;
}

export function normalizeTelefone(telefone: string | null | undefined): string | null {
  if (!telefone?.trim()) return null;
  const digits = telefone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function countProprietariosSemTelefone(
  rows: { Proprietarios?: string }[],
): { count: number; codigos: string[] } {
  const codigos: string[] = [];

  for (const row of rows) {
    const parsed = parseProprietario(row.Proprietarios);
    if (parsed && !normalizeTelefone(parsed.telefone)) {
      const codigo = String((row as { Codigo?: unknown }).Codigo ?? "").trim();
      if (codigo) codigos.push(codigo);
    }
  }

  return { count: codigos.length, codigos };
}
