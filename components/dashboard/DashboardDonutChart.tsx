"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardChartSlice } from "@/lib/actions/dashboard";

interface DashboardDonutChartProps {
  title: string;
  data: DashboardChartSlice[];
  centerLabel?: string;
  centerValue?: string | number;
}

export function DashboardDonutChart({
  title,
  data,
  centerLabel,
  centerValue,
}: DashboardDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = data.filter((item) => item.value > 0);

  return (
    <Card className="h-full border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.length > 0 ? chartData : data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  isAnimationActive
                >
                  {(chartData.length > 0 ? chartData : data).map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [Number(value ?? 0), ""]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {(centerLabel || centerValue !== undefined) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                {centerValue !== undefined && (
                  <span className="text-2xl font-bold tabular-nums text-foreground">{centerValue}</span>
                )}
                {centerLabel && (
                  <span className="text-xs text-muted-foreground">{centerLabel}</span>
                )}
              </div>
            )}
          </div>
        )}
        <ul className="mt-3 space-y-2">
          {data.map((item) => {
            const content = (
              <li key={item.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-foreground">{item.label}</span>
                </span>
                <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
              </li>
            );

            return item.href ? (
              <Link key={item.label} href={item.href} className="block hover:opacity-80">
                {content}
              </Link>
            ) : (
              content
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
