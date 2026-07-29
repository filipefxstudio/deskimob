"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ImovelStats } from "@/components/imoveis/ImovelStats";

import { ImovelAcoesDropdown } from "@/components/imoveis/ImovelAcoesDropdown";
import { ImovelCardFotoCarousel } from "@/components/imoveis/ImovelCardFotoCarousel";
import { StatusBadge } from "@/components/imoveis/StatusBadge";
import {
  formatCurrency,
  formatEnderecoCurto,
  getImovelCodigo,
  getValorNumerico,
} from "@/lib/imoveis/format";
import {
  getFinalidadeLabel,
  getTipoLabel,
} from "@/lib/site/format";
import { getCaptadorPrincipalNome } from "@/lib/imoveis/captador";
import {
  getListingScrollPosition,
  saveListingReturnState,
} from "@/lib/site/listing-return";
import type { Imovel, StatusImovel } from "@/types";

function formatCaptadorLinha(imovel: Imovel, codigo: string): string {
  const captador = getCaptadorPrincipalNome(imovel);
  if (captador) {
    return `${codigo} • ${captador}`;
  }
  return codigo;
}

interface ImovelCardItemProps {
  imovel: Imovel;
  corretorSlug: string;
  statusList: StatusImovel[];
  linkTarget?: "_blank" | "_self";
  renderCardActions?: (imovel: Imovel) => ReactNode;
  cardBadge?: ReactNode;
}

function ImovelCardItem({
  imovel,
  corretorSlug,
  statusList,
  linkTarget = "_self",
  renderCardActions,
  cardBadge,
}: ImovelCardItemProps) {
  const codigo = getImovelCodigo(imovel);
  const valor = getValorNumerico(imovel);
  const valorFormatado =
    imovel.finalidade === "venda"
      ? formatCurrency(valor)
      : `${formatCurrency(valor)}/mês`;

  function handleOpenDetalhe() {
    if (linkTarget === "_blank") {
      return;
    }

    saveListingReturnState(
      `${window.location.pathname}${window.location.search}`,
      getListingScrollPosition(),
    );
  }

  return (
    <article className="group overflow-hidden rounded-xl bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/dashboard/imoveis/${imovel.id}`}
        className="block"
        target={linkTarget}
        rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined}
        onClick={handleOpenDetalhe}
      >
        <ImovelCardFotoCarousel
          fotos={imovel.fotos ?? []}
          alt={imovel.titulo ?? "Imóvel"}
          imageClassName="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          badges={
            <>
              <div className="absolute left-3 top-3">
                <StatusBadge status={imovel.status} statusImovel={imovel.status_imovel} />
              </div>
              {cardBadge ? <div className="absolute right-3 top-3">{cardBadge}</div> : null}
            </>
          }
        />

        <div className="space-y-2.5 p-4">
          <p className="text-xs text-muted-foreground">
            {getTipoLabel(imovel.tipo)} • {getFinalidadeLabel(imovel.finalidade)}
          </p>

          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">{imovel.bairro ?? "—"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatEnderecoCurto(imovel)}
            </p>
          </div>

          <p className="text-xl font-black text-primary">{valorFormatado}</p>

          <ImovelStats
            imovel={imovel}
            variant="card"
            iconClassName="text-muted-foreground"
          />
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 px-4 pb-4 pt-1">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {formatCaptadorLinha(imovel, codigo)}
        </p>
        {renderCardActions ? (
          <div className="shrink-0">{renderCardActions(imovel)}</div>
        ) : (
          <ImovelAcoesDropdown
            imovel={imovel}
            corretorSlug={corretorSlug}
            statusList={statusList}
            variant="card"
            className="shrink-0"
          />
        )}
      </div>
    </article>
  );
}

interface ImovelCardGridProps {
  imoveis: Imovel[];
  corretorSlug: string;
  statusList: StatusImovel[];
  linkTarget?: "_blank" | "_self";
  renderCardActions?: (imovel: Imovel) => ReactNode;
  getCardBadge?: (imovel: Imovel) => ReactNode;
}

export function ImovelCardGrid({
  imoveis,
  corretorSlug,
  statusList,
  linkTarget,
  renderCardActions,
  getCardBadge,
}: ImovelCardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {imoveis.map((imovel) => (
        <ImovelCardItem
          key={imovel.id}
          imovel={imovel}
          corretorSlug={corretorSlug}
          statusList={statusList}
          linkTarget={linkTarget}
          renderCardActions={renderCardActions}
          cardBadge={getCardBadge?.(imovel)}
        />
      ))}
    </div>
  );
}
