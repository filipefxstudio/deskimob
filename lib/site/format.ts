import { FINALIDADES_IMOVEL, TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import { formatCurrency, getImovelCodigo } from "@/lib/imoveis/format";
import type { FinalidadeImovel, Imovel, TipoImovel } from "@/types";

export { formatCurrency };

export function getTipoLabel(tipo: TipoImovel): string {
  return TIPOS_IMOVEL.find((item) => item.value === tipo)?.label ?? tipo;
}

export function getFinalidadeLabel(finalidade: FinalidadeImovel): string {
  return FINALIDADES_IMOVEL.find((item) => item.value === finalidade)?.label ?? finalidade;
}

export function getTipoFinalidadeCardLabel(imovel: Imovel): string {
  return `${getTipoLabel(imovel.tipo).toUpperCase()} - ${getFinalidadeLabel(imovel.finalidade).toUpperCase()}`;
}

export function getImovelCodigoSite(imovel: Pick<Imovel, "id" | "codigo">): string {
  return `COD. ${getImovelCodigo(imovel).replace("#", "")}`;
}

export function getBairroCidadeCardLabel(imovel: Imovel): string | null {
  const partes = [imovel.bairro, imovel.cidade].filter(Boolean);
  return partes.length > 0 ? partes.join(" - ") : null;
}

/** Linha abaixo de bairro/cidade: endereço (se completo) ou título do anúncio. */
export function getEnderecoCardSecundario(imovel: Imovel): string | null {
  const modo = imovel.exibir_endereco_site ?? "apenas_bairro";

  if (modo === "completo") {
    const endereco = [imovel.logradouro, imovel.numero].filter(Boolean).join(", ");
    return endereco || imovel.titulo?.trim() || null;
  }

  return imovel.titulo?.trim() || null;
}

export function getValorExibicao(imovel: Imovel): string {
  if (imovel.finalidade === "venda") {
    return formatCurrency(imovel.valor_venda);
  }

  return `${formatCurrency(imovel.valor_locacao)}/mês`;
}

export function getCapaUrl(imovel: Imovel): string | null {
  const fotos = imovel.fotos ?? [];
  const ordenadas = [...fotos].sort((a, b) => a.ordem - b.ordem);
  return ordenadas[0]?.url ?? null;
}

export function formatEndereco(imovel: Imovel): string {
  const partes = [
    imovel.logradouro,
    imovel.numero,
    imovel.bairro,
    imovel.cidade,
    imovel.estado,
  ].filter(Boolean);

  return partes.join(", ");
}
