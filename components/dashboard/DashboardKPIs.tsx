"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardKPIFormat, DashboardKPIItem } from "@/lib/actions/dashboard";
import { cn } from "@/lib/utils";

function useCountUp(target: number, duration = 1000) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = display;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

function formatKPIValue(value: number, format: DashboardKPIFormat): string {
  if (format === "currency") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }

  if (format === "duration") {
    if (value <= 0) return "—";
    const totalMinutes = Math.round(value / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }

  return Math.round(value).toLocaleString("pt-BR");
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-10 items-end gap-0.5">
      {values.map((value, index) => (
        <div
          key={index}
          className="w-1.5 origin-bottom rounded-sm bg-brand/45 animate-in fade-in slide-in-from-bottom-2"
          style={{
            height: `${Math.max((value / max) * 100, value > 0 ? 12 : 4)}%`,
            animationDelay: `${index * 60}ms`,
            animationFillMode: "backwards",
          }}
        />
      ))}
    </div>
  );
}

interface DashboardKPIsProps {
  kpis: DashboardKPIItem[];
}

function KPICard({ kpi }: { kpi: DashboardKPIItem }) {
  const countUp = useCountUp(kpi.format === "number" ? kpi.value : 0);
  const animated = kpi.format === "number" ? countUp : kpi.value;

  const change = kpi.changePercent;
  const isPositive = change !== null && change >= 0;
  const invertChange = kpi.id === "tempo-primeiro-contato";

  const content = (
    <Card className="border-border/80 transition-shadow hover:shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{kpi.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {formatKPIValue(animated, kpi.format)}
          </p>
          {change !== null && (
            <p
              className={cn(
                "mt-1 flex items-center gap-0.5 text-xs font-medium",
                invertChange
                  ? isPositive
                    ? "text-destructive"
                    : "text-success"
                  : isPositive
                    ? "text-success"
                    : "text-destructive",
              )}
            >
              {isPositive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {Math.abs(change).toFixed(1)}% vs período anterior
            </p>
          )}
          {change === null && kpi.previousValue === 0 && kpi.value > 0 && (
            <p className="mt-1 text-xs font-medium text-success">Novo no período</p>
          )}
        </div>
        <Sparkline values={kpi.sparkline} />
      </CardContent>
    </Card>
  );

  return kpi.href ? (
    <Link href={kpi.href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export function DashboardKPIs({ kpis }: DashboardKPIsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map((kpi) => (
        <KPICard key={kpi.id} kpi={kpi} />
      ))}
    </section>
  );
}
