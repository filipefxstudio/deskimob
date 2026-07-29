"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2, MessageCircle, Phone, Plus, Search } from "lucide-react";

import { TemperaturaBadge } from "@/components/leads/TemperaturaBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  linkImovel,
  registerProposta,
  searchImoveisForLead,
  updateLead,
} from "@/lib/actions/leads";
import {
  ETAPA_LEAD_LABELS,
  ETAPAS_LEAD,
  FINALIDADE_BUSCA_OPTIONS,
  TEMPERATURA_LEAD_LABELS,
} from "@/lib/constants/leads";
import {
  buildTelLink,
  buildWhatsAppLink,
  formatOrigemDisplay,
  formatTelefoneLead,
} from "@/lib/leads/format";
import { parseLeadObservacoes } from "@/lib/leads/observacoes";
import type { EtapaLead, Imovel, Lead, TemperaturaLead } from "@/types";

interface LeadDadosFormProps {
  lead: Lead;
  perfis: { id: string; nome: string }[];
  imoveisIndicados: Imovel[];
}

type ImovelSearchResult = Awaited<ReturnType<typeof searchImoveisForLead>>[number];

export function LeadDadosForm({ lead, perfis, imoveisIndicados }: LeadDadosFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { meta, texto } = useMemo(
    () => parseLeadObservacoes(lead.observacoes),
    [lead.observacoes],
  );

  const perfilFinanceiro = meta.perfil_financeiro ?? {};
  const responsavelNome = perfis.find((p) => p.id === meta.perfil_id)?.nome;

  const [temperatura, setTemperatura] = useState<TemperaturaLead>(lead.temperatura);
  const [etapa, setEtapa] = useState<EtapaLead>(lead.etapa);
  const [qualificado, setQualificado] = useState(
    lead.etapa === "qualificado" || lead.etapa === "visita_agendada",
  );
  const [perfilId, setPerfilId] = useState(meta.perfil_id ?? "");
  const [finalidade, setFinalidade] = useState(lead.finalidade_busca ?? "");
  const [tipoImovel, setTipoImovel] = useState(lead.tipo_imovel_busca ?? "");
  const [bairros, setBairros] = useState(lead.bairros_interesse?.join(", ") ?? "");
  const [quartos, setQuartos] = useState(lead.quartos_minimo?.toString() ?? "");
  const [valorMin, setValorMin] = useState<number | null>(lead.valor_minimo ?? null);
  const [valorMax, setValorMax] = useState<number | null>(lead.valor_maximo ?? null);
  const [prazo, setPrazo] = useState(lead.prazo_decisao ?? "");
  const [obsTexto, setObsTexto] = useState(texto);
  const [renda, setRenda] = useState(perfilFinanceiro.renda_mensal ?? "");
  const [entrada, setEntrada] = useState(perfilFinanceiro.valor_entrada ?? "");
  const [finAprovado, setFinAprovado] = useState(
    perfilFinanceiro.financiamento_aprovado ?? false,
  );
  const [possuiImovel, setPossuiImovel] = useState(
    perfilFinanceiro.possui_imovel_venda ?? false,
  );
  const [finObs, setFinObs] = useState(perfilFinanceiro.observacoes ?? "");

  const [buscaImovel, setBuscaImovel] = useState("");
  const [resultadosImovel, setResultadosImovel] = useState<ImovelSearchResult[]>([]);
  const [propostaImovelId, setPropostaImovelId] = useState("");
  const [propostaValor, setPropostaValor] = useState("");
  const [propostaStatus, setPropostaStatus] = useState("enviada");
  const [propostaObs, setPropostaObs] = useState("");

  const telLink = buildTelLink(lead.telefone);
  const waLink = buildWhatsAppLink(lead.telefone);

  function save(partial?: Parameters<typeof updateLead>[1]) {
    setError(null);
    setFeedback(null);

    startTransition(async () => {
      const result = await updateLead(lead.id, partial ?? {
        temperatura,
        etapa,
        qualificado,
        perfil_id: perfilId || null,
        finalidade_busca: finalidade || undefined,
        tipo_imovel_busca: tipoImovel,
        bairros_interesse: bairros
          ? bairros.split(",").map((b) => b.trim()).filter(Boolean)
          : [],
        quartos_minimo: quartos ? Number(quartos) : null,
        valor_minimo: valorMin,
        valor_maximo: valorMax,
        prazo_decisao: prazo || null,
        observacoes: obsTexto,
        perfil_financeiro: {
          renda_mensal: renda,
          valor_entrada: entrada,
          financiamento_aprovado: finAprovado,
          possui_imovel_venda: possuiImovel,
          observacoes: finObs,
        },
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setFeedback(result.message ?? "Salvo.");
      router.refresh();
    });
  }

  function handleBuscarImovel() {
    startTransition(async () => {
      const results = await searchImoveisForLead(buscaImovel);
      setResultadosImovel(results);
    });
  }

  function handleIndicarImovel(imovelId: string) {
    startTransition(async () => {
      const result = await linkImovel(lead.id, imovelId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setFeedback(result.message ?? "Imóvel indicado.");
      router.refresh();
    });
  }

  function handleProposta(event: React.FormEvent) {
    event.preventDefault();
    if (!propostaImovelId || !propostaValor) return;

    startTransition(async () => {
      const result = await registerProposta(lead.id, {
        imovel_id: propostaImovelId,
        valor: Number(propostaValor),
        status: propostaStatus,
        observacoes: propostaObs,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setPropostaValor("");
      setPropostaObs("");
      setFeedback(result.message ?? "Proposta registrada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {(lead.nome?.trim()?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-primary">
            {lead.nome?.trim() || "Lead sem nome"}
          </h2>
          <p className="text-sm text-muted-foreground">{formatTelefoneLead(lead.telefone)}</p>
          {lead.email ? (
            <p className="text-sm text-muted-foreground">{lead.email}</p>
          ) : null}
          {responsavelNome ? (
            <p className="mt-1 text-sm">
              Responsável: <span className="font-medium">{responsavelNome}</span>
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {telLink ? (
              <a href={telLink} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs">
                <Phone className="size-3.5" /> Ligar
              </a>
            ) : null}
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[#2DC653]/40 bg-[#2DC653]/10 px-3 py-1.5 text-xs text-[#1a7a34]"
              >
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
            ) : null}
          </div>
        </div>
        <TemperaturaBadge temperatura={lead.temperatura} />
      </div>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Status</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Temperatura</Label>
            <Select
              value={temperatura}
              onValueChange={(v) => {
                setTemperatura(v as TemperaturaLead);
                save({ temperatura: v as TemperaturaLead });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TEMPERATURA_LEAD_LABELS) as TemperaturaLead[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TEMPERATURA_LEAD_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select
              value={etapa}
              onValueChange={(v) => {
                setEtapa(v as EtapaLead);
                save({ etapa: v as EtapaLead });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS_LEAD.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ETAPA_LEAD_LABELS[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
          <Label htmlFor="qualificado">Qualificado</Label>
          <Switch
            id="qualificado"
            checked={qualificado}
            onCheckedChange={(checked) => {
              setQualificado(checked);
              save({ qualificado: checked });
            }}
          />
        </div>
        {perfis.length > 0 ? (
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={perfilId || "none"}
              onValueChange={(v) => {
                const next = v === "none" ? "" : v;
                setPerfilId(next);
                save({ perfil_id: next || null });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {perfis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Perfil financeiro</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Renda mensal</Label>
            <Input value={renda} onChange={(e) => setRenda(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor de entrada</Label>
            <Input value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={finAprovado} onCheckedChange={setFinAprovado} id="fin" />
            <Label htmlFor="fin">Financiamento aprovado</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={possuiImovel} onCheckedChange={setPossuiImovel} id="imovel-venda" />
            <Label htmlFor="imovel-venda">Possui imóvel à venda</Label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Observações financeiras</Label>
          <Textarea value={finObs} onChange={(e) => setFinObs(e.target.value)} rows={2} />
        </div>
        <Button type="button" variant="outline" onClick={() => save()} disabled={isPending}>
          Salvar perfil financeiro
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">O que busca</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Finalidade</Label>
            <Select value={finalidade} onValueChange={setFinalidade}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FINALIDADE_BUSCA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de imóvel</Label>
            <Input value={tipoImovel} onChange={(e) => setTipoImovel(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Bairros</Label>
            <Input value={bairros} onChange={(e) => setBairros(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quartos mín.</Label>
            <Input type="number" value={quartos} onChange={(e) => setQuartos(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor mín.</Label>
            <CurrencyInput value={valorMin} onChange={setValorMin} mode="filter" />
          </div>
          <div className="space-y-2">
            <Label>Valor máx.</Label>
            <CurrencyInput value={valorMax} onChange={setValorMax} mode="filter" />
          </div>
          <div className="space-y-2">
            <Label>Prazo decisão</Label>
            <Input value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={obsTexto} onChange={(e) => setObsTexto(e.target.value)} rows={2} />
        </div>
        <Button type="button" onClick={() => save()} disabled={isPending}>
          Salvar preferências
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary">Origem e cadastro</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Origem: {formatOrigemDisplay(lead.origem)}
        </p>
        <p className="text-sm text-muted-foreground">
          Cadastro: {new Date(lead.criado_em).toLocaleDateString("pt-BR")}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-primary">Imóveis indicados</h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline">
                <Plus className="size-4" /> Indicar imóvel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Indicar imóvel</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por título, código ou bairro"
                  value={buscaImovel}
                  onChange={(e) => setBuscaImovel(e.target.value)}
                />
                <Button type="button" onClick={handleBuscarImovel} disabled={isPending}>
                  <Search className="size-4" />
                </Button>
              </div>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {resultadosImovel.map((imovel) => (
                  <button
                    key={imovel.id}
                    type="button"
                    className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted"
                    onClick={() => handleIndicarImovel(imovel.id)}
                  >
                    <p className="font-medium">{imovel.titulo ?? imovel.codigo ?? "Imóvel"}</p>
                    <p className="text-muted-foreground">{imovel.bairro}</p>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {imoveisIndicados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum imóvel indicado.</p>
        ) : (
          <ul className="space-y-2">
            {imoveisIndicados.map((imovel) => (
              <li key={imovel.id}>
                <Link
                  href={`/dashboard/imoveis/${imovel.id}`}
                  className="text-sm font-medium text-secondary hover:underline"
                >
                  {imovel.titulo ?? imovel.codigo ?? "Imóvel"} — {imovel.bairro}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Registrar proposta</h3>
        <form onSubmit={handleProposta} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Imóvel (ID)</Label>
            <Input
              value={propostaImovelId}
              onChange={(e) => setPropostaImovelId(e.target.value)}
              placeholder="ID do imóvel ou selecione acima"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              value={propostaValor}
              onChange={(e) => setPropostaValor(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={propostaStatus} onValueChange={setPropostaStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="aceita">Aceita</SelectItem>
                <SelectItem value="recusada">Recusada</SelectItem>
                <SelectItem value="contraproposta">Contraproposta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea value={propostaObs} onChange={(e) => setPropostaObs(e.target.value)} rows={2} />
          </div>
          <Button type="submit" disabled={isPending}>Registrar proposta</Button>
        </form>
      </section>

      {feedback ? <p className="text-sm text-[#2DC653]">{feedback}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Salvando...
        </div>
      ) : null}
    </div>
  );
}
