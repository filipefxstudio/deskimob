"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardFunilItem } from "@/lib/actions/dashboard";
import { DESKIMOB } from "@/lib/design/deskimob-tokens";

interface DashboardFunilProps {
  etapas: DashboardFunilItem[];
}

export function DashboardFunil({ etapas }: DashboardFunilProps) {
  const router = useRouter();
  const chartData = etapas.map((e) => ({ ...e, name: e.label }));

  return (
    <Card className="h-full border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Funil de vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [Number(value ?? 0), "Leads"]}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Bar
                dataKey="count"
                radius={[0, 6, 6, 0]}
                isAnimationActive
                cursor="pointer"
                onClick={(data) => {
                  const payload = data as { payload?: DashboardFunilItem };
                  if (payload.payload?.href) {
                    router.push(payload.payload.href);
                  }
                }}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.id} fill={DESKIMOB.orange} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 space-y-1">
          {etapas.map((etapa) => (
            <li key={etapa.id}>
              <Link
                href={etapa.href}
                className="flex items-center justify-between text-sm hover:text-brand"
              >
                <span>{etapa.label}</span>
                <span className="font-semibold tabular-nums">{etapa.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
