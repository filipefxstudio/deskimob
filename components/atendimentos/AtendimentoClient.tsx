"use client";

import { Suspense } from "react";

import { AtendimentoHeader } from "@/components/atendimentos/AtendimentoHeader";
import { AtendimentoTabs } from "@/components/atendimentos/AtendimentoTabs";
import { AtendimentoDadosTab } from "@/components/atendimentos/AtendimentoDadosTab";
import { AuditoriaTab } from "@/components/atendimentos/AuditoriaTab";
import { ImoveisSelecionadosTab } from "@/components/atendimentos/ImoveisSelecionadosTab";
import { NegocioFechadoTab } from "@/components/atendimentos/NegocioFechadoTab";
import { PropostasTab } from "@/components/atendimentos/PropostasTab";
import { RadarImoveisTab } from "@/components/atendimentos/RadarImoveisTab";
import { VisitasTab } from "@/components/atendimentos/VisitasTab";
import type {
  AuditoriaAtendimento,
  Imovel,
  Lead,
  LeadImovelSelecionado,
  MotivoDescarte,
  Negocio,
  Proposta,
  StatusImovel,
  TipoImovelCustom,
  Visita,
} from "@/types";

interface AtendimentoClientProps {
  lead: Lead;
  perfis: { id: string; nome: string }[];
  perfilAtualId?: string | null;
  imoveisRadar: Imovel[];
  visitas: Visita[];
  propostas: Proposta[];
  negocios: Negocio[];
  imoveisSelecionados: LeadImovelSelecionado[];
  auditoria: AuditoriaAtendimento[];
  motivos: MotivoDescarte[];
  podeTransferir: boolean;
  tiposImovel: TipoImovelCustom[];
  corretorSlug: string;
  statusList: StatusImovel[];
  faixaValorPercent?: number;
}

export function AtendimentoClient({
  lead,
  perfis,
  perfilAtualId,
  imoveisRadar,
  visitas,
  propostas,
  negocios,
  imoveisSelecionados,
  auditoria,
  motivos,
  podeTransferir,
  tiposImovel,
  corretorSlug,
  statusList,
  faixaValorPercent = 20,
}: AtendimentoClientProps) {
  const imoveisParaAcao = imoveisSelecionados
    .map((s) => s.imovel)
    .filter((i): i is Imovel => Boolean(i));

  return (
    <div className="space-y-4">
      <AtendimentoHeader
        lead={lead}
        perfis={perfis}
        motivos={motivos}
        podeTransferir={podeTransferir}
      />

      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
        <AtendimentoTabs
          panels={{
            dados: (
              <AtendimentoDadosTab
                lead={lead}
                perfis={perfis}
                tiposImovel={tiposImovel}
                motivos={motivos}
                faixaValorPercent={faixaValorPercent}
              />
            ),
            radar: (
              <RadarImoveisTab
                leadId={lead.id}
                imoveis={imoveisRadar}
                selecionados={imoveisSelecionados}
                corretorSlug={corretorSlug}
                statusList={statusList}
              />
            ),
            selecionados: (
              <ImoveisSelecionadosTab
                leadId={lead.id}
                selecionados={imoveisSelecionados}
                visitas={visitas}
                corretorSlug={corretorSlug}
                statusList={statusList}
              />
            ),
            visitas: (
              <VisitasTab
                leadId={lead.id}
                visitas={visitas}
                propostas={propostas}
                imoveis={imoveisParaAcao.length > 0 ? imoveisParaAcao : imoveisRadar}
              />
            ),
            propostas: (
              <PropostasTab
                leadId={lead.id}
                propostas={propostas}
                negocios={negocios}
                imoveis={imoveisParaAcao.length > 0 ? imoveisParaAcao : imoveisRadar}
                perfis={perfis}
                perfilAtualId={perfilAtualId}
              />
            ),
            negocio: (
              <NegocioFechadoTab
                leadId={lead.id}
                negocios={negocios}
                perfis={perfis}
                perfilAtualId={perfilAtualId}
              />
            ),
            auditoria: <AuditoriaTab registros={auditoria} />,
          }}
        />
      </Suspense>
    </div>
  );
}
