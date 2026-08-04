"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  MoreVertical,
  Plus,
} from "lucide-react";

import {
  formatDateTimeBrasilia,
  formatLocalDateTimeInput,
  formatLocalTimeInput,
  isSameDayBrasilia,
} from "@/lib/dates/format";

import { AgendarAtividadeForm } from "@/components/agenda/AgendarAtividadeForm";
import { ActionMenuIcon, ActionMenuItem } from "@/components/ui/action-menu-item";
import { Button } from "@/components/ui/button";
import { AgendaCalendarSkeleton, AgendaPageSkeleton } from "@/components/ui/page-skeletons";
import { useInstantTabs } from "@/hooks/use-instant-tabs";
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
  DropdownMenuSeparator,
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
import { toast } from "@/hooks/use-toast";
import {
  cancelarAgendaItem,
  editarAgendaItem,
  marcarAgendaRealizado,
} from "@/lib/actions/agenda";
import {
  getTipoCompromisso,
  PERIODO_FILTRO_LABELS,
  TIPOS_COMPROMISSO,
  type AgendaPeriodoFiltro,
} from "@/lib/constants/agenda";
import { contemNormalizado } from "@/lib/utils/normalizar";
import { cn } from "@/lib/utils";
import type { Agenda, StatusAgenda, TipoAgenda } from "@/types";

interface AgendaPageClientProps {
  initialItems: Agenda[];
}

type ViewMode = "list" | "calendar";

function resolvePeriodoRange(
  periodo: AgendaPeriodoFiltro,
  customInicio?: string,
  customFim?: string,
): { inicio: Date; fim: Date } | null {
  const agora = new Date();

  switch (periodo) {
    case "atrasados":
      return { inicio: new Date(0), fim: startOfDay(agora) };
    case "hoje":
      return { inicio: startOfDay(agora), fim: endOfDay(agora) };
    case "esta_semana":
      return {
        inicio: startOfWeek(agora, { weekStartsOn: 0 }),
        fim: endOfWeek(agora, { weekStartsOn: 0 }),
      };
    case "proxima_semana": {
      const proxima = addDays(startOfWeek(agora, { weekStartsOn: 0 }), 7);
      return {
        inicio: proxima,
        fim: endOfWeek(proxima, { weekStartsOn: 0 }),
      };
    }
    case "este_mes":
      return { inicio: startOfMonth(agora), fim: endOfMonth(agora) };
    case "personalizado": {
      if (!customInicio || !customFim) return null;
      return {
        inicio: startOfDay(new Date(customInicio)),
        fim: endOfDay(new Date(customFim)),
      };
    }
    default:
      return null;
  }
}

