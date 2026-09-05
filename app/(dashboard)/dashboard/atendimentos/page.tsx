import type { Metadata } from "next";

import { AtendimentosPage } from "@/components/atendimentos/AtendimentosPage";
import type { LeadsFilterState } from "@/components/leads/LeadsFilters";
import {
  getMotivosDescarte,
  podeExcluirAtendimento,
  podeTransferirAtendimento,
} from "@/lib/actions/atendimentos";
import { getDashboardConfig } from "@/lib/actions/dashboard-config";
import { getTiposImovelCustom } from "@/lib/actions/configuracoes";
import {
  getLeads,
  getMidiasOrigem,
  getPerfisForLeads,
} from "@/lib/actions/leads";
import { DEFAULT_DASHBOARD_CONFIG } from "@/lib/constants/dashboard";
import { CorretorUnavailableMessage } from "@/components/dashboard/CorretorUnavailableMessage";
import {
  getCorretorForDashboardPage,
} from "@/lib/supabase/require-corretor-page";
import type { EtapaLead, SituacaoLead, TemperaturaLead } from "@/types";
import { isEtapaLead } from "@/lib/constants/leads";

export const metadata: Metadata = {
  title: "Atendimentos | Deskimob",
  description: "Gestão de atendimentos do corretor",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseInitialFilters(
  params: Record<string, string | string[] | undefined>,
): Partial<LeadsFilterState> {
  const filters: Partial<LeadsFilterState> = {};

  const etapa = typeof params.etapa === "string" ? params.etapa : undefined;
  if (etapa && isEtapaLead(etapa)) {
    filters.etapa = etapa as EtapaLead;
  }

  const temperatura =
    typeof params.temperatura === "string" ? params.temperatura : undefined;
  if (temperatura === "quente" || temperatura === "morno" || temperatura === "frio" || temperatura === "indefinido") {
    filters.temperatura = temperatura as TemperaturaLead;
  }

  const finalidade =
    typeof params.finalidade === "string" ? params.finalidade : undefined;
  if (finalidade === "compra" || finalidade === "locacao") {
    filters.finalidade = finalidade;
  }

  const semInteracao =
    typeof params.sem_interacao === "string" ? Number(params.sem_interacao) : undefined;
  if (semInteracao && !Number.isNaN(semInteracao)) {
    filters.semInteracaoDias = semInteracao;
  }

  const situacao = typeof params.situacao === "string" ? params.situacao : undefined;
  if (situacao === "todas") {
    filters.situacao = "todas";
  } else if (
    situacao === "em_atendimento" ||
    situacao === "descartado" ||
    situacao === "negocio_fechado"
  ) {
    filters.situacao = situacao as SituacaoLead;
  }

  if (params.qualificados === "1" || params.qualificados === "true") {
    filters.apenasQualificados = true;
  }

  const origem = typeof params.origem === "string" ? params.origem : undefined;
  if (origem && origem !== "all") {
    filters.origem = origem;
  }

  return filters;
}

export default async function AtendimentosRoutePage({ searchParams }: PageProps) {
  const access = await getCorretorForDashboardPage();

  if (!access.corretor) {
    return access.showUnavailable ? <CorretorUnavailableMessage /> : null;
  }

  const { corretor } = access;

  const params = await searchParams;
  const initialFilters = parseInitialFilters(params);

  const initialBusca = typeof params.busca === "string" ? params.busca : "";

  const [leads, midias, perfis, motivos, podeTransferir, podeExcluir, tiposImovel, dashboardConfig] =
    await Promise.all([
    getLeads({ ativos_apenas: false }),
    getMidiasOrigem(),
    getPerfisForLeads(),
    getMotivosDescarte(),
    podeTransferirAtendimento(),
    podeExcluirAtendimento(),
    getTiposImovelCustom(),
    getDashboardConfig(),
  ]);

  const alertConfig = {
    leads_verde_dias:
      dashboardConfig?.leads_verde_dias ?? DEFAULT_DASHBOARD_CONFIG.leads_verde_dias,
    leads_amarelo_dias:
      dashboardConfig?.leads_amarelo_dias ?? DEFAULT_DASHBOARD_CONFIG.leads_amarelo_dias,
  };

  return (
    <div className="flex-1 p-4 md:p-6">
      <AtendimentosPage
        initialLeads={leads}
        corretorId={corretor.id}
        midias={midias}
        perfis={perfis}
        motivos={motivos}
        podeTransferir={podeTransferir}
        podeExcluir={podeExcluir}
        alertConfig={alertConfig}
        initialFilters={initialFilters}
        initialBusca={initialBusca}
        tiposImovel={tiposImovel}
      />
    </div>
  );
}
