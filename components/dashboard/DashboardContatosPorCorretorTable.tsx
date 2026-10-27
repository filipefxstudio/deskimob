"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardContatoPorCorretorItem } from "@/lib/actions/dashboard-contatos";
import { formatIntervaloContato } from "@/lib/dashboard/format-interval";
import { cn } from "@/lib/utils";

interface DashboardContatosPorCorretorTableProps {
  rows: DashboardContatoPorCorretorItem[];
}

const ALERTA_MS = 7 * 24 * 60 * 60 * 1000;

export function DashboardContatosPorCorretorTable({
  rows,
}: DashboardContatosPorCorretorTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Por corretor</CardTitle>
        <span className="text-xs text-muted-foreground">Visível só para gerente e admin</span>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Corretor</th>
              <th className="pb-2 pr-4 font-medium">Leads contatados</th>
              <th className="pb-2 font-medium">Tempo médio entre contatos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const lento =
                row.tempoMedioMs != null && row.tempoMedioMs > ALERTA_MS;
              return (
                <tr key={row.perfilId ?? row.nome} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 font-medium text-foreground">{row.nome}</td>
                  <td className="py-3 pr-4 tabular-nums">{row.leadsContatados}</td>
                  <td
                    className={cn(
                      "py-3 tabular-nums",
                      lento ? "font-medium text-[#F18F01]" : "text-foreground",
                    )}
                  >
                    {formatIntervaloContato(row.tempoMedioMs)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
