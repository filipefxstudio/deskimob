"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDashboardConfig } from "@/lib/actions/dashboard-config";
import type { DashboardConfig } from "@/types";

interface AbaFunilProps {
  initialConfig: DashboardConfig;
}

export function AbaFunil({ initialConfig }: AbaFunilProps) {
  const [leadsVerde, setLeadsVerde] = useState(initialConfig.leads_verde_dias);
  const [leadsAmarelo, setLeadsAmarelo] = useState(initialConfig.leads_amarelo_dias);
  const [imoveisVerde, setImoveisVerde] = useState(initialConfig.imoveis_verde_dias);
  const [imoveisAmarelo, setImoveisAmarelo] = useState(initialConfig.imoveis_amarelo_dias);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await saveDashboardConfig({
        leads_verde_dias: leadsVerde,
        leads_amarelo_dias: leadsAmarelo,
        imoveis_verde_dias: imoveisVerde,
        imoveis_amarelo_dias: imoveisAmarelo,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setFeedback(result.message ?? "Configuração salva.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil e alertas</CardTitle>
        <CardDescription>
          Configure os limites de dias usados nos alertas de inatividade de leads e imóveis
          desatualizados no dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSave} className="max-w-md space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-primary">
              Leads — tempo sem interação
            </legend>
            <p className="text-xs text-muted-foreground">
              Verde: 0 até o limite verde · Amarelo: até o limite amarelo · Vermelho: acima
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leads-verde">Verde (até)</Label>
                <Input
                  id="leads-verde"
                  type="number"
                  min={0}
                  max={90}
                  value={leadsVerde}
                  onChange={(e) => setLeadsVerde(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">dias (padrão: 5)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leads-amarelo">Amarelo (até)</Label>
                <Input
                  id="leads-amarelo"
                  type="number"
                  min={1}
                  max={180}
                  value={leadsAmarelo}
                  onChange={(e) => setLeadsAmarelo(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">dias (padrão: 10, acima = vermelho)</p>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-primary">
              Imóveis — desatualização
            </legend>
            <p className="text-xs text-muted-foreground">
              Verde: 0–30 · Amarelo: 31–45 · Vermelho: acima de 45 (valores padrão)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="imoveis-verde">Verde (até)</Label>
                <Input
                  id="imoveis-verde"
                  type="number"
                  min={0}
                  max={365}
                  value={imoveisVerde}
                  onChange={(e) => setImoveisVerde(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">dias (padrão: 30)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="imoveis-amarelo">Amarelo (até)</Label>
                <Input
                  id="imoveis-amarelo"
                  type="number"
                  min={1}
                  max={730}
                  value={imoveisAmarelo}
                  onChange={(e) => setImoveisAmarelo(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">dias (padrão: 45, acima = vermelho)</p>
              </div>
            </div>
          </fieldset>

          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Salvar alertas
          </Button>

          {feedback ? <p className="text-sm text-success">{feedback}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>

        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Em breve você poderá personalizar as etapas do funil, renomear colunas do kanban e
          definir regras automáticas de avanço entre etapas.
        </div>
      </CardContent>
    </Card>
  );
}
