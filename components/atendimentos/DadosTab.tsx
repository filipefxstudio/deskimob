"use client";

import { AtendimentoDadosTab } from "@/components/atendimentos/AtendimentoDadosTab";
import type { Lead, MotivoDescarte, TipoImovelCustom } from "@/types";

interface DadosTabProps {
  lead: Lead;
  perfis: { id: string; nome: string }[];
  tiposImovel: TipoImovelCustom[];
  motivos: MotivoDescarte[];
  podeTransferir?: boolean;
}

export function DadosTab({
  lead,
  perfis,
  tiposImovel,
  motivos,
  podeTransferir = false,
}: DadosTabProps) {
  return (
    <AtendimentoDadosTab
      lead={lead}
      perfis={perfis}
      tiposImovel={tiposImovel}
      motivos={motivos}
      podeTransferir={podeTransferir}
    />
  );
}
