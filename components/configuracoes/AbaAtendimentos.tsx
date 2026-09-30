"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteMotivoDescarte,
  getMotivosDescarte,
  saveAtendimentoConfig,
  saveMotivoDescarte,
} from "@/lib/actions/atendimentos";
import { DEFAULT_FICHA_VISITA_TEXTO } from "@/lib/constants/atendimentos";
import type { AtendimentoConfig, MotivoDescarte } from "@/types";

interface AbaAtendimentosProps {
  initialConfig: AtendimentoConfig | null;
  initialMotivos: MotivoDescarte[];
}

export function AbaAtendimentos({ initialConfig, initialMotivos }: AbaAtendimentosProps) {
  const [faixaPercent, setFaixaPercent] = useState(initialConfig?.faixa_valor_percent ?? 20);
  const [fichaTexto, setFichaTexto] = useState(
    initialConfig?.ficha_visita_texto ?? DEFAULT_FICHA_VISITA_TEXTO,
  );
  const [motivos, setMotivos] = useState(initialMotivos);
  const [novoMotivo, setNovoMotivo] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSaveConfig(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);
    startTransition(async () => {
      const result = await saveAtendimentoConfig({
        faixa_valor_percent: faixaPercent,
        ficha_visita_texto: fichaTexto,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedback(result.message ?? "Salvo.");
    });
  }

  function handleAddMotivo() {
    if (!novoMotivo.trim()) return;
    startTransition(async () => {
      const result = await saveMotivoDescarte({ nome: novoMotivo.trim() });
      if (result.error) {
        setError(result.error);
        return;
      }
      setNovoMotivo("");
      const updated = await getMotivosDescarte();
      setMotivos(updated);
      setFeedback("Motivo adicionado.");
    });
  }

  function toggleMotivo(motivo: MotivoDescarte) {
    startTransition(async () => {
      await saveMotivoDescarte({ id: motivo.id, nome: motivo.nome, ativo: !motivo.ativo });
      const updated = await getMotivosDescarte();
      setMotivos(updated);
    });
  }

  function excluirMotivo(id: string) {
    startTransition(async () => {
      await deleteMotivoDescarte(id);
      const updated = await getMotivosDescarte();
      setMotivos(updated);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Atendimentos</CardTitle>
          <CardDescription>
            Faixa de valor para auto-preenchimento e template da ficha de visita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveConfig} className="max-w-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor="faixa">Faixa de valor (%)</Label>
              <Input
                id="faixa"
                type="number"
                min={5}
                max={50}
                value={faixaPercent}
                onChange={(e) => setFaixaPercent(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Usado ao vincular imóvel de interesse no novo atendimento (padrão: 20%).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ficha">Texto da ficha de visita</Label>
              <Textarea
                id="ficha"
                rows={8}
                value={fichaTexto}
                onChange={(e) => setFichaTexto(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{{cliente_nome}}"}, {"{{cliente_telefone}}"}, {"{{data_visita}}"},
                {" {{imoveis_lista}}"}, {"{{observacoes}}"}, {"{{corretor_nome}}"}
              </p>
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar configuração"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Motivos de descarte</CardTitle>
          <CardDescription>Usados ao descartar um atendimento na listagem ou detalhe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Novo motivo"
              value={novoMotivo}
              onChange={(e) => setNovoMotivo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddMotivo())}
            />
            <Button type="button" onClick={handleAddMotivo} disabled={isPending}>
              <Plus className="size-4" />
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {motivos.map((motivo) => (
              <li key={motivo.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Switch checked={motivo.ativo} onCheckedChange={() => toggleMotivo(motivo)} />
                  <span className={motivo.ativo ? "" : "text-muted-foreground line-through"}>
                    {motivo.nome}
                  </span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => excluirMotivo(motivo.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {feedback ? <p className="text-sm text-success">{feedback}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
