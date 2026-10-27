"use client";

import { Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardContatoMetricas } from "@/lib/actions/dashboard-contatos";
import { formatIntervaloContato } from "@/lib/dashboard/format-interval";
import { cn } from "@/lib/utils";

interface DashboardTempoEntreContatosCardProps {
  metricas: DashboardContatoMetricas;
}

const FAIXA_CORES = {
  default: "#2E86AB",
  alerta: "#F18F01",
} as const;

export function DashboardTempoEntreContatosCard({
  metricas,
}: DashboardTempoEntreContatosCardProps) {
  const hasIntervalos = metricas.intervalosTotal > 0;

  return (
    <Card className="h-full border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="size-4 text-brand" />
          Tempo médio entre contatos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasIntervalos ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            É necessário pelo menos duas tentativas com o mesmo lead para calcular intervalos.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-3xl font-bold tabular-nums text-foreground">
                {formatIntervaloContato(metricas.tempoMedioMs)}
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  mediana {formatIntervaloContato(metricas.tempoMedianoMs)}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Intervalo entre tentativas com o mesmo lead
              </p>
            </div>
            <div className="space-y-3">
              {metricas.faixas.map((faixa) => (
                <div key={faixa.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{faixa.label}</span>
                    <span className="tabular-nums text-foreground">
                      {Math.round(faixa.percent)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all")}
                      style={{
                        width: `${Math.max(faixa.percent, faixa.count > 0 ? 4 : 0)}%`,
                        backgroundColor: faixa.alerta ? FAIXA_CORES.alerta : FAIXA_CORES.default,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