function statusBadgeClass(status: StatusAgenda): string {
  switch (status) {
    case "concluida":
      return "bg-[#2DC653]/15 text-[#1a7a32]";
    case "cancelada":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-[#F18F01]/15 text-[#b36a00]";
  }
}

function statusLabel(status: StatusAgenda): string {
  switch (status) {
    case "concluida":
      return "Realizado";
    case "cancelada":
      return "Cancelado";
    default:
      return "Pendente";
  }
}

export function AgendaPageClient({ initialItems }: AgendaPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    selectedTab: selectedView,
    displayTab: displayView,
    selectTab: selectView,
    isContentPending: isViewPending,
  } = useInstantTabs<ViewMode>("list");
  const [mesAtual, setMesAtual] = useState(new Date());
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusAgenda | "all">("all");
  const [filtroTipo, setFiltroTipo] = useState<TipoAgenda | "all">("all");
  const [periodo, setPeriodo] = useState<AgendaPeriodoFiltro>("hoje");
  const [customInicio, setCustomInicio] = useState("");
  const [customFim, setCustomFim] = useState("");

  const [novaOpen, setNovaOpen] = useState(false);

  const [acaoItem, setAcaoItem] = useState<Agenda | null>(null);
  const [acaoTipo, setAcaoTipo] = useState<"realizar" | "cancelar" | "editar" | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [parecer, setParecer] = useState("");
  const [vaiGerarProposta, setVaiGerarProposta] = useState("");
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editData, setEditData] = useState("");
  const [editTipo, setEditTipo] = useState<TipoAgenda>("visita");

  const hoje = new Date();

  const itensFiltrados = useMemo(() => {
    const range = displayView === "list" ? resolvePeriodoRange(periodo, customInicio, customFim) : null;

    return initialItems.filter((item) => {
      if (filtroStatus !== "all" && item.status !== filtroStatus) return false;
      if (filtroTipo !== "all" && item.tipo !== filtroTipo) return false;

      if (busca.trim()) {
        const texto = [
          item.titulo,
          item.lead?.nome,
          item.imovel?.titulo,
          item.imovel?.codigo,
          item.descricao,
        ]
          .filter(Boolean)
          .join(" ");
        if (!contemNormalizado(texto, busca)) return false;
      }

      if (range) {
        const data = new Date(item.data_atividade);
        if (periodo === "atrasados") {
          return item.status === "pendente" && isBefore(data, startOfDay(hoje));
        }
        if (data < range.inicio || data > range.fim) return false;
      }

      return true;
    });
  }, [
    initialItems,
    filtroStatus,
    filtroTipo,
    busca,
    periodo,
    customInicio,
    customFim,
    displayView,
    hoje,
  ]);

  const diasDoMes = useMemo(() => {
    const inicio = startOfMonth(mesAtual);
    const fim = endOfMonth(mesAtual);
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [mesAtual]);

  function abrirAcao(item: Agenda, tipoAcao: "realizar" | "cancelar" | "editar") {
    setAcaoItem(item);
    setAcaoTipo(tipoAcao);
    setObservacoes("");
    setParecer("");
    setVaiGerarProposta("");
    setEditTitulo(item.titulo);
    setEditDescricao(item.descricao ?? "");
    setEditTipo(item.tipo);
    setEditData(formatLocalDateTimeInput(item.data_atividade));
  }

  function fecharAcao() {
    setAcaoItem(null);
    setAcaoTipo(null);
  }

  function confirmarAcao() {
    if (!acaoItem || !acaoTipo) return;

    startTransition(async () => {
      let result;
      if (acaoTipo === "realizar") {
        result = await marcarAgendaRealizado(acaoItem.id, {
          observacoes,
          parecer: acaoItem.tipo === "visita" ? parecer : undefined,
          vai_gerar_proposta: acaoItem.tipo === "visita" ? vaiGerarProposta : undefined,
        });
      } else if (acaoTipo === "cancelar") {
        result = await cancelarAgendaItem(acaoItem.id, observacoes);
      } else {
        result = await editarAgendaItem(acaoItem.id, {
          titulo: editTitulo,
          descricao: editDescricao,
          data_atividade: editData,
          tipo: editTipo,
        });
      }

      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      fecharAcao();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-primary">Agenda</h2>
        <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus data-icon="inline-start" />
              Nova atividade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova atividade</DialogTitle>
            </DialogHeader>
            <AgendarAtividadeForm
              submitLabel="Salvar"
              onSuccess={() => {
                setNovaOpen(false);
                router.refresh();
              }}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar atividade, lead ou imóvel…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-xs"
        />

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Filtros
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-3">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={filtroStatus}
                    onValueChange={(v) => setFiltroStatus(v as StatusAgenda | "all")}
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="concluida">Realizado</SelectItem>
                      <SelectItem value="cancelada">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={filtroTipo}
                    onValueChange={(v) => setFiltroTipo(v as TipoAgenda | "all")}
                  >
                    <SelectTrigger className="mt-1 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {TIPOS_COMPROMISSO.map((t) => (
                        <SelectItem key={t.slug} value={t.slug}>
                          {t.icone} {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              variant={selectedView === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => selectView("list")}
              aria-label="Lista"
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={selectedView === "calendar" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => selectView("calendar")}
              aria-label="Calendário"
            >
              <CalendarDays className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {isViewPending ? (
        selectedView === "calendar" ? (
          <AgendaCalendarSkeleton />
        ) : (
          <AgendaPageSkeleton />
        )
      ) : displayView === "list" ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as AgendaPeriodoFiltro)}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIODO_FILTRO_LABELS) as AgendaPeriodoFiltro[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PERIODO_FILTRO_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {periodo === "personalizado" ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                <Input
                  type="date"
                  value={customInicio}
                  onChange={(e) => setCustomInicio(e.target.value)}
                />
                <Input
                  type="date"
                  value={customFim}
                  onChange={(e) => setCustomFim(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {itensFiltrados.length === 0 ? (
            <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma atividade encontrada para o período selecionado.
            </p>
          ) : (
            <ul className="space-y-2">
              {itensFiltrados.map((item) => (
                <AgendaListCard
                  key={item.id}
                  item={item}
                  disabled={isPending}
                  onAcao={abrirAcao}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <section className="rounded-xl border border-border p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-primary capitalize">
              {format(mesAtual, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => setMesAtual((d) => addMonths(d, -1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMesAtual(new Date())}>
                Hoje
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => setMesAtual((d) => addMonths(d, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: diasDoMes[0].getDay() }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {diasDoMes.map((dia) => {
              const atividades = itensFiltrados.filter((item) =>
                isSameDayBrasilia(item.data_atividade, dia),
              );
              const isToday = isSameDay(dia, hoje);

              return (
                <div
                  key={dia.toISOString()}
                  className={cn(
                    "min-h-20 rounded-lg border border-transparent p-1 text-left text-xs",
                    isSameMonth(dia, mesAtual) && "border-border/60",
                    isToday && "border-primary bg-primary/5",
                  )}
                >
                  <span className={cn("font-medium", isToday && "text-primary")}>
                    {format(dia, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {atividades.slice(0, 3).map((item) => {
                      const tipoInfo = getTipoCompromisso(item.tipo);
                      const href = item.lead_id
                        ? `/dashboard/atendimentos/${item.lead_id}`
                        : undefined;

                      const conteudo = (
                        <div className="truncate rounded bg-muted/60 px-1 py-0.5 text-[10px] leading-tight">
                          <span className="mr-0.5">{tipoInfo.icone}</span>
                          {formatLocalTimeInput(item.data_atividade)}
                          {item.lead?.nome ? ` ${item.lead.nome.split(" ")[0]}` : ""}
                        </div>
                      );

                      return href ? (
                        <Link key={item.id} href={href} className="block hover:opacity-80">
                          {conteudo}
                        </Link>
                      ) : (
                        <div key={item.id}>{conteudo}</div>
                      );
                    })}
                    {atividades.length > 3 ? (
                      <span className="text-[10px] text-muted-foreground">
                        +{atividades.length - 3}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Dialog open={acaoTipo !== null} onOpenChange={(open) => !open && fecharAcao()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acaoTipo === "realizar"
                ? "Marcar como realizado"
                : acaoTipo === "cancelar"
                  ? "Cancelar atividade"
                  : "Editar atividade"}
            </DialogTitle>
          </DialogHeader>
          {acaoTipo === "editar" ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit_titulo">Título</Label>
                <Input
                  id="edit_titulo"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={editTipo} onValueChange={(v) => setEditTipo(v as TipoAgenda)}>
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
              <div>
                <Label htmlFor="edit_data">Data e hora</Label>
                <Input
                  id="edit_data"
                  type="datetime-local"
                  value={editData}
                  onChange={(e) => setEditData(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit_desc">Descrição</Label>
                <Textarea
                  id="edit_desc"
                  value={editDescricao}
                  onChange={(e) => setEditDescricao(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {acaoTipo === "realizar" && acaoItem?.tipo === "visita" ? (
                <>
                  <div>
                    <Label htmlFor="parecer">Parecer da visita</Label>
                    <Textarea
                      id="parecer"
                      value={parecer}
                      onChange={(e) => setParecer(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="proposta">Vai gerar proposta?</Label>
                    <Select value={vaiGerarProposta} onValueChange={setVaiGerarProposta}>
                      <SelectTrigger id="proposta">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                        <SelectItem value="talvez">Talvez</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}
              <div>
                <Label htmlFor="obs">
                  {acaoTipo === "cancelar" ? "Motivo (opcional)" : "Observações (opcional)"}
                </Label>
                <Textarea
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>
          )}
          <Button onClick={confirmarAcao} disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgendaListCard({
  item,
  disabled,
  onAcao,
}: {
  item: Agenda;
  disabled: boolean;
  onAcao: (item: Agenda, tipo: "realizar" | "cancelar" | "editar") => void;
}) {
  const tipoInfo = getTipoCompromisso(item.tipo);
  const dataFmt = formatDateTimeBrasilia(item.data_atividade).replace(", ", " às ");
  const subtitulo = [
    item.lead?.nome,
    item.imovel?.titulo ?? item.imovel?.codigo,
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg" aria-hidden>
              {tipoInfo.icone}
            </span>
            <span className="font-medium text-primary">{item.titulo}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                statusBadgeClass(item.status),
              )}
            >
              {statusLabel(item.status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{dataFmt}</p>
          {subtitulo ? (
            <p className="mt-0.5 truncate text-sm text-primary/80">{subtitulo}</p>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" disabled={disabled} aria-label="Ações">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.lead_id ? (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/atendimentos/${item.lead_id}`}>
                  <ActionMenuIcon action="irParaAtendimento" />
                  Ir para atendimento
                </Link>
              </DropdownMenuItem>
            ) : null}
            {item.status === "pendente" ? (
              <>
                <ActionMenuItem onClick={() => onAcao(item, "realizar")} action="marcarRealizado">
                  Marcar realizado
                </ActionMenuItem>
                <ActionMenuItem onClick={() => onAcao(item, "cancelar")} action="cancelar">
                  Cancelar
                </ActionMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <ActionMenuItem onClick={() => onAcao(item, "editar")} action="editar">
              Editar
            </ActionMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
