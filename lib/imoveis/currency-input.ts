import {
  CURRENCY_FILTER_PLACEHOLDER,
  CURRENCY_PLACEHOLDER,
} from "@/lib/constants/input-placeholders";

const CURRENCY_PREFIX = "R$ ";

export { CURRENCY_PLACEHOLDER, CURRENCY_FILTER_PLACEHOLDER };

function stripCurrencyPrefix(input: string): string {
  return input.replace(/^\s*R\$\s*/i, "").trim();
}

function formatIntegerPart(intPart: string): string {
  const digits = intPart.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatFromRawInput(input: string, allowCents: boolean): string {
  const cleaned = stripCurrencyPrefix(input).replace(/[^\d,]/g, "");

  if (!allowCents) {
    return formatIntegerPart(cleaned);
  }

  const commaIndex = cleaned.indexOf(",");
  const intRaw = commaIndex >= 0 ? cleaned.slice(0, commaIndex) : cleaned;
  const decRaw = commaIndex >= 0 ? cleaned.slice(commaIndex + 1) : "";
  const formattedInt = formatIntegerPart(intRaw);

  if (commaIndex >= 0) {
    return `${formattedInt},${decRaw.replace(/\D/g, "").slice(0, 2)}`;
  }

  return formattedInt;
}

export type CurrencyInputMode = "default" | "filter";

/** Formata valor numérico ou texto bruto para exibição no input. */
export function formatCurrencyInput(
  value: number | string | null | undefined,
  mode: CurrencyInputMode = "default",
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const allowCents = mode === "default";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }

    const [intPart, decPart] = value.toFixed(2).split(".");
    const formatted = formatIntegerPart(intPart);

    if (!formatted) {
      return "";
    }

    if (!allowCents) {
      return `${CURRENCY_PREFIX}${formatted}`;
    }

    return `${CURRENCY_PREFIX}${formatted},${decPart}`;
  }

  const body = formatFromRawInput(String(value), allowCents);
  return body ? `${CURRENCY_PREFIX}${body}` : "";
}

/** Converte texto formatado (R$ 800.000,50) em número puro para persistência. */
export function parseCurrencyInput(formatted: string): number | null {
  const trimmed = stripCurrencyPrefix(formatted.trim());
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);

  return Number.isFinite(num) ? num : null;
}
