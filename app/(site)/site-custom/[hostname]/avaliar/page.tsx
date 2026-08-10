import type { Metadata } from "next";

import { FormularioAvaliarImovel } from "@/components/site/FormularioAvaliarImovel";
import { getSitePageTitle } from "@/lib/site/metadata";
import { getSiteNomeExibicao } from "@/lib/site/social";
import { getCorretorByDominio } from "@/lib/site/queries";

interface CustomAvaliarPageProps {
  params: Promise<{ hostname: string }>;
}

export async function generateMetadata({ params }: CustomAvaliarPageProps): Promise<Metadata> {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));
  return {
    title: corretor ? getSitePageTitle(corretor, "Avaliar imóvel") : "Avaliar imóvel",
    description: "Solicite uma avaliação profissional do seu imóvel.",
  };
}

export default async function CustomAvaliarPage({ params }: CustomAvaliarPageProps) {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));

  if (!corretor) {
    return null;
  }

  const nomeExibicao = getSiteNomeExibicao(corretor);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-primary">Avaliar imóvel</h1>
      <p className="mt-2 text-muted-foreground">
        Preencha os dados abaixo e {nomeExibicao} entrará em contato com uma avaliação
        personalizada.
      </p>
      <div className="mt-8">
        <FormularioAvaliarImovel />
      </div>
    </div>
  );
}
