import Link from "next/link";
import { headers } from "next/headers";
import { MapPin } from "lucide-react";

import { ImovelStats } from "@/components/imoveis/ImovelStats";

import { FaleComCorretorCard } from "@/components/site/FaleComCorretorCard";
import { ImovelGaleriaPublica } from "@/components/site/ImovelGaleriaPublica";
import { ImovelMapa } from "@/components/site/ImovelMapa";
import { SiteImovelDetalheBackButton } from "@/components/site/SiteImovelDetalheBackButton";
import {
  deveExibirMapaPublico,
  formatEndereco,
  getCapaUrl,
  getFinalidadeLabel,
  getTipoLabel,
  getValorExibicao,
} from "@/lib/site/format";
import { sitePath } from "@/lib/site/paths";
import type { Corretor, Imovel } from "@/types";

interface SiteImovelDetalheContentProps {
  corretor: Corretor;
  imovel: Imovel;
  basePath: string;
  absolutePageUrl: string;
}

function buildAbsoluteUrl(path: string): string {
  const mainDomain = process.env.NEXT_PUBLIC_DOMAIN || "deskimob.com.br";
  return `https://${mainDomain}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function SiteImovelDetalheContent({
  corretor,
  imovel,
  basePath,
  absolutePageUrl,
}: SiteImovelDetalheContentProps) {
  const endereco = formatEndereco(imovel);
  const preco = imovel.finalidade === "venda" ? imovel.valor_venda : imovel.valor_locacao;
  const exibirLocalizacao = (imovel.exibir_endereco_site ?? "apenas_bairro") !== "oculto";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: imovel.titulo ?? "Imóvel disponível",
    description: imovel.descricao ?? undefined,
    url: absolutePageUrl,
    image: getCapaUrl(imovel) ?? undefined,
    address: exibirLocalizacao
      ? {
          "@type": "PostalAddress",
          streetAddress:
            imovel.exibir_endereco_site === "completo"
              ? [imovel.logradouro, imovel.numero].filter(Boolean).join(", ") || undefined
              : undefined,
          addressLocality: imovel.cidade ?? undefined,
          addressRegion: imovel.estado ?? undefined,
          postalCode: imovel.cep ?? undefined,
          addressCountry: "BR",
        }
      : undefined,
    geo:
      exibirLocalizacao && imovel.latitude && imovel.longitude
        ? {
            "@type": "GeoCoordinates",
            latitude: imovel.latitude,
            longitude: imovel.longitude,
          }
        : undefined,
    offers: preco
      ? {
          "@type": "Offer",
          price: String(preco),
          priceCurrency: "BRL",
          availability: "https://schema.org/InStock",
        }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ImovelGaleriaPublica
        fotos={imovel.fotos ?? []}
        titulo={imovel.titulo ?? "Imóvel"}
        videoUrl={imovel.video_url}
        mapa={
          deveExibirMapaPublico(imovel) && imovel.latitude && imovel.longitude
            ? {
                latitude: imovel.latitude,
                longitude: imovel.longitude,
                endereco,
              }
            : null
        }
      />

      <div className="mx-auto min-w-0 max-w-7xl overflow-x-hidden px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8 lg:px-8">
        <SiteImovelDetalheBackButton />

        <div className="mb-6 hidden text-sm text-muted-foreground sm:block">
          <Link href={sitePath(basePath, "/imoveis")} className="hover:text-primary">
            Imóveis
          </Link>
          <span className="mx-2">/</span>
          <span className="break-words">{imovel.titulo ?? "Detalhes"}</span>
        </div>

        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            <section className="min-w-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium uppercase tracking-wide"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {getFinalidadeLabel(imovel.finalidade)} · {getTipoLabel(imovel.tipo)}
                  </p>
                  <h1 className="mt-2 break-words text-2xl font-bold text-primary sm:text-3xl">
                    {imovel.titulo ?? "Imóvel disponível"}
                  </h1>
                  {endereco ? (
                    <p className="mt-3 inline-flex max-w-full items-start gap-2 break-words text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      <span>{endereco}</span>
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xl font-bold text-primary sm:text-2xl">
                  {getValorExibicao(imovel)}
                </p>
              </div>
            </section>

            <ImovelStats
              imovel={imovel}
              variant="site-detail"
              showAreaTotal
              iconClassName="text-primary"
            />

            {imovel.descricao ? (
              <section className="min-w-0">
                <h2 className="text-xl font-semibold text-primary">Descrição</h2>
                <p className="mt-3 break-words whitespace-pre-line leading-relaxed text-muted-foreground">
                  {imovel.descricao}
                </p>
              </section>
            ) : null}

            {imovel.diferenciais && imovel.diferenciais.length > 0 ? (
              <section>
                <h2 className="text-xl font-semibold text-primary">Diferenciais</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {imovel.diferenciais.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-muted px-3 py-1 text-sm text-[#2D3748]"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {deveExibirMapaPublico(imovel) ? (
              <section>
                <h2 className="mb-4 text-xl font-semibold text-primary">Localização</h2>
                <ImovelMapa
                  latitude={imovel.latitude!}
                  longitude={imovel.longitude!}
                  endereco={endereco}
                />
              </section>
            ) : null}
          </div>

          <FaleComCorretorCard corretor={corretor} imovel={imovel} className="min-w-0" />
        </div>
      </div>
    </>
  );
}

export async function resolveAbsolutePageUrl(basePath: string, slug: string): Promise<string> {
  const pagePath = sitePath(basePath, `/imoveis/${slug}`);
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  return host ? `${protocol}://${host}${pagePath}` : buildAbsoluteUrl(pagePath);
}
