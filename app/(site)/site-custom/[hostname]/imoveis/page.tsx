import type { Metadata } from "next";

import { SiteImoveisListing } from "@/components/site/SiteImoveisListing";
import { getSitePageTitle } from "@/lib/site/metadata";
import { parseImoveisSearchParams } from "@/lib/site/paths";
import { getCorretorByDominio } from "@/lib/site/queries";

interface CustomImoveisListingPageProps {
  params: Promise<{ hostname: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CustomImoveisListingPageProps): Promise<Metadata> {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));

  return {
    title: corretor ? getSitePageTitle(corretor, "Imóveis") : "Imóveis",
    description: "Busque apartamentos, casas e oportunidades disponíveis.",
  };
}

export default async function CustomImoveisListingPage({
  params,
  searchParams,
}: CustomImoveisListingPageProps) {
  const { hostname } = await params;
  const query = await searchParams;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));

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
