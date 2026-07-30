"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  ImovelInteresseAutocomplete,
  imovelToSearchResult,
  type ImovelSearchResult,
} from "@/components/atendimentos/ImovelInteresseAutocomplete";
import { BairrosInteresseInput } from "@/components/atendimentos/BairrosInteresseInput";
import { AgendarAtividadeForm } from "@/components/agenda/AgendarAtividadeForm";
import { InteracaoForm } from "@/components/leads/InteracaoForm";
import { LeadHistorico } from "@/components/leads/LeadHistorico";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  descartarAtendimento,
  desqualificarLead,
  qualificarLead,
  updateAtendimentoDados,
} from "@/lib/actions/atendimentos";
import {
  interesseFormStateVazio,
  useAplicarInteresseFromImovel,
} from "@/lib/atendimentos/aplicar-interesse-imovel";
import { SITUACAO_LEAD_LABELS } from "@/lib/constants/atendimentos";
import {
  ETAPA_LEAD_LABELS,
  ETAPAS_ATENDIMENTO,
  FINALIDADE_BUSCA_OPTIONS,
  TEMPERATURA_LEAD_LABELS,
} from "@/lib/constants/leads";
import {
  etapaParaSelectAtendimento,
  formatOrigemDisplay,
  formatTempoPrimeiraResposta,
  isLeadQualificado,
} from "@/lib/leads/format";
import { parseLeadObservacoes, serializeLeadObservacoes } from "@/lib/leads/observacoes";
import { toast } from "@/hooks/use-toast";
import { isValidUuid } from "@/lib/utils/uuid";
import type { EtapaLead, Lead, MotivoDescarte, SituacaoLead, TemperaturaLead, TipoImovelCustom } from "@/types";

interface AtendimentoDadosTabProps {
  lead: Lead;
  perfis: { id: string; nome: string }[];
  tiposImovel: TipoImovelCustom[];
  motivos: MotivoDescarte[];
  faixaValorPercent?: number;
}

