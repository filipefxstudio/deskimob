import { FINALIDADES_IMOVEL, TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import { formatCurrency, getImovelCodigo } from "@/lib/imoveis/format";
import { getImovelFotoThumbnailUrl } from "@/lib/imoveis/foto-url";
import type { ImovelPublico } from "@/lib/site/imovel-publico";
import type { FinalidadeImovel, Imovel, TipoImovel } from "@/types";

export { formatCurrency };

export function getTipoLabel(tipo: TipoImovel | string): string {
  return TIPOS_IMOVEL.find((item) => item.value === tipo)?.label ?? tipo;
}

export function getFinalidadeLabel(finalidade: FinalidadeImovel): string {
  return FINALIDADES_IMOVEL.find((item) => item.value === finalidade)?.label ?? finalidade;
}

export function getTipoFinalidadeCardLabel(imovel: Pick<ImovelPublico, "tipo" | "finalidade">): string {
  return `${getTipoLabel(imovel.tipo).toUpperCase()} - ${getFinalidadeLabel(imovel.finalidade).toUpperCase()}`;
}

export function getImovelCodigoSite(imovel: Pick<Imovel, "id" | "codigo">): string {
  return `COD. ${getImovelCodigo(imovel).replace("#", "")}`;
}

export function getBairroCidadeCardLabel(
  imovel: Pick<ImovelPublico, "exibir_endereco_site" | "bairro" | "cidade">,
): string | null {
  const modo = imovel.exibir_endereco_site ?? "apenas_bairro";
  if (modo === "oculto") {
    return null;
  }

  const partes = [imovel.bairro, imovel.cidade].filter(Boolean);
  return partes.length > 0 ? partes.join(" - ") : null;
}

/** Título do anúncio no card (endereço completo não é exposto no site público). */
export function getEnderecoCardSecundario(
  imovel: Pick<ImovelPublico, "titulo">,
): string | null {
  return imovel.titulo?.trim() || null;
}

export function getValorExibicao(imovel: Pick<ImovelPublico, "finalidade" | "valor_venda" | "valor_locacao">): string {
  if (imovel.finalidade === "venda") {
    return formatCurrency(imovel.valor_venda);
  }

  return `${formatCurrency(imovel.valor_locacao)}/mês`;
}

export function getCapaUrl(
  imovel: Pick<ImovelPublico, "fotos">,
  thumbnail = false,
): string | null {
  const fotos = imovel.fotos ?? [];
  const ordenadas = [...fotos].sort((a, b) => a.ordem - b.ordem);
  const url = ordenadas[0]?.url ?? null;
  if (!url) {
    return null;
  }

  return thumbnail ? getImovelFotoThumbnailUrl(url) : url;
}

/** Endereço no site público — apenas bairro/cidade/estado (sem logradouro/número). */
export function formatEndereco(
  imovel: Pick<ImovelPublico, "exibir_endereco_site" | "bairro" | "cidade" | "estado">,
): string {
  const modo = imovel.exibir_endereco_site ?? "apenas_bairro";

  if (modo === "oculto") {
    return "";
  }

  return [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(", ");
}

export function deveExibirMapaPublico(
  imovel: Pick<ImovelPublico, "exibir_endereco_site" | "latitude" | "longitude">,
): boolean {
  const modo = imovel.exibir_endereco_site ?? "apenas_bairro";
  return modo !== "oculto" && Boolean(imovel.latitude && imovel.longitude);
}
