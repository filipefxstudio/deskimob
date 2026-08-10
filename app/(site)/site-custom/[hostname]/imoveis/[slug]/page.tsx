import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  resolveAbsolutePageUrl,
  SiteImovelDetalheContent,
} from "@/components/site/SiteImovelDetalheContent";
import {
  getCapaUrl,
  getFinalidadeLabel,
  getTipoLabel,
} from "@/lib/site/format";
import { resolveSiteBasePath, sitePath } from "@/lib/site/paths";
import { getSitePageTitle } from "@/lib/site/metadata";
import { getCorretorByDominio, getImovelPublico } from "@/lib/site/queries";

interface CustomImovelDetailPageProps {
  params: Promise<{ hostname: string; slug: string }>;
}

export async function generateMetadata({ params }: CustomImovelDetailPageProps): Promise<Metadata> {
  const { hostname, slug } = await params;
  const decodedHostname = decodeURIComponent(hostname);
  const corretor = await getCorretorByDominio(decodedHostname);

  if (!corretor) {
    return { title: "Imóvel não encontrado" };
  }

  const imovel = await getImovelPublico(corretor.id, slug);

  if (!imovel) {
    return { title: "Imóvel não encontrado" };
  }

  const titulo = imovel.titulo ?? "Imóvel disponível";
  const descricao =
    imovel.descricao?.slice(0, 160) ??
    `${getTipoLabel(imovel.tipo)} para ${getFinalidadeLabel(imovel.finalidade).toLowerCase()} em ${imovel.bairro ?? imovel.cidade ?? "localização sob consulta"}.`;
  const imagem = getCapaUrl(imovel);
  const basePath = await resolveSiteBasePath({
    tenantSlug: corretor.slug,
    routeKind: "custom",
    hostname: decodedHostname,
  });
  const pagePath = sitePath(basePath, `/imoveis/${slug}`);

  return {
    title: getSitePageTitle(corretor, titulo),
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      images: imagem ? [{ url: imagem, alt: titulo }] : undefined,
    },
    twitter: {
      card: imagem ? "summary_large_image" : "summary",
      title: titulo,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
    alternates: {
      canonical: pagePath,
    },
  };
}

export default async function CustomImovelDetailPage({ params }: CustomImovelDetailPageProps) {
  const { hostname, slug } = await params;
  const decodedHostname = decodeURIComponent(hostname);
  const corretor = await getCorretorByDominio(decodedHostname);

  if (!corretor) {
    notFound();
  }

  const imovel = await getImovelPublico(corretor.id, slug);

  if (!imovel) {
    notFound();
  }

  const basePath = await resolveSiteBasePath({
    tenantSlug: corretor.slug,
    routeKind: "custom",
    hostname: decodedHostname,
  });
  const absolutePageUrl = await resolveAbsolutePageUrl(basePath, slug);

  return (
    <SiteImovelDetalheContent
      corretor={corretor}
      imovel={imovel}
      basePath={basePath}
      absolutePageUrl={absolutePageUrl}
    />
  );
}
