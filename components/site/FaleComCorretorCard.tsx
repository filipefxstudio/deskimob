"use client";

import { formatCurrency, getValorExibicao } from "@/lib/site/format";
import { getSiteCreci, getSiteNomeExibicao } from "@/lib/site/social";
import { cn } from "@/lib/utils";
import type { Corretor, FinalidadeImovel } from "@/types";

import { FormularioLeadSite } from "./FormularioLeadSite";

interface FaleComCorretorCardProps {
  corretor: Corretor;
  imovelId: string;
  finalidade: FinalidadeImovel;
  valorVenda?: number | null;
  valorLocacao?: number | null;
  valorCondominio?: number | null;
  valorIptu?: number | null;
  className?: string;
}

export function FaleComCorretorCard({
  corretor,
  imovelId,
  finalidade,
  valorVenda,
  valorLocacao,
  valorCondominio,
  valorIptu,
  className,
}: FaleComCorretorCardProps) {
  const nomeExibicao = getSiteNomeExibicao(corretor);
  const creci = getSiteCreci(corretor);
  const valorImovel = { finalidade, valor_venda: valorVenda, valor_locacao: valorLocacao };

  return (
    <aside
      className={cn(
        "h-fit min-w-0 rounded-2xl border border-border bg-white p-6 shadow-sm lg:sticky lg:top-24 lg:w-[320px]",
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-primary">Fale com o corretor</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {nomeExibicao}
        {creci ? ` · CRECI ${creci}` : ""}
      </p>

      <div className="mt-4 space-y-2 border-b border-border pb-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-semibold text-primary">{getValorExibicao(valorImovel)}</span>
        </div>
        {valorCondominio ? (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Condomínio</span>
            <span>{formatCurrency(valorCondominio)}</span>
          </div>
        ) : null}
        {valorIptu ? (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">IPTU</span>
            <span>{formatCurrency(valorIptu)}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <FormularioLeadSite
          imovelId={imovelId}
          submitLabel="Enviar mensagem"
          observacoesPlaceholder="Tenho interesse neste imóvel..."
          showPreferenciaContato
        />
      </div>
    </aside>
  );
}
