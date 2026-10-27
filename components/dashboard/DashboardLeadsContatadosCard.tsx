"use client";

import { ArrowDown, ArrowUp, Phone } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardContatoMetricas } from "@/lib/actions/dashboard-contatos";
import { cn } from "@/lib/utils";

interface DashboardLeadsContatadosCardProps {
  metricas: DashboardContatoMetricas;
  periodoLabel: string;
  finalidadeLabel: string;
}

export function DashboardLeadsContatadosCard({
  metricas,
  periodoLabel,
  finalidadeLabel,
}: DashboardLeadsContatadosCardProps) {
  const change = metricas.changePercent;
  const isPositive = change !== null && change >= 0;
  const chartData = metricas.serieDiaria.map((item) => ({
    ...item,
    name: item.label,
  }));
  const hasData =
    metricas.leadsContatados > 0 ||
    metricas.serieDiaria.some((item) => item.total > 0);

  return (
    <Card className="h-full border-border/80">
      <CardHeader className="space-y-3 pb-2">
        <p className="text-xs text-muted-foreground">
          Período: {periodoLabel} · {finalidadeLabel}
        </p>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Phone className="size-4 text-brand" />
          Leads contatados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma tentativa de contato registrada no período.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <p className="text-4xl font-bold tabular-nums text-foreground">
                {metricas.leadsContatados}
              </p>
              {change !== null && (
                <p
                  className={cn(
                    "flex items-center gap-0.5 pb-1 text-sm font-medium",
                    isPositive ? "text-success" : "text-destructive",
                  )}
                >
                  {isPositive ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  {Math.abs(change).toFixed(1)}% vs período anterior
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Pessoas diferentes que você tentou contatar
            </p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    interval={chartData.length > 16 ? Math.floor(chartData.length / 8) : 0}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    formatter={(value) => [Number(value ?? 0), "Leads"]}
                    labelFormatter={(label) => `Dia ${label}`}
                    contentStyle={{ borderRadius: 8, fontSize: 13 }}
                  />
                  <Bar
                    dataKey="total"
                    fill="#2E86AB"
                    radius={[4, 4, 0, 0]}
                    minPointSize={2}
                    isAnimationActive
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-muted-foreground">Por dia</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
