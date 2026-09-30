"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { createAgendaItem, searchLeadsForAgenda } from "@/lib/actions/agenda";
import { TIPOS_COMPROMISSO } from "@/lib/constants/agenda";
import { parseLocalDateTimeInput } from "@/lib/dates/format";
import type { TipoAgenda } from "@/types";

type LeadSearchResult = Awaited<ReturnType<typeof searchLeadsForAgenda>>[number];

interface AgendarAtividadeFormProps {
  leadId?: string;
  leadNome?: string;
  requireFuture?: boolean;
  onSuccess?: () => void;
  submitLabel?: string;
  className?: string;
}

export function AgendarAtividadeForm({
  leadId: leadIdProp,
  leadNome: leadNomeProp,
  requireFuture = false,
  onSuccess,
  submitLabel = "Agendar atividade",
  className,
}: AgendarAtividadeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isSearching, startSearch] = useTransition();

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoAgenda>("ligacao");
  const [dataAtividade, setDataAtividade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [lembreteEmail, setLembreteEmail] = useState(false);

  const [leadId, setLeadId] = useState(leadIdProp ?? "");
  const [leadNome, setLeadNome] = useState(leadNomeProp ?? "");
  const [buscaLead, setBuscaLead] = useState("");
  const [resultadosLead, setResultadosLead] = useState<LeadSearchResult[]>([]);

  const showLeadSelector = !leadIdProp;

  useEffect(() => {
    if (leadIdProp) {
      setLeadId(leadIdProp);
      setLeadNome(leadNomeProp ?? "");
    }
  }, [leadIdProp, leadNomeProp]);

  useEffect(() => {
    if (!showLeadSelector || !buscaLead.trim() || leadId) {
      setResultadosLead([]);
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        const data = await searchLeadsForAgenda(buscaLead);
        setResultadosLead(data);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [buscaLead, leadId, showLeadSelector]);

  function selecionarLead(lead: LeadSearchResult) {
    setLeadId(lead.id);
    setLeadNome(lead.nome);
    setBuscaLead("");
    setResultadosLead([]);
  }

  function limparLead() {
    setLeadId("");
    setLeadNome("");
    setBuscaLead("");
    setResultadosLead([]);
  }

  function resetForm() {
    setTitulo("");
    setTipo("ligacao");
    setDataAtividade("");
    setDescricao("");
    setLembreteEmail(false);
    if (!leadIdProp) {
      limparLead();
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!titulo.trim() || !dataAtividade) {
      toast({ variant: "destructive", title: "Preencha título e data." });
      return;
    }

    if (requireFuture) {
      try {
        const utc = parseLocalDateTimeInput(dataAtividade);
        if (new Date(utc) <= new Date()) {
          toast({
            variant: "destructive",
            title: "Informe uma data e hora futuras.",
          });
          return;
        }
      } catch {
        toast({ variant: "destructive", title: "Data ou hora inválida." });
        return;
      }
    }

    startTransition(async () => {
      const result = await createAgendaItem({
        titulo,
        tipo,
        data_atividade: dataAtividade,
        descricao,
        lembrete_email: lembreteEmail,
        lead_id: leadId || undefined,
      });

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }

      toast({ title: result.message });
      resetForm();
      onSuccess?.();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 rounded-xl border border-border bg-card p-4 ${className ?? ""}`}
    >
      <h3 className="font-semibold text-primary">Agendar atividade</h3>

      {showLeadSelector ? (
        <div className="space-y-2">
          <Label>Atendimento (opcional)</Label>
          {leadId ? (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="truncate text-sm font-medium">{leadNome}</span>
              <Button type="button" variant="ghost" size="sm" onClick={limparLead}>
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex min-w-0 gap-2">
                <Input
                  className="min-w-0 flex-1"
                  value={buscaLead}
                  onChange={(e) => setBuscaLead(e.target.value)}
                  placeholder="Buscar por nome, código ou telefone…"
                />
                {isSearching ? <Loader2 className="size-4 animate-spin self-center" /> : null}
              </div>
              {resultadosLead.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
                  {resultadosLead.map((lead) => (
                    <li key={lead.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => selecionarLead(lead)}
                      >
                        <Search className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          <span className="font-medium">{lead.nome}</span>
                          {lead.codigo_atendimento ? (
                            <span className="text-muted-foreground"> · {lead.codigo_atendimento}</span>
                          ) : null}
                          {lead.telefone ? (
                            <span className="block text-xs text-muted-foreground">{lead.telefone}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      ) : leadNome ? (
        <p className="text-sm text-muted-foreground">
          Atendimento: <span className="font-medium text-foreground">{leadNome}</span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agendar-titulo">Título</Label>
          <Input
            id="agendar-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAgenda)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_COMPROMISSO.map((t) => (
                <SelectItem key={t.slug} value={t.slug}>
                  {t.icone} {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agendar-data">Data e hora</Label>
        <Input
          id="agendar-data"
          type="datetime-local"
          value={dataAtividade}
          onChange={(e) => setDataAtividade(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="agendar-desc">Descrição (opcional)</Label>
        <Textarea
          id="agendar-desc"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={lembreteEmail}
          onChange={(e) => setLembreteEmail(e.target.checked)}
        />
        Enviar lembrete por e-mail
      </label>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : submitLabel}
      </Button>
    </form>
  );
}
