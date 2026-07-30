import { getTipoLabel } from "@/lib/site/format";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImovelPreferenciasSource = {
  finalidade?: string | null;
  tipo?: string | null;
  bairro?: string | null;
  quartos?: number | null;
  suites?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
};

export type PreferenciasInteresseFromImovel = {
  finalidade_busca: string | null;
  tipo_imovel_busca: string | null;
  bairros_interesse: string[];
  quartos_minimo: number | null;
  suites_minimas: number | null;
  banheiros_minimos: number | null;
  vagas_minimas: number | null;
  valor_minimo: number | null;
  valor_maximo: number | null;
};

function numeroMinimoPositivo(valor?: number | null): number | null {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) {
    return null;
  }
  return Math.trunc(valor);
}

export function finalidadeBuscaFromImovel(
  finalidade?: string | null,
): string | null {
  if (finalidade === "venda") return "compra";
  if (finalidade === "locacao") return "locacao";
  return null;
}

export function buildPreferenciasFromImovel(
  imovel: ImovelPreferenciasSource,
  faixa: { min: number; max: number } | null,
): PreferenciasInteresseFromImovel {
  const bairros = imovel.bairro?.trim() ? [imovel.bairro.trim()] : [];

  return {
    finalidade_busca: finalidadeBuscaFromImovel(imovel.finalidade),
    tipo_imovel_busca: imovel.tipo?.trim() || null,
    bairros_interesse: bairros,
    quartos_minimo: numeroMinimoPositivo(imovel.quartos),
    suites_minimas: numeroMinimoPositivo(imovel.suites),
    banheiros_minimos: numeroMinimoPositivo(imovel.banheiros),
    vagas_minimas: numeroMinimoPositivo(imovel.vagas),
    valor_minimo: faixa?.min ?? null,
    valor_maximo: faixa?.max ?? null,
  };
}

export function formatTipoBairrosInteresse(input: {
  tipo_imovel_busca?: string | null;
  bairros_interesse?: string[] | null;
}): string | null {
  const tipo = input.tipo_imovel_busca?.trim()
    ? getTipoLabel(input.tipo_imovel_busca.trim())
    : null;
  const bairros = (input.bairros_interesse ?? []).filter(Boolean);

  if (tipo && bairros.length > 0) {
    return `${tipo} - ${bairros.join(", ")}`;
  }

  if (tipo) return tipo;
  if (bairros.length > 0) return bairros.join(", ");
  return null;
}

export async function fetchPreferenciasInteresseFromImovel(
  supabase: SupabaseClient,
  corretorId: string,
  imovelId: string,
  faixaValorPercent = 20,
): Promise<PreferenciasInteresseFromImovel | null> {
  const { data: imovel } = await supabase
    .from("imoveis")
    .select("finalidade, tipo, bairro, quartos, suites, banheiros, vagas, valor_venda, valor_locacao")
    .eq("id", imovelId)
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (!imovel) return null;

  const valor =
    imovel.finalidade === "venda" ? imovel.valor_venda : imovel.valor_locacao;

  let faixa: { min: number; max: number } | null = null;
  if (valor != null) {
    const delta = valor * (faixaValorPercent / 100);
    faixa = { min: Math.round(valor - delta), max: Math.round(valor + delta) };
  }

  return buildPreferenciasFromImovel(imovel, faixa);
}
