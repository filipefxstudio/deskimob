"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { DashboardAlertas } from "@/components/dashboard/DashboardAlertas";
import { DashboardBairroChart } from "@/components/dashboard/DashboardBairroChart";
import { DashboardCaptacoesChart } from "@/components/dashboard/DashboardCaptacoesChart";
import { DashboardContatosPorCorretorTable } from "@/components/dashboard/DashboardContatosPorCorretorTable";
import { DashboardContatosSkeleton } from "@/components/dashboard/DashboardContatosSkeleton";
import { DashboardFunil } from "@/components/dashboard/DashboardFunil";
import { DashboardImoveisDesatualizadosChart } from "@/components/dashboard/DashboardImoveisDesatualizadosChart";
import { DashboardKPIs } from "@/components/dashboard/DashboardKPIs";
import { DashboardLeadsContatadosCard } from "@/components/dashboard/DashboardLeadsContatadosCard";
import { DashboardOrigemChart } from "@/components/dashboard/DashboardOrigemChart";
import {
  DashboardPeriodFilter,
  type DashboardPeriodState,
} from "@/components/dashboard/DashboardPeriodFilter";
import { DashboardQualidadeChart } from "@/components/dashboard/DashboardQualidadeChart";
import { DashboardSectionHeading } from "@/components/dashboard/DashboardSectionHeading";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { DashboardTemperaturaChart } from "@/components/dashboard/DashboardTemperaturaChart";
import { DashboardTempoEntreContatosCard } from "@/components/dashboard/DashboardTempoEntreContatosCard";
import { DashboardTempoInteracaoChart } from "@/components/dashboard/DashboardTempoInteracaoChart";
import {
  getDashboardDataBothTabs,
  type DashboardData,
  type DashboardTab,
} from "@/lib/actions/dashboard";
import { PERIOD_PRESET_LABELS } from "@/lib/dashboard/period";

interface DashboardClientProps {
  statsVenda: DashboardData;
  statsLocacao: DashboardData;
  initialPeriod: DashboardPeriodState;
}

function periodoLabel(period: DashboardPeriodState): string {
  if (period.preset === "personalizado" && period.customStart && period.customEnd) {
    return `${period.customStart} – ${period.customEnd}`;
  }
  return PERIOD_PRESET_LABELS[period.preset];
}

export function DashboardClient({
  statsVenda: initialVenda,
  statsLocacao: initialLocacao,
  initialPeriod,
}: DashboardClientProps) {
  const [tab, setTab] = useState<DashboardTab>("venda");
  const [period, setPeriod] = useState<DashboardPeriodState>(initialPeriod);
  const [statsVenda, setStatsVenda] = useState(initialVenda);
  const [statsLocacao, setStatsLocacao] = useState(initialLocacao);
  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback((nextPeriod: DashboardPeriodState) => {
    startTransition(async () => {
      const result = await getDashboardDataBothTabs({
        periodPreset: nextPeriod.preset,
        customStart: nextPeriod.customStart || undefined,
        customEnd: nextPeriod.customEnd || undefined,
      });

      if (result.venda) setStatsVenda(result.venda);
      if (result.locacao) setStatsLocacao(result.locacao);
    });
  }, []);

  useEffect(() => {
    if (
      period.preset === initialPeriod.preset &&
      period.customStart === initialPeriod.customStart &&
      period.customEnd === initialPeriod.customEnd
    ) {
      return;
    }

    if (period.preset === "personalizado" && (!period.customStart || !period.customEnd)) {
      return;
    }

    fetchData(period);
  }, [period, initialPeriod, fetchData]);

  const stats = tab === "venda" ? statsVenda : statsLocacao;
  const finalidadeLabel = tab === "venda" ? "Venda" : "Locação";
  const periodLabel = useMemo(() => periodoLabel(period), [period]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <DashboardTabs activeTab={tab} onTabChange={setTab} />
        <DashboardPeriodFilter value={period} onChange={setPeriod} />
      </div>

      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Atualizando dados…
        </div>
      )}

      <section className="space-y-6">
        <DashboardSectionHeading
          title="Atendimentos"
          description="Leads, funil e produtividade de contato no período selecionado."
        />

        <DashboardKPIs kpis={stats.kpis} />

        {isPending ? (
          <DashboardContatosSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DashboardLeadsContatadosCard
              metricas={stats.contatoMetricas}
              periodoLabel={periodLabel}
              finalidadeLabel={finalidadeLabel}
            />
            <DashboardTempoEntreContatosCard metricas={stats.contatoMetricas} />
          </div>
        )}

        {stats.contatoMetricas.verTabelaCorretores && !isPending ? (
          <DashboardContatosPorCorretorTable rows={stats.contatoMetricas.porCorretor} />
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardFunil etapas={stats.funil} />
          <DashboardAlertas alertas={stats.alertas} />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardTemperaturaChart data={stats.temperatura} />
          <DashboardQualidadeChart data={stats.qualidade} />
          <DashboardOrigemChart items={stats.origem} />
          <DashboardTempoInteracaoChart data={stats.tempoInteracao} />
        </div>

        <DashboardBairroChart
          title="Bairros com mais leads"
          items={stats.bairrosLeads}
          emptyMessage="Sem leads ativos."
        />
      </section>

      <section className="space-y-6">
        <DashboardSectionHeading
          title="Imóveis"
          description="Captações, atualização e distribuição do estoque."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <DashboardCaptacoesChart data={stats.captacoes} />
          <DashboardImoveisDesatualizadosChart data={stats.imoveisDesatualizados} />
          <DashboardBairroChart
            title="Ranking imóveis por bairro"
            items={stats.rankingImoveisBairro}
            emptyMessage="Sem imóveis ativos."
          />
        </div>
      </section>
    </div>
  );
}
