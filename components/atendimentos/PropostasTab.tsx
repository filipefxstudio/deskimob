"use client";



import { useRouter } from "next/navigation";

import { useCallback, useMemo, useState, useTransition } from "react";

import { format } from "date-fns";

import { ChevronDown, Loader2, Plus } from "lucide-react";



import { FecharNegocioModal } from "@/components/atendimentos/FecharNegocioModal";

import { ImovelAtendimentoResumo } from "@/components/atendimentos/ImovelAtendimentoResumo";

import { PropostaEditModal } from "@/components/atendimentos/PropostaEditModal";

import { ActionMenuIcon, ActionMenuItem } from "@/components/ui/action-menu-item";

import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";

import {

  Dialog,

  DialogContent,

  DialogHeader,

  DialogTitle,

  DialogTrigger,

} from "@/components/ui/dialog";

import { CurrencyInput } from "@/components/ui/currency-input";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuSeparator,

  DropdownMenuSub,

  DropdownMenuSubContent,

  DropdownMenuSubTrigger,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";

import {

  buildImoveisComNegocioFechado,

  getImovelWorkflowBadgeVariant,

} from "@/lib/atendimentos/badges";

import {
  MSG_NEGOCIO_PROPOSTA_NAO_ACEITA,
} from "@/lib/atendimentos/regras";

import {

  createProposta,

  deleteProposta,

  marcarNegocioPerdido,

  updatePropostaStatus,

} from "@/lib/actions/atendimentos";

import { formatCurrency } from "@/lib/site/format";

import { toast } from "@/hooks/use-toast";

import type { Imovel, Negocio, Proposta, StatusProposta } from "@/types";



interface PropostasTabProps {

  leadId: string;

  propostas: Proposta[];

  negocios: Negocio[];

  imoveis: Imovel[];

  perfis: { id: string; nome: string }[];

  perfilAtualId?: string | null;

}



const STATUS_OPTIONS: { value: StatusProposta; label: string }[] = [

  { value: "em_analise", label: "Em análise" },

  { value: "aceita", label: "Aceita" },

  { value: "recusada", label: "Recusada" },

  { value: "cancelada", label: "Cancelada" },

  { value: "contraproposta", label: "Contraproposta" },

];



const STATUS_PROPOSTA: Record<

  StatusProposta,

  { label: string; color: string }

> = {

  em_analise: { label: "Em análise", color: "#252522" },

  aceita: { label: "Aceita", color: "#7D8750" },

  recusada: { label: "Recusada", color: "#C0392B" },

  cancelada: { label: "Cancelada", color: "#B8B8B8" },

  contraproposta: { label: "Contraproposta", color: "#C85D32" },

};



const PROPOSTA_INATIVA = new Set<StatusProposta>(["cancelada", "recusada"]);