export function AtendimentoDadosTab({
  lead,
  perfis,
  tiposImovel,
  motivos,
  faixaValorPercent = 20,
}: AtendimentoDadosTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const responsavelNome =
    lead.perfil?.nome ?? perfis.find((p) => p.id === lead.perfil_id)?.nome ?? null;

  const [temperatura, setTemperatura] = useState<TemperaturaLead>(
    lead.temperatura ?? "indefinido",
  );
  const [etapa, setEtapa] = useState<EtapaLead>(etapaParaSelectAtendimento(lead.etapa));
  const [situacao, setSituacao] = useState<SituacaoLead>(lead.situacao ?? "em_atendimento");
  const [qualificado, setQualificado] = useState(isLeadQualificado(lead));

  const [imovelInteresse, setImovelInteresse] = useState<ImovelSearchResult | null>(
    lead.imovel ? imovelToSearchResult(lead.imovel) : null,
  );

  const [finalidade, setFinalidade] = useState(lead.finalidade_busca ?? "");
  const [tipoImovel, setTipoImovel] = useState(lead.tipo_imovel_busca ?? "");
  const [bairros, setBairros] = useState<string[]>(lead.bairros_interesse ?? []);
  const [quartos, setQuartos] = useState(lead.quartos_minimo?.toString() ?? "");
  const [suites, setSuites] = useState(lead.suites_minimas?.toString() ?? "");
  const [banheiros, setBanheiros] = useState(lead.banheiros_minimos?.toString() ?? "");
  const [vagas, setVagas] = useState(lead.vagas_minimas?.toString() ?? "");
  const [valorMin, setValorMin] = useState<number | null>(lead.valor_minimo ?? null);
  const [valorMax, setValorMax] = useState<number | null>(lead.valor_maximo ?? null);
  const [prazo, setPrazo] = useState(lead.prazo_decisao ?? "");
  const [obsTexto, setObsTexto] = useState(parseLeadObservacoes(lead.observacoes).texto);

  const [entradaFgts, setEntradaFgts] = useState<number | null>(lead.entrada_fgts ?? null);
  const [entradaProprios, setEntradaProprios] = useState<number | null>(
    lead.entrada_recursos_proprios ?? null,
  );
  const [finAprovado, setFinAprovado] = useState(lead.financiamento_aprovado ?? false);
  const [possuiImovel, setPossuiImovel] = useState(lead.possui_imovel_venda ?? false);
  const [interessePermuta, setInteressePermuta] = useState(lead.interesse_permuta ?? false);
  const [infoPermuta, setInfoPermuta] = useState(lead.info_permuta ?? "");
  const [obsFinanceiras, setObsFinanceiras] = useState(lead.obs_financeiras ?? "");

  const [descartarOpen, setDescartarOpen] = useState(false);
  const [motivoDescarteId, setMotivoDescarteId] = useState("");
  const [motivoDescarteTexto, setMotivoDescarteTexto] = useState("");
  const situacaoAnteriorRef = useRef<SituacaoLead>(lead.situacao ?? "em_atendimento");

  useEffect(() => {
    setQualificado(isLeadQualificado(lead));
    setEtapa(etapaParaSelectAtendimento(lead.etapa));
  }, [lead]);

  const tiposAtivos = useMemo(
    () => tiposImovel.filter((t) => t.ativo),
    [tiposImovel],
  );

  const { aplicar: aplicarInteresseFromImovel } = useAplicarInteresseFromImovel(faixaValorPercent);

  function aplicarEstadoInteresse(state: ReturnType<typeof interesseFormStateVazio>) {
    setFinalidade(state.finalidade);
    setTipoImovel(state.tipoImovel);
    setBairros(state.bairros);
    setQuartos(state.quartos);
    setSuites(state.suites);
    setBanheiros(state.banheiros);
    setVagas(state.vagas);
    setValorMin(state.valorMin);
    setValorMax(state.valorMax);
  }

  function handleImovelInteresseChange(imovel: ImovelSearchResult | null) {
    if (!imovel) {
      setImovelInteresse(null);
      aplicarEstadoInteresse(interesseFormStateVazio());
      return;
    }

    setImovelInteresse(imovel);
    aplicarInteresseFromImovel(imovel, aplicarEstadoInteresse);
  }

  function handleSituacaoChange(nova: SituacaoLead) {
    if (nova === "descartado" && situacao !== "descartado") {
      situacaoAnteriorRef.current = situacao;
      setSituacao(nova);
      setMotivoDescarteId("");
      setMotivoDescarteTexto("");
      setDescartarOpen(true);
      return;
    }
    setSituacao(nova);
    save({ situacao: nova });
  }

  function cancelarDescarte() {
    setSituacao(situacaoAnteriorRef.current);
    setMotivoDescarteId("");
    setMotivoDescarteTexto("");
    setDescartarOpen(false);
  }

  function confirmarDescarte() {
    if (!isValidUuid(motivoDescarteId)) {
      toast({ variant: "destructive", title: "Selecione um motivo." });
      return;
    }
    if (!motivoDescarteTexto.trim()) {
      toast({ variant: "destructive", title: "Informe informações adicionais." });
      return;
    }

    startTransition(async () => {
      const result = await descartarAtendimento(lead.id, motivoDescarteId, motivoDescarteTexto);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        setSituacao(situacaoAnteriorRef.current);
        return;
      }
      toast({ title: result.message });
      setDescartarOpen(false);
      router.refresh();
    });
  }

  function parseNumeroMinimo(valor: string): number | null {
    if (valor.trim() === "") return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }

  function buildInteressePayload(): Parameters<typeof updateAtendimentoDados>[1] {
    const { meta } = parseLeadObservacoes(lead.observacoes);

    return {
      imovel_id: imovelInteresse?.id ?? null,
      finalidade_busca: finalidade || null,
      tipo_imovel_busca: tipoImovel,
      bairros_interesse: bairros,
      quartos_minimo: parseNumeroMinimo(quartos),
      suites_minimas: parseNumeroMinimo(suites),
      banheiros_minimos: parseNumeroMinimo(banheiros),
      vagas_minimas: parseNumeroMinimo(vagas),
      valor_minimo: valorMin,
      valor_maximo: valorMax,
      prazo_decisao: prazo || null,
      observacoes: serializeLeadObservacoes(meta, obsTexto),
    };
  }

  function buildPreferenciasPayload(): Parameters<typeof updateAtendimentoDados>[1] {
    const { meta } = parseLeadObservacoes(lead.observacoes);

    return {
      temperatura,
      etapa,
      situacao,
      imovel_id: imovelInteresse?.id ?? null,
      finalidade_busca: finalidade || null,
      tipo_imovel_busca: tipoImovel,
      bairros_interesse: bairros,
      quartos_minimo: parseNumeroMinimo(quartos),
      suites_minimas: parseNumeroMinimo(suites),
      banheiros_minimos: parseNumeroMinimo(banheiros),
      vagas_minimas: parseNumeroMinimo(vagas),
      valor_minimo: valorMin,
      valor_maximo: valorMax,
      prazo_decisao: prazo || null,
      observacoes: serializeLeadObservacoes(meta, obsTexto),
      entrada_fgts: entradaFgts,
      entrada_recursos_proprios: entradaProprios,
      financiamento_aprovado: finAprovado,
      possui_imovel_venda: possuiImovel,
      interesse_permuta: interessePermuta,
      info_permuta: infoPermuta,
      obs_financeiras: obsFinanceiras,
    };
  }

  function handleQualificadoChange(checked: boolean) {
    setQualificado(checked);
    startTransition(async () => {
      const result = checked
        ? await qualificarLead(lead.id)
        : await desqualificarLead(lead.id);

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        setQualificado(!checked);
        return;
      }

      toast({ title: result.message });
      router.refresh();
    });
  }

  function save(partial?: Parameters<typeof updateAtendimentoDados>[1]) {
    startTransition(async () => {
      const result = await updateAtendimentoDados(lead.id, partial ?? buildPreferenciasPayload());

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Status</h3>
        <div className="grid grid-cols-2 gap-4 lg:flex lg:flex-wrap lg:items-end">
          <div className="w-fit min-w-0 space-y-2">
            <Label>Temperatura</Label>
            <Select
              value={temperatura}
              onValueChange={(v) => {
                setTemperatura(v as TemperaturaLead);
                save({ temperatura: v as TemperaturaLead });
              }}
            >
              <SelectTrigger className="w-auto min-w-[9rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TEMPERATURA_LEAD_LABELS) as TemperaturaLead[]).map((t) => (
                  <SelectItem key={t} value={t}>{TEMPERATURA_LEAD_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-fit min-w-0 space-y-2">
            <Label>Etapa</Label>
            <Select
              value={etapa}
              onValueChange={(v) => {
                setEtapa(v as EtapaLead);
                save({ etapa: v as EtapaLead });
              }}
            >
              <SelectTrigger className="w-auto min-w-[9rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ETAPAS_ATENDIMENTO.map((e) => (
                  <SelectItem key={e} value={e}>{ETAPA_LEAD_LABELS[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-fit min-w-0 space-y-2">
            <Label>Situação</Label>
            <Select
              value={situacao}
              onValueChange={(v) => handleSituacaoChange(v as SituacaoLead)}
            >
              <SelectTrigger className="w-auto min-w-[9rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SITUACAO_LEAD_LABELS) as SituacaoLead[]).map((s) => (
                  <SelectItem key={s} value={s}>{SITUACAO_LEAD_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center gap-2 self-end pb-2">
            <Switch
              id="qualificado"
              checked={qualificado}
              onCheckedChange={handleQualificadoChange}
              disabled={isPending}
            />
            <Label htmlFor="qualificado">Qualificado</Label>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Interesse</h3>
        <ImovelInteresseAutocomplete
          value={imovelInteresse}
          onChange={handleImovelInteresseChange}
          disabled={isPending}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Finalidade</Label>
            <Select
              value={finalidade || "__none__"}
              onValueChange={(v) => setFinalidade(v === "__none__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não definido</SelectItem>
                {FINALIDADE_BUSCA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de imóvel</Label>
            <Select
              value={tipoImovel || "__none__"}
              onValueChange={(v) => setTipoImovel(v === "__none__" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {tiposAtivos.map((t) => (
                  <SelectItem key={t.id} value={t.nome.toLowerCase()}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Bairros</Label>
            <BairrosInteresseInput
              value={bairros}
              onChange={setBairros}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Quartos mín.</Label>
            <Input
              type="number"
              min={0}
              value={quartos}
              onChange={(e) => setQuartos(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Suítes mín.</Label>
            <Input type="number" value={suites} onChange={(e) => setSuites(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Banheiros mín.</Label>
            <Input type="number" value={banheiros} onChange={(e) => setBanheiros(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vagas mín.</Label>
            <Input type="number" value={vagas} onChange={(e) => setVagas(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Valor mín.</Label>
            <CurrencyInput
              key={`valor-min-${valorMin ?? "vazio"}`}
              value={valorMin}
              onChange={setValorMin}
              mode="filter"
            />
          </div>
          <div className="space-y-2">
            <Label>Valor máx.</Label>
            <CurrencyInput
              key={`valor-max-${valorMax ?? "vazio"}`}
              value={valorMax}
              onChange={setValorMax}
              mode="filter"
            />
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
        <Button type="button" onClick={() => save(buildInteressePayload())} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar preferências"}
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Perfil financeiro</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Entrada FGTS</Label>
            <CurrencyInput value={entradaFgts} onChange={setEntradaFgts} />
          </div>
          <div className="space-y-2">
            <Label>Recursos próprios</Label>
            <CurrencyInput value={entradaProprios} onChange={setEntradaProprios} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={finAprovado} onCheckedChange={setFinAprovado} id="fin" />
            <Label htmlFor="fin">Financiamento aprovado</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={possuiImovel} onCheckedChange={setPossuiImovel} id="imovel-venda" />
            <Label htmlFor="imovel-venda">Possui imóvel à venda</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={interessePermuta} onCheckedChange={setInteressePermuta} id="permuta" />
            <Label htmlFor="permuta">Interesse em permuta</Label>
          </div>
        </div>
        {interessePermuta ? (
          <div className="space-y-2">
            <Label>Informações permuta</Label>
            <Textarea value={infoPermuta} onChange={(e) => setInfoPermuta(e.target.value)} rows={2} />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label>Observações financeiras</Label>
          <Textarea value={obsFinanceiras} onChange={(e) => setObsFinanceiras(e.target.value)} rows={2} />
        </div>
        <Button type="button" variant="outline" onClick={() => save()} disabled={isPending}>
          Salvar perfil financeiro
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Informações do atendimento</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Código</dt>
            <dd className="font-medium">{lead.codigo_atendimento ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Responsável</dt>
            <dd className="font-medium">{responsavelNome ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Entrada</dt>
            <dd>{lead.data_entrada ? new Date(lead.data_entrada).toLocaleString("pt-BR") : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tempo 1ª resposta</dt>
            <dd>{formatTempoPrimeiraResposta(lead.tempo_primeira_resposta_min)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mídia</dt>
            <dd>{formatOrigemDisplay(lead.origem)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Cadastro</dt>
            <dd>{new Date(lead.criado_em).toLocaleDateString("pt-BR")}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-semibold text-primary">Histórico de interações</h3>
        <InteracaoForm leadId={lead.id} onSuccess={() => router.refresh()} />
        <AgendarAtividadeForm
          leadId={lead.id}
          leadNome={lead.nome ?? undefined}
          requireFuture
          onSuccess={() => router.refresh()}
        />
        <LeadHistorico interacoes={lead.interacoes ?? []} />
      </section>

      <Dialog
        open={descartarOpen}
        onOpenChange={(open) => {
          if (!open) cancelarDescarte();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar descarte</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o motivo e detalhes adicionais para descartar este atendimento.
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select value={motivoDescarteId} onValueChange={setMotivoDescarteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {motivos.filter((m) => m.ativo).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Informações adicionais *</Label>
              <Textarea
                value={motivoDescarteTexto}
                onChange={(e) => setMotivoDescarteTexto(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={cancelarDescarte}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="flex-1"
                disabled={isPending}
                onClick={confirmarDescarte}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar descarte"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
