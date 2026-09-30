"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";

import { ImovelCardGrid } from "@/components/imoveis/ImovelCardGrid";
import { Button } from "@/components/ui/button";
import { selecionarImovel } from "@/lib/actions/atendimentos";
import { toast } from "@/hooks/use-toast";
import type { Imovel, LeadImovelSelecionado, StatusImovel } from "@/types";

interface RadarImoveisTabProps {
  leadId: string;
  imoveis: Imovel[];
  selecionados: LeadImovelSelecionado[];
  corretorSlug: string;
  statusList: StatusImovel[];
}

export function RadarImoveisTab({
  leadId,
  imoveis,
  selecionados,
  corretorSlug,
  statusList,
}: RadarImoveisTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selecionadosIds = new Set(selecionados.map((s) => s.imovel_id));
  const imovelInteresseInicialId = selecionados.find((s) => s.interesse_inicial)?.imovel_id;

  function handleSelecionar(imovelId: string) {
    startTransition(async () => {
      const result = await selecionarImovel(leadId, imovelId);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      router.refresh();
    });
  }

  if (imoveis.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum imóvel compatível com as preferências do atendimento.
      </p>
    );
  }

  return (
    <ImovelCardGrid
      imoveis={imoveis}
      corretorSlug={corretorSlug}
      statusList={statusList}
      linkTarget="_blank"
      getCardBadge={(imovel) =>
        imovel.id === imovelInteresseInicialId ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-foreground">
            Interesse inicial
          </span>
        ) : null
      }
      renderCardActions={(imovel) => {
        const jaSelecionado = selecionadosIds.has(imovel.id);

        if (jaSelecionado) {
          return (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Check className="size-3.5" />
              Selecionado
            </span>
          );
        }

        return (
          <Button
            size="sm"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleSelecionar(imovel.id);
            }}
          >
            Selecionar
          </Button>
        );
      }}
    />
  );
}
