"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  addStatusImovel,
  deleteStatusImovel,
  updateStatusImovel,
} from "@/lib/actions/configuracoes";
import type { StatusImovel } from "@/types";

interface AbaStatusImovelProps {
  statusList: StatusImovel[];
}

export function AbaStatusImovel({ statusList: initialStatus }: AbaStatusImovelProps) {
  const [statusList, setStatusList] = useState(initialStatus);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState("#7D8750");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await addStatusImovel({ nome: novoNome, cor: novaCor });

      if (result.error) {
        setError(result.error);
        return;
      }

      setStatusList((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          corretor_id: "",
          nome: novoNome.trim(),
          cor: novaCor,
          padrao: false,
          ativo: true,
          ordem: prev.length + 1,
          criado_em: new Date().toISOString(),
        },
      ]);
      setNovoNome("");
      setFeedback(result.message ?? "Status adicionado.");
    });
  }

  function handleToggle(id: string, ativo: boolean) {
    startTransition(async () => {
      const result = await updateStatusImovel(id, { ativo });

      if (result.error) {
        setError(result.error);
        return;
      }

      setStatusList((prev) =>
        prev.map((status) => (status.id === id ? { ...status, ativo } : status)),
      );
    });
  }

  function handleColorChange(id: string, cor: string) {
    startTransition(async () => {
      const result = await updateStatusImovel(id, { cor });

      if (result.error) {
        setError(result.error);
        return;
      }

      setStatusList((prev) =>
        prev.map((status) => (status.id === id ? { ...status, cor } : status)),
      );
    });
  }

  function handleDelete(id: string, padrao: boolean) {
    if (padrao) {
      setError("Status padrão não podem ser excluídos. Desative-o em vez disso.");
      return;
    }

    startTransition(async () => {
      const result = await deleteStatusImovel(id);

      if (result.error) {
        setError(result.error);
        return;
      }

      setStatusList((prev) => prev.filter((status) => status.id !== id));
      setFeedback("Status excluído.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status de imóvel</CardTitle>
        <CardDescription>
          Personalize os status exibidos nos cards e filtros. Status padrão podem ser desativados,
          mas não excluídos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {statusList.map((status) => (
            <li
              key={status.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: status.cor }}
                />
                <div>
                  <p className={status.ativo ? "font-medium" : "text-muted-foreground line-through"}>
                    {status.nome}
                  </p>
                  {status.padrao ? (
                    <p className="text-xs text-muted-foreground">Padrão</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={status.cor}
                  onChange={(event) => handleColorChange(status.id, event.target.value)}
                  disabled={isPending}
                  className="size-8 cursor-pointer rounded border border-border"
                  aria-label={`Cor do status ${status.nome}`}
                />
                <Switch
                  checked={status.ativo}
                  onCheckedChange={(checked) => handleToggle(status.id, checked)}
                  disabled={isPending}
                  aria-label={`Ativar ${status.nome}`}
                />
                {!status.padrao ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(status.id, status.padrao)}
                    disabled={isPending}
                  >
                    Excluir
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Nome do novo status"
              value={novoNome}
              onChange={(event) => setNovoNome(event.target.value)}
              disabled={isPending}
            />
          </div>
          <input
            type="color"
            value={novaCor}
            onChange={(event) => setNovaCor(event.target.value)}
            disabled={isPending}
            className="size-10 cursor-pointer rounded border border-border"
            aria-label="Cor do novo status"
          />
          <Button type="submit" disabled={isPending || !novoNome.trim()}>
            {isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Plus className="size-4" data-icon="inline-start" />
            )}
            Novo status
          </Button>
        </form>

        {feedback ? <p className="text-sm text-green-600">{feedback}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
