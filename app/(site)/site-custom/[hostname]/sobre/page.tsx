import type { Metadata } from "next";

import { SiteSobreContent } from "@/components/site/SiteSobreContent";
import { getSitePageTitle, getSiteSobreTitulo } from "@/lib/site/metadata";
import { resolveSiteBasePath } from "@/lib/site/paths";
import { getCorretorByDominio } from "@/lib/site/queries";

interface CustomSobrePageProps {
  params: Promise<{ hostname: string }>;
}

export async function generateMetadata({ params }: CustomSobrePageProps): Promise<Metadata> {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));
  const titulo = corretor ? getSiteSobreTitulo(corretor) : "Sobre";

  return {
    title: corretor ? getSitePageTitle(corretor, titulo) : "Sobre",
    description: corretor?.site_sobre_texto ?? corretor?.sobre_texto ?? corretor?.sobre ?? undefined,
  };
}

export default async function CustomSobrePage({ params }: CustomSobrePageProps) {
  const { hostname } = await params;
  const decodedHostname = decodeURIComponent(hostname);
  const corretor = await getCorretorByDominio(decodedHostname);

  if (!corretor) {
    return null;
  }

  const basePath = await resolveSiteBasePath({
    tenantSlug: corretor.slug,
    routeKind: "custom",
    hostname: decodedHostname,
  });

  return <SiteSobreContent corretor={corretor} basePath={basePath} />;
}
