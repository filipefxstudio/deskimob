import type { ParsedProprietario } from "@/lib/imoview/types";

/** E-mails de corretor/imobiliária — não são do proprietário (Imoview). */
function isBrokerPlaceholderEmail(email: string): boolean {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  return domain === "imobee.net";
}

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
      const email = part.trim();
      if (!isBrokerPlaceholderEmail(email)) {
        result.email = email;
      }
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

/** Telefone parcialmente oculto na exportação Imoview (ex.: `(**) *****-6581`). */
export function isMaskedPhone(raw: string | null | undefined): boolean {
  return Boolean(raw?.includes("*"));
}

/** Últimos dígitos visíveis em telefone mascarado (geralmente 4). */
export function extractVisiblePhoneSuffix(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return null;
  if (digits.length >= 4) return digits.slice(-4);
  return digits.length > 0 ? digits : null;
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