function truncateText(text: string, maxLength = 120): string {

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength).trimEnd()}...`;

}



export function PropostasTab({

  leadId,

  propostas,

  negocios,

  imoveis,

  perfis,

  perfilAtualId,

}: PropostasTabProps) {

  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [editOpen, setEditOpen] = useState<Proposta | null>(null);

  const [cancelarOpen, setCancelarOpen] = useState<Proposta | null>(null);

  const [excluirOpen, setExcluirOpen] = useState<Proposta | null>(null);

  const [fecharOpen, setFecharOpen] = useState<Proposta | null>(null);

  const handleFecharOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setFecharOpen(null);
  }, []);

  const [isPending, startTransition] = useTransition();

  const [imovelId, setImovelId] = useState("");

  const [valor, setValor] = useState<number | null>(null);

  const [dataProposta, setDataProposta] = useState(new Date().toISOString().slice(0, 10));

  const [observacoes, setObservacoes] = useState("");



  const imoveisNegocioFechado = useMemo(

    () => buildImoveisComNegocioFechado(negocios),

    [negocios],

  );



  function registrar() {

    if (!imovelId || valor === null) {

      toast({ variant: "destructive", title: "Preencha imóvel e valor." });

      return;

    }

    startTransition(async () => {

      const result = await createProposta(leadId, {

        imovel_id: imovelId,

        valor_proposto: valor,

        data_proposta: dataProposta,

        observacoes,

      });

      if (result.error) {

        toast({ variant: "destructive", title: "Erro", description: result.error });

        return;

      }

      toast({ title: result.message });

      setOpen(false);

      router.refresh();

    });

  }



  function alterarStatus(propostaId: string, status: StatusProposta) {

    startTransition(async () => {

      const result = await updatePropostaStatus(propostaId, status);

      if (result.error) {

        toast({ variant: "destructive", title: "Erro", description: result.error });

        return;

      }

      toast({ title: result.message });

      router.refresh();

    });

  }



  function cancelarProposta() {

    if (!cancelarOpen) return;

    startTransition(async () => {

      const result = await updatePropostaStatus(cancelarOpen.id, "cancelada");

      if (result.error) {

        toast({ variant: "destructive", title: "Erro", description: result.error });

        return;

      }

      toast({ title: result.message });

      setCancelarOpen(null);

      router.refresh();

    });

  }



  function confirmarExclusao() {

    if (!excluirOpen) return;

    startTransition(async () => {

      const result = await deleteProposta(excluirOpen.id);

      if (result.error) {

        toast({ variant: "destructive", title: "Erro", description: result.error });

        return;

      }

      toast({ title: result.message });

      setExcluirOpen(null);

      router.refresh();

    });

  }



  function podeFecharNegocio(proposta: Proposta): boolean {

    if (proposta.status !== "aceita") return false;

    if (!proposta.imovel_id) return false;

    return !imoveisNegocioFechado.has(proposta.imovel_id);

  }



  function abrirFecharNegocio(proposta: Proposta) {

    if (proposta.status !== "aceita") {

      toast({

        variant: "destructive",

        title: MSG_NEGOCIO_PROPOSTA_NAO_ACEITA,

      });

      return;

    }

    if (!podeFecharNegocio(proposta)) return;

    setFecharOpen(proposta);

  }



  return (

    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-2">

        <h3 className="font-semibold text-primary">Propostas</h3>

        <div className="flex gap-2">

          <Button

            size="sm"

            variant="outline"

            disabled={isPending}

            onClick={() =>

              startTransition(async () => {

                const r = await marcarNegocioPerdido(leadId);

                toast({ title: r.message, variant: r.error ? "destructive" : "default" });

                router.refresh();

              })

            }

          >

            Negócio perdido

          </Button>

          <Dialog open={open} onOpenChange={setOpen}>

            <DialogTrigger asChild>

              <Button size="sm">

                <Plus data-icon="inline-start" />

                Nova proposta

              </Button>

            </DialogTrigger>

            <DialogContent>

              <DialogHeader>

                <DialogTitle>Registrar proposta</DialogTitle>

              </DialogHeader>

              <div className="space-y-3">

                <div>

                  <Label>Imóvel</Label>

                  <Select value={imovelId} onValueChange={setImovelId}>

                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>

                    <SelectContent>

                      {imoveis.map((i) => (

                        <SelectItem key={i.id} value={i.id}>{i.titulo ?? i.codigo}</SelectItem>

                      ))}

                    </SelectContent>

                  </Select>

                </div>

                <div>

                  <Label>Valor proposto</Label>

                  <CurrencyInput value={valor} onChange={setValor} />

                </div>

                <div>

                  <Label>Data</Label>

                  <Input type="date" value={dataProposta} onChange={(e) => setDataProposta(e.target.value)} />

                </div>

                <div>

                  <Label>Observações</Label>

                  <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

                </div>

                <Button onClick={registrar} disabled={isPending} className="w-full">

                  {isPending ? <Loader2 className="size-4 animate-spin" /> : "Registrar"}

                </Button>

              </div>

            </DialogContent>

          </Dialog>

        </div>

      </div>



      {propostas.length === 0 ? (

        <p className="text-sm text-muted-foreground">Nenhuma proposta registrada.</p>

      ) : (

        <div className="grid gap-4">

          {propostas.map((proposta) => {

            const imovel = proposta.imovel;

            const statusInfo =

              STATUS_PROPOSTA[proposta.status] ?? STATUS_PROPOSTA.em_analise;

            const badgeVariant = proposta.imovel_id

              ? getImovelWorkflowBadgeVariant(proposta.imovel_id, {

                  negocios: imoveisNegocioFechado,

                })

              : null;



            return (

              <Card key={proposta.id} className="p-4">

                <div className="flex flex-col gap-4 sm:flex-row">

                  {imovel ? (

                    <ImovelAtendimentoResumo imovel={imovel} badgeVariant={badgeVariant} />

                  ) : (

                    <p className="text-sm text-muted-foreground">Imóvel não informado</p>

                  )}



                  <div className="flex min-w-0 flex-col items-start text-left sm:min-w-[200px]">

                    <span

                      className="text-sm font-semibold"

                      style={{ color: statusInfo.color }}

                    >

                      {statusInfo.label}

                    </span>

                    <p className="mt-1 text-lg font-semibold text-primary">

                      {formatCurrency(Number(proposta.valor_proposto))}

                    </p>

                    <p className="text-xs text-muted-foreground">

                      {format(new Date(proposta.data_proposta), "dd/MM/yyyy")}

                    </p>

                    {proposta.observacoes?.trim() ? (

                      <p className="mt-2 text-sm text-muted-foreground">

                        {truncateText(proposta.observacoes.trim())}

                      </p>

                    ) : null}

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

                        action="editar"

                        disabled={proposta.status === "cancelada"}

                        onClick={(event) => {

                          event.preventDefault();

                          setEditOpen(proposta);

                        }}

                      >

                        Editar proposta

                      </ActionMenuItem>

                      <DropdownMenuSub>

                        <DropdownMenuSubTrigger>

                          <ActionMenuIcon action="alterarStatus" />

                          Alterar Status

                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent>

                          {STATUS_OPTIONS.map((opt) => (

                            <DropdownMenuItem

                              key={opt.value}

                              disabled={proposta.status === opt.value}

                              onClick={(event) => {

                                event.preventDefault();

                                alterarStatus(proposta.id, opt.value);

                              }}

                            >

                              {opt.label}

                            </DropdownMenuItem>

                          ))}

                        </DropdownMenuSubContent>

                      </DropdownMenuSub>

                      {proposta.status === "aceita" && proposta.imovel_id && !imoveisNegocioFechado.has(proposta.imovel_id) ? (

                        <ActionMenuItem

                          action="fecharNegocio"

                          onClick={(event) => {

                            event.preventDefault();

                            abrirFecharNegocio(proposta);

                          }}

                        >

                          Fechar negócio

                        </ActionMenuItem>

                      ) : proposta.status !== "aceita" && !PROPOSTA_INATIVA.has(proposta.status) ? (

                        <ActionMenuItem

                          action="fecharNegocio"

                          disabled

                          onClick={(event) => {

                            event.preventDefault();

                            toast({

                              variant: "destructive",

                              title: MSG_NEGOCIO_PROPOSTA_NAO_ACEITA,

                            });

                          }}

                        >

                          Fechar negócio

                        </ActionMenuItem>

                      ) : null}

                      {proposta.status !== "cancelada" ? (

                        <ActionMenuItem

                          action="cancelar"

                          onClick={(event) => {

                            event.preventDefault();

                            setCancelarOpen(proposta);

                          }}

                        >

                          Cancelar Proposta

                        </ActionMenuItem>

                      ) : null}

                      <DropdownMenuSeparator />

                      <ActionMenuItem

                        action="excluir"

                        destructive

                        onClick={(event) => {

                          event.preventDefault();

                          setExcluirOpen(proposta);

                        }}

                      >

                        Excluir Proposta

                      </ActionMenuItem>

                    </DropdownMenuContent>

                  </DropdownMenu>

                </div>

              </Card>

            );

          })}

        </div>

      )}



      <PropostaEditModal

        proposta={editOpen}

        open={Boolean(editOpen)}

        onOpenChange={(o) => !o && setEditOpen(null)}

      />



      <FecharNegocioModal

        leadId={leadId}

        proposta={fecharOpen}

        open={Boolean(fecharOpen)}

        onOpenChange={handleFecharOpenChange}

        perfis={perfis}

        perfilAtualId={perfilAtualId}

      />



      <Dialog open={Boolean(cancelarOpen)} onOpenChange={(o) => !o && setCancelarOpen(null)}>

        <DialogContent className="sm:max-w-md">

          <DialogHeader>

            <DialogTitle>Cancelar proposta</DialogTitle>

          </DialogHeader>

          <p className="text-sm text-muted-foreground">

            A proposta será marcada como cancelada, mas permanecerá registrada no atendimento.

            Deseja continuar?

          </p>

          <div className="flex gap-2">

            <Button

              variant="outline"

              className="flex-1"

              disabled={isPending}

              onClick={() => setCancelarOpen(null)}

            >

              Voltar

            </Button>

            <Button

              variant="destructive"

              className="flex-1"

              disabled={isPending}

              onClick={cancelarProposta}

            >

              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Cancelar proposta"}

            </Button>

          </div>

        </DialogContent>

      </Dialog>



      <Dialog open={Boolean(excluirOpen)} onOpenChange={(o) => !o && setExcluirOpen(null)}>

        <DialogContent className="sm:max-w-md">

          <DialogHeader>

            <DialogTitle>Excluir proposta</DialogTitle>

          </DialogHeader>

          <p className="text-sm text-muted-foreground">

            Esta ação remove a proposta permanentemente do atendimento. Deseja continuar?

          </p>

          <div className="flex gap-2">

            <Button

              variant="outline"

              className="flex-1"

              disabled={isPending}

              onClick={() => setExcluirOpen(null)}

            >

              Voltar

            </Button>

            <Button

              variant="destructive"

              className="flex-1"

              disabled={isPending}

              onClick={confirmarExclusao}

            >

              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Excluir proposta"}

            </Button>

          </div>

        </DialogContent>

      </Dialog>

    </div>

  );

}


