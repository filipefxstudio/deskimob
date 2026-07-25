"use client";

import Link from "next/link";
import { Bath, BedDouble, BedSingle, Car, Maximize2, type LucideIcon } from "lucide-react";

import {
  getBairroCidadeCardLabel,
  getCapaUrl,
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

function StatItem({ icon: Icon, value }: { icon: LucideIcon; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="text-sm leading-none">{value}</span>
    </span>
  );
}

export function ImovelCardPublico({ imovel }: ImovelCardPublicoProps) {
  const { link } = useSite();
  const capa = getCapaUrl(imovel);
  const href = link(`/imoveis/${imovel.slug ?? imovel.id}`);
  const bairroCidade = getBairroCidadeCardLabel(imovel);
  const linhaSecundaria = getEnderecoCardSecundario(imovel);

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capa}
              alt={imovel.titulo ?? "Imóvel"}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
              Sem foto
            </div>
          )}

          {imovel.destaque_site ? (
            <span className="absolute left-3 top-3 rounded-full bg-[#F4B400] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              Destaque
            </span>
          ) : null}
        </div>

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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {imovel.area_util ? (
              <StatItem icon={Maximize2} value={`${imovel.area_util} m²`} />
            ) : null}
            {imovel.quartos > 0 ? <StatItem icon={BedDouble} value={imovel.quartos} /> : null}
            {imovel.suites > 0 ? <StatItem icon={BedSingle} value={imovel.suites} /> : null}
            {imovel.banheiros > 0 ? <StatItem icon={Bath} value={imovel.banheiros} /> : null}
            {imovel.vagas > 0 ? <StatItem icon={Car} value={imovel.vagas} /> : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
