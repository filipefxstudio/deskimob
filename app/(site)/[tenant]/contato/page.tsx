import type { Metadata } from "next";

import { SiteContatoContent } from "@/components/site/SiteContatoContent";
import { getSitePageTitle } from "@/lib/site/metadata";
import { getSiteNomeExibicao } from "@/lib/site/social";
import { getCorretorBySlug } from "@/lib/site/queries";

interface ContatoPageProps {
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({ params }: ContatoPageProps): Promise<Metadata> {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);

  return {
    title: corretor ? getSitePageTitle(corretor, "Contato") : "Contato",
    description: corretor
      ? `Entre em contato com ${getSiteNomeExibicao(corretor)}.`
      : "Entre em contato.",
  };
}

export default async function ContatoPage({ params }: ContatoPageProps) {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);

  if (!corretor) {
    return null;
  }

  return <SiteContatoContent corretor={corretor} />;
}
