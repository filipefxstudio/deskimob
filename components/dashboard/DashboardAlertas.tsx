import Link from "next/link";
import { AlertTriangle, Calendar, Camera, Clock, Home } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAlertaItem } from "@/lib/actions/dashboard";
import { cn } from "@/lib/utils";

interface DashboardAlertasProps {
  alertas: DashboardAlertaItem[];
}

const iconById: Record<string, typeof AlertTriangle> = {
  "agenda-hoje": Calendar,
  "visitas-24h": Calendar,
  "leads-sem-contato": Clock,
  "sem-foto": Camera,
  "imoveis-desatualizados": Home,
};

const styleMap = {
  warning: "text-brand bg-brand/10",
  info: "text-foreground bg-muted/50",
  danger: "text-destructive bg-destructive/10",
} as const;

export function DashboardAlertas({ alertas }: DashboardAlertasProps) {
  return (
    <Card className="h-full border-border/80">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Alertas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
        ) : (
          alertas.map((alerta) => {
            const Icon = iconById[alerta.id] ?? AlertTriangle;

            return (
              <div
                key={alerta.id}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3"
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    styleMap[alerta.tipo],
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{alerta.mensagem}</p>
                  <Link
                    href={alerta.href}
                    className="mt-1 inline-block text-sm font-medium text-brand hover:underline"
                  >
                    {alerta.acaoLabel} →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
