"use client";

import { useTransition } from "react";

import type { ImovelSearchResult } from "@/components/atendimentos/ImovelInteresseAutocomplete";
import { calcularFaixaValorImovel } from "@/lib/actions/atendimentos";
import {
  buildPreferenciasFromImovel,
  type PreferenciasInteresseFromImovel,
} from "@/lib/atendimentos/interesse-from-imovel";

export type InteresseFormState = {
  finalidade: string;
  tipoImovel: string;
  bairros: string[];
  quartos: string;
  suites: string;
  banheiros: string;
  vagas: string;
  valorMin: number | null;
  valorMax: number | null;
};

export const EMPTY_INTERESSE_FORM_STATE: InteresseFormState = {
  finalidade: "",
  tipoImovel: "",
  bairros: [],
  quartos: "",
  suites: "",
  banheiros: "",
  vagas: "",
  valorMin: null,
  valorMax: null,
};

function preferenciasToFormState(preferencias: PreferenciasInteresseFromImovel): InteresseFormState {
  return {
    finalidade: preferencias.finalidade_busca ?? "",
    tipoImovel: preferencias.tipo_imovel_busca ?? "",
    bairros: preferencias.bairros_interesse,
    quartos: preferencias.quartos_minimo != null ? String(preferencias.quartos_minimo) : "",
    suites: preferencias.suites_minimas != null ? String(preferencias.suites_minimas) : "",
    banheiros:
      preferencias.banheiros_minimos != null ? String(preferencias.banheiros_minimos) : "",
    vagas: preferencias.vagas_minimas != null ? String(preferencias.vagas_minimas) : "",
    valorMin: preferencias.valor_minimo,
    valorMax: preferencias.valor_maximo,
  };
}

export function interesseFormStateFromImovel(
  imovel: ImovelSearchResult,
  faixa: { min: number; max: number } | null,
): InteresseFormState {
  return preferenciasToFormState(buildPreferenciasFromImovel(imovel, faixa));
}

export function useAplicarInteresseFromImovel() {
  const [isPending, startTransition] = useTransition();

  function aplicar(
    imovel: ImovelSearchResult,
    onApply: (state: InteresseFormState) => void,
  ) {
    startTransition(async () => {
      const faixa = await calcularFaixaValorImovel(imovel.id);
      onApply(interesseFormStateFromImovel(imovel, faixa));
    });
  }

  return { aplicar, isPending };
}

export function interesseFormStateVazio(): InteresseFormState {
  return { ...EMPTY_INTERESSE_FORM_STATE };
}
