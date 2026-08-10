import type { Metadata } from "next";

import { SiteContatoContent } from "@/components/site/SiteContatoContent";
import { getSitePageTitle } from "@/lib/site/metadata";
import { getSiteNomeExibicao } from "@/lib/site/social";
import { getCorretorByDominio } from "@/lib/site/queries";

interface CustomContatoPageProps {
  params: Promise<{ hostname: string }>;
}

export async function generateMetadata({ params }: CustomContatoPageProps): Promise<Metadata> {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));

  return {
    title: corretor ? getSitePageTitle(corretor, "Contato") : "Contato",
    description: corretor
      ? `Entre em contato com ${getSiteNomeExibicao(corretor)}.`
      : "Entre em contato.",
  };
}

export default async function CustomContatoPage({ params }: CustomContatoPageProps) {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));

  if (!corretor) {
    return null;
  }

  return <SiteContatoContent corretor={corretor} />;
}
