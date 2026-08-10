import type { Metadata } from "next";
import Link from "next/link";

import { SiteImoveisListing } from "@/components/site/SiteImoveisListing";
import { getSitePageTitle } from "@/lib/site/metadata";
import { parseImoveisSearchParams } from "@/lib/site/paths";
import { getCorretorBySlug } from "@/lib/site/queries";

interface ComprarPageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: ComprarPageProps): Promise<Metadata> {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);
  return {
    title: corretor ? getSitePageTitle(corretor, "Comprar") : "Comprar imóveis",
    description: "Imóveis à venda disponíveis para compra.",
  };
}

export default async function ComprarPage({ params, searchParams }: ComprarPageProps) {
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
      finalidade="venda"
      filters={filters}
      title="Comprar imóveis"
      emptyMessage="Nenhum imóvel à venda encontrado com os filtros selecionados."
    />
  );
}
