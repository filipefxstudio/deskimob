import type { Metadata } from "next";

import { SiteImoveisListing } from "@/components/site/SiteImoveisListing";
import { getSitePageTitle } from "@/lib/site/metadata";
import { parseImoveisSearchParams } from "@/lib/site/paths";
import { getCorretorBySlug } from "@/lib/site/queries";

interface ImoveisListingPageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: ImoveisListingPageProps): Promise<Metadata> {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);

  return {
    title: corretor ? getSitePageTitle(corretor, "Imóveis") : "Imóveis",
    description: "Busque apartamentos, casas e oportunidades disponíveis.",
  };
}

export default async function ImoveisListingPage({
  params,
  searchParams,
}: ImoveisListingPageProps) {
  const { tenant } = await params;
  const query = await searchParams;
  const corretor = await getCorretorBySlug(tenant);

  if (!corretor) {
    return null;
  }

  const filters = parseImoveisSearchParams(query);

  return (
    <SiteImoveisListing
      corretor={corretor}
      filters={filters}
      title="Imóveis disponíveis"
    />
  );
}
