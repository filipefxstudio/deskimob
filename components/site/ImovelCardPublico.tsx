"use client";

import Link from "next/link";

import { ImovelStats } from "@/components/imoveis/ImovelStats";
import { ImovelCardFotoCarousel } from "@/components/imoveis/ImovelCardFotoCarousel";

import {
  getListingScrollPosition,
  saveListingReturnState,
} from "@/lib/site/listing-return";
import {
  getBairroCidadeCardLabel,
  getEnderecoCardSecundario,
  getImovelCodigoSite,
  getTipoFinalidadeCardLabel,
  getValorExibicao,
} from "@/lib/site/format";
import type { Imovel } from "@/types";

import { useSite } from "./SiteProvider";

interface ImovelCardPublicoProps {
  imovel: Imovel;
}

export function ImovelCardPublico({ imovel }: ImovelCardPublicoProps) {
  const { link } = useSite();
  const href = link(`/imoveis/${imovel.slug ?? imovel.id}`);
  const bairroCidade = getBairroCidadeCardLabel(imovel);
  const linhaSecundaria = getEnderecoCardSecundario(imovel);

  function handleOpenDetalhe() {
    saveListingReturnState(
      `${window.location.pathname}${window.location.search}`,
      getListingScrollPosition(),
    );
  }

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={href} className="block" onClick={handleOpenDetalhe}>
        <ImovelCardFotoCarousel
          fotos={imovel.fotos ?? []}
          alt={imovel.titulo ?? "Imóvel"}
          badges={
            imovel.destaque_site ? (
              <span className="absolute left-3 top-3 rounded-full bg-[#F4B400] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                Destaque
              </span>
            ) : null
          }
        />

        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {getTipoFinalidadeCardLabel(imovel)}
            </span>
            <span className="shrink-0 text-xs font-semibold text-[#2D3748]">
              {getImovelCodigoSite(imovel)}
            </span>
          </div>

          {bairroCidade ? (
            <p className="text-sm font-bold text-[#2D3748]">{bairroCidade}</p>
          ) : null}

          {linhaSecundaria ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{linhaSecundaria}</p>
          ) : null}

          <p className="pt-1 text-xl font-black text-black">{getValorExibicao(imovel)}</p>

          <ImovelStats imovel={imovel} variant="card" className="pt-1" />
        </div>
      </Link>
    </article>
  );
}
