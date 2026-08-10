import { FINALIDADES_IMOVEL, TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import { getSiteNomeExibicao } from "@/lib/site/social";
import type { Corretor } from "@/types";

import { FiltrosBusca } from "./FiltrosBusca";
import { SiteProvider } from "./SiteProvider";

interface HeroBuscaProps {
  corretor: Corretor;
  basePath: string;
  bairros: string[];
}

export function HeroBusca({ corretor, basePath, bairros }: HeroBuscaProps) {
  const nomeExibicao = getSiteNomeExibicao(corretor);

  return (
    <section className="relative overflow-hidden bg-primary text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(241,143,1,0.25),transparent_55%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/70">
            Imóveis selecionados
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Encontre o imóvel ideal com {nomeExibicao}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/80 sm:text-lg">
            Apartamentos, casas e oportunidades para compra ou locação com atendimento
            personalizado.
          </p>
        </div>

        <div className="mt-10">
          <SiteProvider corretor={corretor} basePath={basePath}>
            <FiltrosBusca bairros={bairros} layout="hero" />
          </SiteProvider>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/70">
          {TIPOS_IMOVEL.slice(0, 4).map((item) => (
            <span key={item.value} className="rounded-full border border-white/20 px-3 py-1">
              {item.label}
            </span>
          ))}
          {FINALIDADES_IMOVEL.map((item) => (
            <span key={item.value} className="rounded-full border border-white/20 px-3 py-1">
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
