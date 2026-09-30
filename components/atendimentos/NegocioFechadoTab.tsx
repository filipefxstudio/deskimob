"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";

import { FecharNegocioModal } from "@/components/atendimentos/FecharNegocioModal";
import { ImovelAtendimentoResumo } from "@/components/atendimentos/ImovelAtendimentoResumo";
import { ActionMenuItem } from "@/components/ui/action-menu-item";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cancelarNegocio, deleteNegocio } from "@/lib/actions/atendimentos";
import { buildImoveisComNegocioFechado } from "@/lib/atendimentos/badges";
import { formatCurrency } from "@/lib/site/format";
import { toast } from "@/hooks/use-toast";
import type { FormaPagamentoNegocio, Negocio } from "@/types";

interface NegocioFechadoTabProps {
  leadId: string;
  negocios: Negocio[];
  perfis: { id: string; nome: string }[];
  perfilAtualId?: string | null;
}

const FORMA_PAGAMENTO_LABEL: Record<FormaPagamentoNegocio, string> = {
  avista: "À vista",
  financiado: "Financiado",
};

function formatFormaPagamento(forma?: FormaPagamentoNegocio | null): string {
  if (!forma) return "—";
  return FORMA_PAGAMENTO_LABEL[forma] ?? forma;
}

export function NegocioFechadoTab({
  leadId,
  negocios,
  perfis,
  perfilAtualId,
}: NegocioFechadoTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState<Negocio | null>(null);

  const handleEditOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) setEditOpen(null);
  }, []);
  const [cancelarOpen, setCancelarOpen] = useState<Negocio | null>(null);
  const [excluirOpen, setExcluirOpen] = useState<Negocio | null>(null);

  const negociosFechados = useMemo(
    () => negocios.filter((n) => n.status === "fechado"),
    [negocios],
  );

  const imoveisNegocioFechado = useMemo(
    () => buildImoveisComNegocioFechado(negociosFechados),
    [negociosFechados],
  );

  function gerarContratoStub() {
    toast({
      title: "Funcionalidade em desenvolvimento",
      description: "A geração de contratos estará disponível em breve.",
    });
  }

  function confirmarCancelamento() {
    if (!cancelarOpen) return;
    startTransition(async () => {
      const result = await cancelarNegocio(cancelarOpen.id);
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
      const result = await deleteNegocio(excluirOpen.id);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      setExcluirOpen(null);
      router.refresh();
    });
  }

  if (negociosFechados.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum negócio fechado. Feche a partir de uma proposta na aba Propostas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-primary">Negócio fechado</h3>

      <div className="grid gap-4">
        {negociosFechados.map((negocio) => {
          const imovel = negocio.imovel;
          const badgeVariant = negocio.imovel_id && imoveisNegocioFechado.has(negocio.imovel_id)
            ? ("negocio_fechado" as const)
            : null;

          return (
            <Card key={negocio.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                {imovel ? (
                  <ImovelAtendimentoResumo imovel={imovel} badgeVariant={badgeVariant} />
                ) : (
                  <p className="text-sm text-muted-foreground">Imóvel não informado</p>
                )}

                <div className="flex min-w-0 flex-col items-start text-left sm:min-w-[220px]">
                  <span className="text-sm font-semibold text-success">Negócio fechado</span>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {formatCurrency(Number(negocio.valor_fechamento))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fechamento: {format(new Date(negocio.data_fechamento), "dd/MM/yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pagamento: {formatFormaPagamento(negocio.forma_pagamento)}
                  </p>
                  {negocio.valor_comissao ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Comissão: {formatCurrency(Number(negocio.valor_comissao))}
                      {negocio.percentual_comissao
                        ? ` (${negocio.percentual_comissao}%)`
                        : ""}
                    </p>
                  ) : null}
                  {negocio.rateio?.length ? (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {negocio.rateio.map((item) => (
                        <p key={`${item.perfil_id}-${item.papel}`}>
                          {item.nome ?? perfis.find((p) => p.id === item.perfil_id)?.nome ?? "—"}:{" "}
                          {formatCurrency(item.valor)} ({item.percentual}%)
                        </p>
                      ))}
                    </div>
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
                      action="editarNegociacao"
                      onClick={(event) => {
                        event.preventDefault();
                        setEditOpen(negocio);
                      }}
                    >
                      Editar negociação
                    </ActionMenuItem>
                    <ActionMenuItem
                      action="gerarContrato"
                      onClick={(event) => {
                        event.preventDefault();
                        gerarContratoStub();
                      }}
                    >
                      Gerar contrato
                    </ActionMenuItem>
                    <ActionMenuItem
                      action="cancelarNegociacao"
                      onClick={(event) => {
                        event.preventDefault();
                        setCancelarOpen(negocio);
                      }}
                    >
                      Cancelar negociação
                    </ActionMenuItem>
                    <ActionMenuItem
                      action="excluirNegociacao"
                      destructive
                      onClick={(event) => {
                        event.preventDefault();
                        setExcluirOpen(negocio);
                      }}
                    >
                      Excluir negociação
                    </ActionMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          );
        })}
      </div>

      <FecharNegocioModal
        leadId={leadId}
        negocio={editOpen}
        open={Boolean(editOpen)}
        onOpenChange={handleEditOpenChange}
        perfis={perfis}
        perfilAtualId={perfilAtualId}
        mode="edit"
      />

      <Dialog open={Boolean(cancelarOpen)} onOpenChange={(o) => !o && setCancelarOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar negociação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A negociação será marcada como cancelada e o atendimento voltará para a etapa de
            propostas. Deseja continuar?
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
              onClick={confirmarCancelamento}
            >
              Cancelar negociação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(excluirOpen)} onOpenChange={(o) => !o && setExcluirOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir negociação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação remove a negociação permanentemente. Deseja continuar?
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
              Excluir negociação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
