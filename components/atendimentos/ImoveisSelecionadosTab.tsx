"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Search } from "lucide-react";

import { ActionMenuItem } from "@/components/ui/action-menu-item";

import { ImovelPhotoBadge } from "@/components/atendimentos/ImovelPhotoBadge";
import { ImovelInteresseAutocomplete } from "@/components/atendimentos/ImovelInteresseAutocomplete";
import { buildImoveisComVisitaAgendada } from "@/lib/atendimentos/badges";
import { ImovelCardGrid } from "@/components/imoveis/ImovelCardGrid";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createVisita,
  removerImovelSelecionado,
  selecionarImovel,
} from "@/lib/actions/atendimentos";
import { getPreviewImovelShareUrl } from "@/lib/atendimentos/share-url";
import type { CorretorShareHost } from "@/lib/imoveis/share-url";
import { contemNormalizado } from "@/lib/utils/normalizar";
import { toast } from "@/hooks/use-toast";
import type { Imovel, LeadImovelSelecionado, StatusImovel, Visita } from "@/types";

interface ImoveisSelecionadosTabProps {
  leadId: string;
  selecionados: LeadImovelSelecionado[];
  visitas: Visita[];
  corretorSlug: string;
  corretorShareHost: CorretorShareHost;
  statusList: StatusImovel[];
}

export function ImoveisSelecionadosTab({
  leadId,
  selecionados,
  visitas,
  corretorSlug,
  corretorShareHost,
  statusList,
}: ImoveisSelecionadosTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState("");
  const [visitaOpen, setVisitaOpen] = useState<string | null>(null);
  const [dataAgenda, setDataAgenda] = useState("");
  const [horaAgenda, setHoraAgenda] = useState("");
  const [obsVisita, setObsVisita] = useState("");

  const filtrados = useMemo(() => {
    if (!busca.trim()) return selecionados;
    return selecionados.filter((item) => {
      const imovel = item.imovel;
      if (!imovel) return false;
      const campos = [imovel.titulo, imovel.codigo, imovel.bairro, imovel.logradouro];
      return campos.some((c) => contemNormalizado(c, busca));
    });
  }, [selecionados, busca]);

  const imoveis = useMemo(
    () => filtrados.map((item) => item.imovel).filter((imovel): imovel is Imovel => Boolean(imovel)),
    [filtrados],
  );

  const selecionadosPorImovel = useMemo(
    () => new Map(filtrados.map((item) => [item.imovel_id, item])),
    [filtrados],
  );

  const imoveisComVisita = useMemo(
    () => buildImoveisComVisitaAgendada(visitas),
    [visitas],
  );

  function fecharDialogVisita() {
    setVisitaOpen(null);
    setDataAgenda("");
    setHoraAgenda("");
    setObsVisita("");
  }

  function remover(imovelId: string) {
    startTransition(async () => {
      const result = await removerImovelSelecionado(leadId, imovelId);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      router.refresh();
    });
  }

  function copiarLink(token: string) {
    const url = getPreviewImovelShareUrl(token, corretorShareHost);
    void navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  }

  function agendarVisita(imovelId: string) {
    if (!dataAgenda || !horaAgenda) {
      toast({ variant: "destructive", title: "Informe data e hora." });
      return;
    }
    startTransition(async () => {
      const result = await createVisita(leadId, {
        imovel_id: imovelId,
        data_visita: `${dataAgenda}T${horaAgenda}`,
        observacoes: obsVisita,
      });
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      fecharDialogVisita();
      router.refresh();
    });
  }

  function adicionarImovel(imovel: NonNullable<LeadImovelSelecionado["imovel"]>) {
    startTransition(async () => {
      const result = await selecionarImovel(leadId, imovel.id);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Buscar imóvel para adicionar</Label>
        <ImovelInteresseAutocomplete
          value={null}
          onChange={(imovel) => {
            if (imovel) {
              const jaExiste = selecionados.some((s) => s.imovel_id === imovel.id);
              if (jaExiste) {
                toast({ title: "Imóvel já está na seleção." });
                return;
              }
              adicionarImovel(imovel as Imovel);
            }
          }}
          disabled={isPending}
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Filtrar imóveis selecionados"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {imoveis.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum imóvel selecionado. Use o Radar ou a busca acima para adicionar imóveis.
        </p>
      ) : (
        <ImovelCardGrid
          imoveis={imoveis}
          corretorSlug={corretorSlug}
          statusList={statusList}
          linkTarget="_blank"
          getCardBadge={(imovel) => {
            const item = selecionadosPorImovel.get(imovel.id);
            if (imoveisComVisita.has(imovel.id)) {
              return <ImovelPhotoBadge variant="visita" />;
            }
            return item?.interesse_inicial ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                Interesse inicial
              </span>
            ) : null;
          }}
          renderCardActions={(imovel) => {
            const item = selecionadosPorImovel.get(imovel.id);
            if (!item) return null;

            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    Ações
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <ActionMenuItem
                    action="agendarVisita"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDataAgenda("");
                      setHoraAgenda("");
                      setObsVisita("");
                      setVisitaOpen(item.imovel_id);
                    }}
                  >
                    Agendar visita
                  </ActionMenuItem>
                  <ActionMenuItem
                    action="compartilharLink"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      copiarLink(item.token_compartilhamento);
                    }}
                  >
                    Compartilhar link
                  </ActionMenuItem>
                  <ActionMenuItem
                    action="remover"
                    destructive
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      remover(item.imovel_id);
                    }}
                  >
                    Remover
                  </ActionMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }}
        />
      )}

      <Dialog open={Boolean(visitaOpen)} onOpenChange={(o) => !o && fecharDialogVisita()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="visita-data">Data</Label>
              <Input
                id="visita-data"
                type="date"
                value={dataAgenda}
                onChange={(e) => setDataAgenda(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="visita-hora">Hora</Label>
              <Input
                id="visita-hora"
                type="time"
                value={horaAgenda}
                onChange={(e) => setHoraAgenda(e.target.value)}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={obsVisita} onChange={(e) => setObsVisita(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={fecharDialogVisita}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={isPending}
                onClick={() => visitaOpen && agendarVisita(visitaOpen)}
              >
                Confirmar agendamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
