import type { Metadata } from "next";
import Link from "next/link";

import { SiteImoveisListing } from "@/components/site/SiteImoveisListing";
import { Button } from "@/components/ui/button";
import { getSitePageTitle } from "@/lib/site/metadata";
import { parseImoveisSearchParams, resolveSiteBasePath, sitePath } from "@/lib/site/paths";
import { getCorretorBySlug, hasImoveisLocacao } from "@/lib/site/queries";

interface AlugarPageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: AlugarPageProps): Promise<Metadata> {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);
  return {
    title: corretor ? getSitePageTitle(corretor, "Alugar") : "Alugar imóveis",
    description: "Imóveis para locação disponíveis.",
  };
}

export default async function AlugarPage({ params, searchParams }: AlugarPageProps) {
  const { tenant } = await params;
  const query = await searchParams;
  const corretor = await getCorretorBySlug(tenant);

  if (!corretor) {
    return null;
  }

  const temLocacao = await hasImoveisLocacao(corretor.id);

  if (!temLocacao) {
    const basePath = await resolveSiteBasePath({ tenantSlug: tenant, routeKind: "slug" });

    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-primary">Alugar imóveis</h1>
        <p className="mt-4 text-muted-foreground">
          No momento não há imóveis disponíveis para locação.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={sitePath(basePath, "/comprar")}>Ver imóveis à venda</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={sitePath(basePath, "/")}>Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  const filters = parseImoveisSearchParams(query);

  return (
    <SiteImoveisListing
      corretor={corretor}
      finalidade="locacao"
      filters={filters}
      title="Alugar imóveis"
      emptyMessage="Nenhum imóvel para locação encontrado com os filtros selecionados."
    />
  );
}
