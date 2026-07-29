import type { Imovel } from "@/types";

type ImovelComplementoFields = Pick<
  Imovel,
  | "complemento"
  | "complemento_valor"
  | "complemento_tipo"
  | "complemento_numero"
  | "complemento_torre"
>;

/** Texto de complemento para exibição (campos estruturados ou legado). */
export function formatComplementoImovel(imovel: ImovelComplementoFields): string | null {
  const parts: string[] = [];

  if (imovel.complemento_tipo && imovel.complemento_numero) {
    parts.push(`${imovel.complemento_tipo} ${imovel.complemento_numero}`);
  } else if (imovel.complemento_numero?.trim()) {
    parts.push(imovel.complemento_numero.trim());
  } else if (imovel.complemento_tipo?.trim()) {
    parts.push(imovel.complemento_tipo.trim());
  }

  if (imovel.complemento_torre?.trim()) {
    parts.push(imovel.complemento_torre.trim());
  }

  if (parts.length > 0) {
    return parts.join(" — ");
  }

  const legacy = imovel.complemento?.trim() || imovel.complemento_valor?.trim();
  return legacy || null;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Consulte";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getImovelCodigo(imovel: Pick<Imovel, "id" | "codigo">): string {
  if (imovel.codigo) {
    return `#${imovel.codigo.padStart(4, "0")}`;
  }

  const slice = imovel.id.replace(/-/g, "").slice(-4).toUpperCase();
  return `#${slice}`;
}

export function formatEnderecoCurto(imovel: Imovel): string {
  const partes = [
    imovel.logradouro,
    imovel.numero,
    formatComplementoImovel(imovel),
  ].filter(Boolean);
  return partes.join(", ") || "Endereço não informado";
}

/** Endereço completo no dashboard interno (inclui complemento). */
export function formatEnderecoCompleto(imovel: Imovel): string {
  const partes = [
    imovel.logradouro,
    imovel.numero,
    formatComplementoImovel(imovel),
    imovel.bairro,
    imovel.cidade,
    imovel.estado,
  ].filter(Boolean);

  return partes.join(", ") || "Endereço não informado";
}

export function getValorNumerico(imovel: Imovel): number | null {
  if (imovel.finalidade === "venda") {
    return imovel.valor_venda ?? null;
  }
  return imovel.valor_locacao ?? null;
}

import { getPublicImovelShareUrlClient } from "@/lib/imoveis/share-url";

/** @deprecated Use getPublicImovelShareUrlClient ou getPublicImovelShareUrl */
export function getPublicImovelUrl(corretorSlug: string, imovelSlug: string): string {
  return getPublicImovelShareUrlClient(corretorSlug, imovelSlug);
}
