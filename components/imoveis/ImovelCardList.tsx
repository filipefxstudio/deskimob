"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconAreaUtil,
  IconBanheiro,
  IconQuartos,
  IconSuite,
  IconVagas,
} from "@/components/icons/ImovelStatIcons";

import { ImovelAcoesDropdown } from "@/components/imoveis/ImovelAcoesDropdown";
import { StatusBadge } from "@/components/imoveis/StatusBadge";
import {
  formatCurrency,
  formatEnderecoCurto,
  getImovelCodigo,
  getValorNumerico,
} from "@/lib/imoveis/format";
import {
  getCapaUrl,
  getFinalidadeLabel,
  getTipoLabel,
} from "@/lib/site/format";
import { getCaptadorPrincipalNome } from "@/lib/imoveis/captador";
import type { Imovel, StatusImovel } from "@/types";

function formatCaptadorLinha(imovel: Imovel, codigo: string): string {
  const captador = getCaptadorPrincipalNome(imovel);
  if (captador) {
    return `${codigo} • ${captador}`;
  }
  return codigo;
}

interface ImovelListItemProps {
  imovel: Imovel;
  corretorSlug: string;
  statusList: StatusImovel[];
  linkTarget?: "_blank" | "_self";
  renderCardActions?: (imovel: Imovel) => ReactNode;
  cardBadge?: ReactNode;
}

function ImovelListItem({
  imovel,
  corretorSlug,
  statusList,
  linkTarget = "_self",
  renderCardActions,
  cardBadge,
}: ImovelListItemProps) {
  const capa = getCapaUrl(imovel);
  const codigo = getImovelCodigo(imovel);
  const valor = getValorNumerico(imovel);
  const valorFormatado =
    imovel.finalidade === "venda"
      ? formatCurrency(valor)
      : `${formatCurrency(valor)}/mês`;

  return (
    <article className="group overflow-hidden rounded-xl bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/dashboard/imoveis/${imovel.id}`}
        className="flex flex-col gap-4 p-4 pb-2 sm:flex-row sm:items-center"
        target={linkTarget}
        rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined}
      >
        <div className="relative size-full shrink-0 overflow-hidden rounded-lg bg-muted sm:size-32">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capa}
              alt=""
              className="aspect-[4/3] size-full object-cover sm:aspect-square"
            />
          ) : (
            <div className="flex aspect-[4/3] size-full items-center justify-center text-sm text-muted-foreground sm:aspect-square">
              Sem foto
            </div>
          )}
          <div className="absolute left-2 top-2 sm:hidden">
            <StatusBadge status={imovel.status} statusImovel={imovel.status_imovel} />
          </div>
          {cardBadge ? <div className="absolute right-2 top-2">{cardBadge}</div> : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {getTipoLabel(imovel.tipo)} • {getFinalidadeLabel(imovel.finalidade)}
                </p>
                <span className="hidden sm:inline">
                  <StatusBadge status={imovel.status} statusImovel={imovel.status_imovel} />
                </span>
              </div>
              <p className="mt-1 truncate text-base font-bold text-foreground">
                {imovel.bairro ?? "—"}
              </p>
              <p className="text-sm text-muted-foreground">{formatEnderecoCurto(imovel)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-black text-primary">{valorFormatado}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {imovel.area_util ? (
              <span className="inline-flex items-center gap-1.5">
                <IconAreaUtil className="text-muted-foreground" />
                {imovel.area_util} m²
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <IconQuartos className="text-muted-foreground" />
              {imovel.quartos} quartos
            </span>
            {imovel.suites > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <IconSuite className="text-muted-foreground" />
                {imovel.suites} suítes
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <IconBanheiro className="text-muted-foreground" />
              {imovel.banheiros} banh.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconVagas className="text-muted-foreground" />
              {imovel.vagas} vagas
            </span>
          </div>
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

interface ImovelCardListProps {
  imoveis: Imovel[];
  corretorSlug: string;
  statusList: StatusImovel[];
  linkTarget?: "_blank" | "_self";
  renderCardActions?: (imovel: Imovel) => ReactNode;
  getCardBadge?: (imovel: Imovel) => ReactNode;
}

export function ImovelCardList({
  imoveis,
  corretorSlug,
  statusList,
  linkTarget,
  renderCardActions,
  getCardBadge,
}: ImovelCardListProps) {
  return (
    <div className="space-y-4">
      {imoveis.map((imovel) => (
        <ImovelListItem
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
