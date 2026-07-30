import { headers } from "next/headers";
import { MapPin } from "lucide-react";

import { ImovelStats } from "@/components/imoveis/ImovelStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { FaleComCorretorCard } from "@/components/site/FaleComCorretorCard";
import { ImovelGaleriaPublica } from "@/components/site/ImovelGaleriaPublica";
import { ImovelMapa } from "@/components/site/ImovelMapa";
import { SiteImovelDetalheStickyBar } from "@/components/site/SiteImovelDetalheStickyBar";
import {
  deveExibirMapaPublico,
  formatCurrency,
  formatEndereco,
  getCapaUrl,
  getFinalidadeLabel,
  getImovelCodigoSite,
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

function formatValorSecundario(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "R$ —";
  }

  return formatCurrency(value);
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
  const titulo = imovel.titulo ?? "Imóvel disponível";
  const codigo = getImovelCodigoSite(imovel);
  const hasMap = deveExibirMapaPublico(imovel);

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

      <SiteImovelDetalheStickyBar
        imoveisHref={sitePath(basePath, "/imoveis")}
        titulo={titulo}
      />

      <div className="mx-auto min-w-0 max-w-7xl px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8 lg:px-8">
        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            <div className="flex flex-col gap-6">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{getTipoLabel(imovel.tipo)}</span>
                    <p className="shrink-0 text-lg font-medium text-muted-foreground">{codigo}</p>
                  </div>

                  <h1 className="break-words text-xl font-semibold text-primary md:text-2xl">{titulo}</h1>

                  <ImovelStats
                    imovel={imovel}
                    variant="detail-prominent"
                    showAreaTotal
                    iconClassName="text-primary"
                  />
                </CardContent>
              </Card>

              <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-stretch">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Valores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {getFinalidadeLabel(imovel.finalidade)}
                        </p>
                        <p className="text-3xl font-black tracking-tight text-primary md:text-4xl">
                          {getValorExibicao(imovel)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-x-8 gap-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Condomínio</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatValorSecundario(imovel.valor_condominio)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">IPTU</p>
                          <p className="text-lg font-semibold text-foreground">
                            {formatValorSecundario(imovel.valor_iptu)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="flex min-w-0 flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle>Localização</CardTitle>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                    <div className="flex shrink-0 items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <p>{endereco || "Endereço não informado"}</p>
                    </div>
                    {hasMap ? (
                      <div className="min-h-[200px] flex-1">
                        <ImovelMapa
                          fill
                          latitude={imovel.latitude!}
                          longitude={imovel.longitude!}
                          endereco={endereco}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Mapa indisponível para este imóvel.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

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
          </div>

          <FaleComCorretorCard
            corretor={corretor}
            imovel={imovel}
            className="min-w-0 lg:top-44"
          />
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
