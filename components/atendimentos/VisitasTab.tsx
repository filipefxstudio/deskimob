"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Calendar,
  ChevronDown,
  Loader2,
  Plus,
} from "lucide-react";

import { ActionMenuItem } from "@/components/ui/action-menu-item";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PropostaFromVisitaModal } from "@/components/atendimentos/PropostaFromVisitaModal";
import { ImovelPhotoBadge } from "@/components/atendimentos/ImovelPhotoBadge";
import {
  cancelarVisitasEmLote,
  createVisita,
  deleteVisita,
  editarVisita,
  excluirVisitasEmLote,
  gerarFichaVisitaHtml,
  updateVisita,
} from "@/lib/actions/atendimentos";
import {
  ACTION_MENU_DESTRUCTIVE_CLASS,
  ACTION_MENU_ICONS,
} from "@/lib/ui/action-menu-icons";
import {
  formatDateTimeBrasilia,
  formatLocalDateInput,
  formatLocalTimeInput,
} from "@/lib/dates/format";
import { getImovelCodigo } from "@/lib/imoveis/format";
import { buildImoveisComPropostaAtiva } from "@/lib/atendimentos/badges";
import {
  MSG_PROPOSTA_SEM_PARECER,
  visitaTemParecerRegistrado,
} from "@/lib/atendimentos/regras";
import { getCapaUrl, getTipoLabel, getValorExibicao } from "@/lib/site/format";
import { toast } from "@/hooks/use-toast";
import type { Imovel, Proposta, StatusVisita, Visita } from "@/types";

interface VisitasTabProps {
  leadId: string;
  visitas: Visita[];
  propostas: Proposta[];
  imoveis: Imovel[];
}

const STATUS_VISITA: Record<
  StatusVisita,
  { label: string; color: string }
> = {
  agendada: { label: "Agendada", color: "#252522" },
  confirmada: { label: "Confirmada", color: "#7D8750" },
  realizada: { label: "Realizada", color: "#5F6840" },
  cancelada: { label: "Cancelada", color: "#C0392B" },
  nao_compareceu: { label: "Não compareceu", color: "#C85D32" },
};

const PARECER_LABELS: Record<string, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
};

type BatchActionId = "gerar-ficha" | "cancelar" | "excluir";

const BATCH_ACTIONS: { id: BatchActionId; label: string }[] = [
  { id: "gerar-ficha", label: "Gerar ficha de visita" },
  { id: "cancelar", label: "Cancelar visitas" },
  { id: "excluir", label: "Excluir visitas" },
];

const BATCH_ACTION_ICONS: Record<BatchActionId, keyof typeof ACTION_MENU_ICONS> = {
  "gerar-ficha": "gerarFicha",
  cancelar: "cancelar",
  excluir: "excluir",
};

function formatVisitaDateTime(dataVisita: string): string {
  return formatDateTimeBrasilia(dataVisita).replace(", ", " às ");
}

function formatEnderecoCompleto(imovel: Imovel): string {
  const partes = [
    imovel.logradouro,
    imovel.numero,
    imovel.complemento,
    imovel.bairro,
    imovel.cidade,
  ].filter(Boolean);

  return partes.join(", ") || "Endereço não informado";
}

function truncateText(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function renderParecerArea(visita: Visita) {
  const visitaPassou = new Date(visita.data_visita) < new Date();

  if (visita.parecer) {
    const label = PARECER_LABELS[visita.parecer] ?? visita.parecer;
    const obs = visita.observacoes?.trim();
    const texto = obs ? `${label} — ${truncateText(obs)}` : label;
    return <p className="mt-2 text-sm text-muted-foreground">{texto}</p>;
  }

  if (visitaPassou) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">⚠️ Parecer pendente</p>
    );
  }

  return null;
}

