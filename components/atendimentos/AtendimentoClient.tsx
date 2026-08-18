"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState, useTransition } from "react";

import { AtendimentoCardActions } from "@/components/atendimentos/AtendimentoCardActions";
import { AtendimentoModals } from "@/components/atendimentos/AtendimentoModals";
import { AtendimentoTabs } from "@/components/atendimentos/AtendimentoTabs";
import { AtendimentoDadosTab } from "@/components/atendimentos/AtendimentoDadosTab";
import { AuditoriaTab } from "@/components/atendimentos/AuditoriaTab";
import { ImoveisSelecionadosTab } from "@/components/atendimentos/ImoveisSelecionadosTab";
import { NegocioFechadoTab } from "@/components/atendimentos/NegocioFechadoTab";
import { PropostasTab } from "@/components/atendimentos/PropostasTab";
import { RadarImoveisTab } from "@/components/atendimentos/RadarImoveisTab";
import { VisitasTab } from "@/components/atendimentos/VisitasTab";
import { toast } from "@/hooks/use-toast";
import { marcarContatoFeito, qualificarLead } from "@/lib/actions/atendimentos";
import type { CorretorShareHost } from "@/lib/imoveis/share-url";
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
  podeExcluir: boolean;
  tiposImovel: TipoImovelCustom[];
  corretorSlug: string;
  corretorShareHost: CorretorShareHost;
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
  podeExcluir,
  tiposImovel,
  corretorSlug,
  corretorShareHost,
  statusList,
  faixaValorPercent = 20,
}: AtendimentoClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [descartarOpen, setDescartarOpen] = useState(false);
  const [transferirOpen, setTransferirOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);

  const imoveisParaAcao = imoveisSelecionados
    .map((s) => s.imovel)
    .filter((i): i is Imovel => Boolean(i));

  function runCardAction(action: () => Promise<{ error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      router.refresh();
    });
  }

  const headerActions = (
    <AtendimentoCardActions
      lead={lead}
      disabled={isPending}
      podeTransferir={podeTransferir}
      podeExcluir={podeExcluir}
      showAbrirAtendimento={false}
      onContatoFeito={() => runCardAction(() => marcarContatoFeito(lead.id))}
      onQualificar={() => runCardAction(() => qualificarLead(lead.id))}
      onDescartar={() => setDescartarOpen(true)}
      onTransferir={() => setTransferirOpen(true)}
      onExcluir={() => setExcluirOpen(true)}
    />
  );

  return (
    <>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
        <AtendimentoTabs
          headerActions={headerActions}
          panels={{
            dados: (
              <AtendimentoDadosTab
                lead={lead}
                perfis={perfis}
                tiposImovel={tiposImovel}
                motivos={motivos}
                podeTransferir={podeTransferir}
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
                corretorShareHost={corretorShareHost}
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

      <AtendimentoModals
        leadId={lead.id}
        leadNome={lead.nome}
        perfis={perfis}
        motivos={motivos}
        podeTransferir={podeTransferir}
        podeExcluir={podeExcluir}
        descartarOpen={descartarOpen}
        transferirOpen={transferirOpen}
        excluirOpen={excluirOpen}
        onDescartarOpenChange={setDescartarOpen}
        onTransferirOpenChange={setTransferirOpen}
        onExcluirOpenChange={setExcluirOpen}
      />
    </>
  );
}
