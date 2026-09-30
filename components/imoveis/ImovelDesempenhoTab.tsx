"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DESKIMOB, DESKIMOB_CHART_BAR_PALETTE } from "@/lib/design/deskimob-tokens";
import type { ImovelDesempenho } from "@/types";

function parecerBarColor(parecer: string): string {
  if (parecer === "positivo") return DESKIMOB.olive;
  if (parecer === "negativo") return DESKIMOB.error;
  return DESKIMOB.charcoal;
}

interface ImovelDesempenhoTabProps {
  desempenho: ImovelDesempenho;
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function ImovelDesempenhoTab({ desempenho }: ImovelDesempenhoTabProps) {
  const { kpis, funil, origem, visitasParecer } = desempenho;
  const funilComDados = funil.filter((item) => item.total > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Leads relacionados" value={kpis.totalLeads} />
        <KpiCard label="Visitas agendadas" value={kpis.visitasAgendadas} />
        <KpiCard label="Visitas realizadas" value={kpis.visitasRealizadas} />
        <KpiCard label="Propostas" value={kpis.propostas} />
        <KpiCard label="Negócios fechados" value={kpis.negociosFechados} />
        <KpiCard label="Visualizações" value={kpis.visualizacoes} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h4 className="mb-4 text-sm font-semibold">Funil de leads</h4>
          {funilComDados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de funil ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={funilComDados} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill={DESKIMOB.orange} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <h4 className="mb-4 text-sm font-semibold">Origem dos leads</h4>
          {origem.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados de origem ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={origem}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {origem.map((entry, index) => (
                    <Cell
                      key={entry.origem}
                      fill={DESKIMOB_CHART_BAR_PALETTE[index % DESKIMOB_CHART_BAR_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h4 className="mb-4 text-sm font-semibold">Parecer das visitas</h4>
        <div className="space-y-3">
          {visitasParecer.map((item, index) => {
            const max = Math.max(...visitasParecer.map((v) => v.total), 1);
            const width = `${Math.round((item.total / max) * 100)}%`;
            return (
              <div key={item.parecer} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="text-muted-foreground">{item.total}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width,
                      backgroundColor: parecerBarColor(item.parecer),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
