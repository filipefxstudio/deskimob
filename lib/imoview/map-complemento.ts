import type { TipoImovel } from "@/types";

export type MappedComplemento = {
  complemento_tipo: string | null;
  complemento_numero: string | null;
  complemento_torre: string | null;
  complemento: string | null;
  complemento_valor: string | null;
};

function buildComplementoDisplay(
  tipo: string | null,
  numero: string | null,
  torre: string | null,
): string | null {
  const parts: string[] = [];
  if (tipo && numero) {
    parts.push(`${tipo} ${numero}`);
  } else if (numero) {
    parts.push(numero);
  } else if (tipo) {
    parts.push(tipo);
  }
  if (torre?.trim()) {
    parts.push(torre.trim());
  }
  return parts.length > 0 ? parts.join(" — ") : null;
}

function defaultComplementoTipo(tipoImovel: TipoImovel): string {
  switch (tipoImovel) {
    case "casa":
      return "casa";
    case "apartamento":
    case "cobertura":
    case "studio":
      return "apartamento";
    case "comercial":
      return "sala";
    default:
      return "outro";
  }
}

function cleanToken(value: string): string {
  return value.trim().replace(/^[,;\s]+|[,;\s.]+$/g, "");
}

/** Normaliza valor de bloco/torre para exibição no Deskimob. */
export function formatTorreBloco(value: string): string {
  const v = cleanToken(value);
  if (!v) return v;
  if (/^bloco\b/i.test(v)) return v;
  return `Bloco ${v}`;
}

function torreFromBlocoColumn(blocoCol: string | undefined | null): string | null {
  const b = String(blocoCol ?? "").trim();
  if (!b) return null;
  return formatTorreBloco(b);
}

function finish(
  tipo: string | null,
  numero: string | null,
  torre: string | null,
  valorFallback: string,
): MappedComplemento {
  const complemento_valor = numero?.trim() || cleanToken(valorFallback) || null;
  const complemento = buildComplementoDisplay(tipo, numero, torre) ?? complemento_valor;

  return {
    complemento_tipo: tipo,
    complemento_numero: numero?.trim() || null,
    complemento_torre: torre?.trim() || null,
    complemento,
    complemento_valor,
  };
}

const EMPTY: MappedComplemento = {
  complemento_tipo: null,
  complemento_numero: null,
  complemento_torre: null,
  complemento: null,
  complemento_valor: null,
};

function parseComplementoParts(
  trimmed: string,
  torreFromCol: string | null,
): { numero: string | null; torre: string | null } {
  let torre = torreFromCol;
  let numero: string | null = null;

  const apAnywhere = trimmed.match(/\bap\.?\s*(\S+)/i);
  if (apAnywhere?.[1]) {
    numero = cleanToken(apAnywhere[1]);
  }

  const blocoStart = trimmed.match(/^bloco\s+([^,]+?)(?:\s*,|\s+ap\.?|\s*$)/i);
  if (blocoStart?.[1] && !torre) {
    torre = formatTorreBloco(blocoStart[1]);
  }

  if (!torre) {
    const bl = trimmed.match(/(?:^|[,\s])bl\.?\s+(\S+)/i);
    if (bl?.[1]) {
      torre = formatTorreBloco(bl[1]);
    }
  }

  const blocoAfterAp = trimmed.match(/\bap\.?\s*\S+\s+bloco\s+(\S+)/i);
  if (blocoAfterAp?.[1] && !torre) {
    torre = formatTorreBloco(blocoAfterAp[1]);
  }

  const numBloco = trimmed.match(/^(\d+[a-zA-Z]?)\s+bloco\s+(\S+)/i);
  if (numBloco) {
    if (!numero) numero = cleanToken(numBloco[1]);
    if (!torre) torre = formatTorreBloco(numBloco[2]);
  }

  const blocoAp = trimmed.match(/^bloco\s+(\S+)\s+ap\.?\s*(\S+)/i);
  if (blocoAp) {
    if (!torre) torre = formatTorreBloco(blocoAp[1]);
    if (!numero) numero = cleanToken(blocoAp[2]);
  }

  const blAp = trimmed.match(/^bl\.?\s*(\S+)\s+ap\.?\s*(\S+)/i);
  if (blAp) {
    if (!torre) torre = formatTorreBloco(blAp[1]);
    if (!numero) numero = cleanToken(blAp[2]);
  }

  if (!numero && /^\d+[a-zA-Z]?$/.test(trimmed)) {
    numero = trimmed;
  }

  return { numero, torre };
}

/**
 * Converte Complemento + coluna Bloco do Imoview para campos do Deskimob.
 */
export function mapComplementoFromImoview(
  raw: string | undefined | null,
  tipoImovel: TipoImovel,
  blocoCol?: string | undefined | null,
): MappedComplemento {
  const trimmed = String(raw ?? "").trim();
  const torreFromCol = torreFromBlocoColumn(blocoCol);

  if (!trimmed && !torreFromCol) {
    return EMPTY;
  }

  if (!trimmed && torreFromCol) {
    const tipo = defaultComplementoTipo(tipoImovel);
    return finish(tipo, null, torreFromCol, torreFromCol);
  }

  const { numero, torre } = parseComplementoParts(trimmed, torreFromCol);

  if (numero) {
    const tipoComp =
      /\bap\.?\s/i.test(trimmed) || defaultComplementoTipo(tipoImovel) === "apartamento"
        ? "apartamento"
        : defaultComplementoTipo(tipoImovel);
    return finish(tipoComp, numero, torre, numero);
  }

  const casaMatch = trimmed.match(/^casa\s*(.*)$/i);
  if (casaMatch) {
    const suffix = casaMatch[1].trim();
    if (suffix) {
      return finish("casa", cleanToken(suffix), torre, suffix);
    }
    return finish("casa", null, torre, trimmed);
  }

  const lojaMatch = trimmed.match(/^loja\s*(.+)$/i);
  if (lojaMatch) {
    return finish("loja", cleanToken(lojaMatch[1]), torre, trimmed);
  }

  const salaMatch = trimmed.match(/^sala\s*(.+)$/i);
  if (salaMatch) {
    return finish("sala", cleanToken(salaMatch[1]), torre, trimmed);
  }

  if (torre && /^\d+[a-zA-Z]?$/.test(trimmed)) {
    return finish(defaultComplementoTipo(tipoImovel), trimmed, torre, trimmed);
  }

  if (torre) {
    return finish(defaultComplementoTipo(tipoImovel), null, torre, trimmed);
  }

  return finish(defaultComplementoTipo(tipoImovel), trimmed, null, trimmed);
}
