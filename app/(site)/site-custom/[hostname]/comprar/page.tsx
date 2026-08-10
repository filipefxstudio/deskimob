import type { Metadata } from "next";

import { SiteImoveisListing } from "@/components/site/SiteImoveisListing";
import { getSitePageTitle } from "@/lib/site/metadata";
import { parseImoveisSearchParams } from "@/lib/site/paths";
import { getCorretorByDominio } from "@/lib/site/queries";

interface CustomComprarPageProps {
  params: Promise<{ hostname: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CustomComprarPageProps): Promise<Metadata> {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));
  return {
    title: corretor ? getSitePageTitle(corretor, "Comprar") : "Comprar imóveis",
    description: "Imóveis à venda disponíveis para compra.",
  };
}

export default async function CustomComprarPage({ params, searchParams }: CustomComprarPageProps) {
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
      finalidade="venda"
      filters={filters}
      title="Comprar imóveis"
      emptyMessage="Nenhum imóvel à venda encontrado com os filtros selecionados."
    />
  );
}
