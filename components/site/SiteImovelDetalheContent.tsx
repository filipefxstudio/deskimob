import Link from "next/link";
import { headers } from "next/headers";
import { MapPin } from "lucide-react";

import {
  IconAreaTotal,
  IconAreaUtil,
  IconBanheiro,
  IconQuartos,
  IconSuite,
  IconVagas,
} from "@/components/icons/ImovelStatIcons";

import { FaleComCorretorCard } from "@/components/site/FaleComCorretorCard";
import { ImovelGaleriaPublica } from "@/components/site/ImovelGaleriaPublica";
import { ImovelMapa } from "@/components/site/ImovelMapa";
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

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 text-sm text-muted-foreground">
          <Link href={sitePath(basePath, "/imoveis")} className="hover:text-primary">
            Imóveis
          </Link>
          <span className="mx-2">/</span>
          <span>{imovel.titulo ?? "Detalhes"}</span>
        </div>

        <ImovelGaleriaPublica fotos={imovel.fotos ?? []} titulo={imovel.titulo ?? "Imóvel"} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <section>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p
                    className="text-sm font-medium uppercase tracking-wide"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {getFinalidadeLabel(imovel.finalidade)} · {getTipoLabel(imovel.tipo)}
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-primary">
                    {imovel.titulo ?? "Imóvel disponível"}
                  </h1>
                  {endereco ? (
                    <p className="mt-3 inline-flex items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      {endereco}
                    </p>
                  ) : null}
                </div>
                <p className="text-2xl font-bold text-primary">{getValorExibicao(imovel)}</p>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {imovel.quartos > 0 ? (
                <div className="rounded-xl border border-border p-4 text-center">
                  <IconQuartos size="detail" className="mx-auto text-primary" />
                  <p className="mt-2 text-lg font-semibold">{imovel.quartos}</p>
                  <p className="text-xs text-muted-foreground">Quartos</p>
                </div>
              ) : null}
              {imovel.suites > 0 ? (
                <div className="rounded-xl border border-border p-4 text-center">
                  <IconSuite size="detail" className="mx-auto text-primary" />
                  <p className="mt-2 text-lg font-semibold">{imovel.suites}</p>
                  <p className="text-xs text-muted-foreground">Suítes</p>
                </div>
              ) : null}
              {imovel.banheiros > 0 ? (
                <div className="rounded-xl border border-border p-4 text-center">
                  <IconBanheiro size="detail" className="mx-auto text-primary" />
                  <p className="mt-2 text-lg font-semibold">{imovel.banheiros}</p>
                  <p className="text-xs text-muted-foreground">Banheiros</p>
                </div>
              ) : null}
              {imovel.vagas > 0 ? (
                <div className="rounded-xl border border-border p-4 text-center">
                  <IconVagas size="detail" className="mx-auto text-primary" />
                  <p className="mt-2 text-lg font-semibold">{imovel.vagas}</p>
                  <p className="text-xs text-muted-foreground">Vagas</p>
                </div>
              ) : null}
              {imovel.area_util ? (
                <div className="rounded-xl border border-border p-4 text-center">
                  <IconAreaUtil size="detail" className="mx-auto text-primary" />
                  <p className="mt-2 text-lg font-semibold">{imovel.area_util} m²</p>
                  <p className="text-xs text-muted-foreground">Área útil</p>
                </div>
              ) : null}
              {imovel.area_total ? (
                <div className="rounded-xl border border-border p-4 text-center">
                  <IconAreaTotal size="detail" className="mx-auto text-primary" />
                  <p className="mt-2 text-lg font-semibold">{imovel.area_total} m²</p>
                  <p className="text-xs text-muted-foreground">Área total</p>
                </div>
              ) : null}
            </section>

            {imovel.descricao ? (
              <section>
                <h2 className="text-xl font-semibold text-primary">Descrição</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
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

          <FaleComCorretorCard corretor={corretor} imovel={imovel} />
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
