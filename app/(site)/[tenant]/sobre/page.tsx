import type { Metadata } from "next";

import { SiteSobreContent } from "@/components/site/SiteSobreContent";
import { getSitePageTitle, getSiteSobreTitulo } from "@/lib/site/metadata";
import { resolveSiteBasePath } from "@/lib/site/paths";
import { getCorretorBySlug } from "@/lib/site/queries";

interface SobrePageProps {
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({ params }: SobrePageProps): Promise<Metadata> {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);
  const titulo = corretor ? getSiteSobreTitulo(corretor) : "Sobre";

  return {
    title: corretor ? getSitePageTitle(corretor, titulo) : "Sobre",
    description: corretor?.site_sobre_texto ?? corretor?.sobre_texto ?? corretor?.sobre ?? undefined,
  };
}

export default async function SobrePage({ params }: SobrePageProps) {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);

  if (!corretor) {
    return null;
  }

  const basePath = await resolveSiteBasePath({ tenantSlug: tenant, routeKind: "slug" });

  return <SiteSobreContent corretor={corretor} basePath={basePath} />;
}