function abrirFichaImpressao(html: string) {
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export function VisitasTab({ leadId, visitas, propostas, imoveis }: VisitasTabProps) {
  const router = useRouter();
  const [visitasLista, setVisitasLista] = useState(visitas);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [imovelId, setImovelId] = useState("");
  const [dataAgenda, setDataAgenda] = useState("");
  const [horaAgenda, setHoraAgenda] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [parecerOpen, setParecerOpen] = useState<Visita | null>(null);
  const [parecer, setParecer] = useState("");
  const [vaiProposta, setVaiProposta] = useState("");
  const [editarOpen, setEditarOpen] = useState<Visita | null>(null);
  const [editData, setEditData] = useState("");
  const [editHora, setEditHora] = useState("");
  const [propostaOpen, setPropostaOpen] = useState<Visita | null>(null);

  const allSelected =
    visitasLista.length > 0 && selectedIds.size === visitasLista.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const batchMode = selectedIds.size >= 2;

  useEffect(() => {
    setVisitasLista(visitas);
  }, [visitas]);

  function fecharDialogAgendar() {
    setOpen(false);
    setImovelId("");
    setDataAgenda("");
    setHoraAgenda("");
    setObservacoes("");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(visitasLista.map((v) => v.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  async function executarGerarFicha(ids: string[]) {
    if (!ids.length) {
      toast({ variant: "destructive", title: "Selecione visitas." });
      return;
    }
    const result = await gerarFichaVisitaHtml(leadId, ids);
    if (result.error || !result.html) {
      toast({ variant: "destructive", title: "Erro", description: result.error });
      return;
    }
    abrirFichaImpressao(result.html);
  }

  function gerarFicha(ids: string[]) {
    startTransition(() => executarGerarFicha(ids));
  }

  function executarAcaoLote(actionId: BatchActionId) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    startTransition(async () => {
      if (actionId === "gerar-ficha") {
        await executarGerarFicha(ids);
        return;
      }

      if (actionId === "cancelar") {
        const result = await cancelarVisitasEmLote(ids);
        if (result.error) {
          toast({ variant: "destructive", title: "Erro", description: result.error });
          return;
        }
        toast({ title: result.message });
        setSelectedIds(new Set());
        router.refresh();
        return;
      }

      if (actionId === "excluir") {
        const result = await excluirVisitasEmLote(ids);
        if (result.error) {
          toast({ variant: "destructive", title: "Erro", description: result.error });
          return;
        }
        setVisitasLista((prev) => prev.filter((v) => !selectedIds.has(v.id)));
        setSelectedIds(new Set());
        toast({ title: result.message });
        router.refresh();
      }
    });
  }

  function agendar() {
    if (!imovelId || !dataAgenda || !horaAgenda) {
      toast({ variant: "destructive", title: "Preencha imóvel, data e hora." });
      return;
    }
    startTransition(async () => {
      const result = await createVisita(leadId, {
        imovel_id: imovelId,
        data_visita: `${dataAgenda}T${horaAgenda}`,
        observacoes,
      });
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      fecharDialogAgendar();
      router.refresh();
    });
  }

  function abrirEditar(visita: Visita) {
    setEditarOpen(visita);
    setEditData(formatLocalDateInput(visita.data_visita));
    setEditHora(formatLocalTimeInput(visita.data_visita));
  }

  function salvarEdicao() {
    if (!editarOpen) return;
    if (!editData || !editHora) {
      toast({ variant: "destructive", title: "Preencha data e hora." });
      return;
    }
    startTransition(async () => {
      const result = await editarVisita(editarOpen.id, editData, editHora);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      setEditarOpen(null);
      router.refresh();
    });
  }

  function salvarParecer() {
    if (!parecerOpen) return;
    if (!parecer) {
      toast({ variant: "destructive", title: "Selecione o parecer da visita." });
      return;
    }
    startTransition(async () => {
      const result = await updateVisita(parecerOpen.id, {
        parecer,
        vai_gerar_proposta: vaiProposta || undefined,
        status: "realizada",
      });
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      setParecerOpen(null);
      setVisitasLista((prev) =>
        prev.map((v) =>
          v.id === parecerOpen.id
            ? {
                ...v,
                parecer: parecer as Visita["parecer"],
                vai_gerar_proposta: (vaiProposta || null) as Visita["vai_gerar_proposta"],
                status: "realizada",
              }
            : v,
        ),
      );
      router.refresh();
    });
  }

  function abrirProposta(visita: Visita) {
    if (!visitaTemParecerRegistrado(visita)) {
      toast({
        variant: "destructive",
        title: MSG_PROPOSTA_SEM_PARECER,
      });
      return;
    }
    setPropostaOpen(visita);
  }

  function excluirVisita(visita: Visita) {
    startTransition(async () => {
      const result = await deleteVisita(visita.id);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      setVisitasLista((prev) => prev.filter((v) => v.id !== visita.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(visita.id);
        return next;
      });
      toast({ title: result.message });
      router.refresh();
    });
  }

  const headerCheckboxState = useMemo(
    () => (allSelected ? true : someSelected ? "indeterminate" : false),
    [allSelected, someSelected],
  );

  const imoveisComProposta = useMemo(
    () => buildImoveisComPropostaAtiva(propostas),
    [propostas],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-primary">Visitas</h3>
          {visitasLista.length > 0 ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={headerCheckboxState}
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                aria-label="Selecionar todas as visitas"
              />
              Selecionar todas
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {batchMode ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={isPending}>
                  Ações
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {BATCH_ACTIONS.map((action) => {
                  const Icon = ACTION_MENU_ICONS[BATCH_ACTION_ICONS[action.id]];
                  return (
                    <DropdownMenuItem
                      key={action.id}
                      className={
                        action.id === "excluir" ? ACTION_MENU_DESTRUCTIVE_CLASS : undefined
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        executarAcaoLote(action.id);
                      }}
                    >
                      <Icon className="size-4" />
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              if (nextOpen) {
                setOpen(true);
              } else {
                fecharDialogAgendar();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus data-icon="inline-start" />
                Agendar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agendar visita</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Imóvel</Label>
                  <Select value={imovelId} onValueChange={setImovelId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {imoveis.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.titulo ?? i.codigo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="agenda-data">Data</Label>
                  <Input
                    id="agenda-data"
                    type="date"
                    value={dataAgenda}
                    onChange={(e) => setDataAgenda(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="agenda-hora">Hora</Label>
                  <Input
                    id="agenda-hora"
                    type="time"
                    value={horaAgenda}
                    onChange={(e) => setHoraAgenda(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isPending}
                    onClick={fecharDialogAgendar}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={isPending}
                    onClick={agendar}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar agendamento"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {visitasLista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma visita registrada.</p>
      ) : (
        <div className="grid gap-4">
          {visitasLista.map((visita) => {
            const imovel = visita.imovel;
            const capa = imovel ? getCapaUrl(imovel) : null;
            const statusInfo =
              STATUS_VISITA[visita.status] ?? STATUS_VISITA.agendada;

            return (
              <Card key={visita.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Checkbox
                      checked={selectedIds.has(visita.id)}
                      onCheckedChange={() => toggleSelect(visita.id)}
                      className="mt-1 shrink-0"
                      aria-label={`Selecionar visita ${getImovelCodigo(imovel ?? { id: visita.id, codigo: null })}`}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
                      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-36">
                        {capa ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={capa}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                            Sem foto
                          </div>
                        )}
                        {visita.imovel_id && imoveisComProposta.has(visita.imovel_id) ? (
                          <div className="absolute right-2 top-2">
                            <ImovelPhotoBadge variant="proposta" />
                          </div>
                        ) : null}
                      </div>
                      <div className="min-w-0 space-y-1">
                        {imovel ? (
                          <>
                            <p className="font-semibold">{getImovelCodigo(imovel)}</p>
                            <p className="text-sm text-muted-foreground">
                              {getTipoLabel(imovel.tipo)}
                            </p>
                            <p className="text-sm">{formatEnderecoCompleto(imovel)}</p>
                            <p className="text-sm font-medium">{getValorExibicao(imovel)}</p>
                          </>
                        ) : (
                          <p className="font-medium">Imóvel não informado</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          <Calendar className="mr-1 inline size-3.5" />
                          {formatVisitaDateTime(visita.data_visita)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col sm:min-w-[180px] sm:items-end sm:text-right">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                    {renderParecerArea(visita)}
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" disabled={isPending}>
                        Ações
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ActionMenuItem
                        action="gerarFicha"
                        onClick={(event) => {
                          event.preventDefault();
                          gerarFicha([visita.id]);
                        }}
                      >
                        Gerar ficha de visita
                      </ActionMenuItem>
                      <ActionMenuItem
                        action="parecer"
                        onClick={(event) => {
                          event.preventDefault();
                          setParecerOpen(visita);
                          setParecer(visita.parecer ?? "");
                          setVaiProposta(visita.vai_gerar_proposta ?? "");
                        }}
                      >
                        Parecer
                      </ActionMenuItem>
                      {visita.status === "agendada" ? (
                        <ActionMenuItem
                          action="cancelar"
                          onClick={(event) => {
                            event.preventDefault();
                            startTransition(async () => {
                              const result = await updateVisita(visita.id, {
                                status: "cancelada",
                              });
                              if (result.error) {
                                toast({
                                  variant: "destructive",
                                  title: "Erro",
                                  description: result.error,
                                });
                                return;
                              }
                              toast({ title: result.message });
                              router.refresh();
                            });
                          }}
                        >
                          Cancelar visita
                        </ActionMenuItem>
                      ) : null}
                      {visita.status === "agendada" ? (
                        <ActionMenuItem
                          action="editar"
                          onClick={(event) => {
                            event.preventDefault();
                            abrirEditar(visita);
                          }}
                        >
                          Editar
                        </ActionMenuItem>
                      ) : null}
                      <ActionMenuItem
                        action="proposta"
                        disabled={!visitaTemParecerRegistrado(visita)}
                        onClick={(event) => {
                          event.preventDefault();
                          abrirProposta(visita);
                        }}
                      >
                        Proposta
                      </ActionMenuItem>
                      <ActionMenuItem
                        action="excluir"
                        destructive
                        onClick={(event) => {
                          event.preventDefault();
                          excluirVisita(visita);
                        }}
                      >
                        Excluir
                      </ActionMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(editarOpen)} onOpenChange={(o) => !o && setEditarOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-data">Data</Label>
              <Input
                id="edit-data"
                type="date"
                required
                value={editData}
                onChange={(e) => setEditData(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-hora">Hora</Label>
              <Input
                id="edit-hora"
                type="time"
                required
                value={editHora}
                onChange={(e) => setEditHora(e.target.value)}
              />
            </div>
            <Button onClick={salvarEdicao} disabled={isPending} className="w-full">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(parecerOpen)} onOpenChange={(o) => !o && setParecerOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parecer da visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Parecer</Label>
              <Select value={parecer} onValueChange={setParecer}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="positivo">Positivo</SelectItem>
                  <SelectItem value="neutro">Neutro</SelectItem>
                  <SelectItem value="negativo">Negativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vai gerar proposta?</Label>
              <Select value={vaiProposta} onValueChange={setVaiProposta}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="talvez">Talvez</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={salvarParecer} disabled={isPending} className="w-full">
              Salvar e marcar realizada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PropostaFromVisitaModal
        leadId={leadId}
        visita={propostaOpen}
        open={Boolean(propostaOpen)}
        onOpenChange={(open) => !open && setPropostaOpen(null)}
      />
    </div>
  );
}
