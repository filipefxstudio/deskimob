"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addInteracao } from "@/lib/actions/leads";
import type { TipoInteracao } from "@/types";

const TIPOS: { value: TipoInteracao; label: string }[] = [
  { value: "ligacao", label: "Ligação" },
  { value: "mensagem_whatsapp", label: "WhatsApp" },
  { value: "visita", label: "Visita" },
  { value: "email", label: "E-mail" },
  { value: "anotacao", label: "Anotação" },
];

interface InteracaoFormProps {
  leadId: string;
  onSuccess?: () => void;
}

export function InteracaoForm({ leadId, onSuccess }: InteracaoFormProps) {
  const [tipo, setTipo] = useState<TipoInteracao>("anotacao");
  const [descricao, setDescricao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await addInteracao(leadId, {
        tipo,
        descricao,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setDescricao("");
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold text-primary">Registrar interação</h3>

      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoInteracao)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          required
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" loading={isPending} loadingText="Registrando...">
        Registrar
      </Button>
    </form>
  );
}
