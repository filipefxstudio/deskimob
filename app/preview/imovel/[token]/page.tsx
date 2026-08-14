import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteImovelDetalheContent } from "@/components/site/SiteImovelDetalheContent";
import { SiteSharePreviewShell } from "@/components/site/SiteSharePreviewShell";
import { buildImovelSharePreviewUrl } from "@/lib/imoveis/share-url";
import {
  resolveCorretorForSharePreview,
  resolveImovelSharePreview,
} from "@/lib/imoveis/share-preview-query";
import {
  getCapaUrl,
  getFinalidadeLabel,
  getTipoLabel,
} from "@/lib/site/format";
import { getSitePageTitle } from "@/lib/site/metadata";

interface PreviewPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const { token } = await params;
  const preview = await resolveImovelSharePreview(token);

  if (!preview) {
    return { title: "Imóvel não encontrado" };
  }

  const titulo = preview.imovel.titulo ?? "Imóvel disponível";
  const descricao =
    preview.imovel.descricao?.slice(0, 160) ??
    `${getTipoLabel(preview.imovel.tipo)} para ${getFinalidadeLabel(preview.imovel.finalidade).toLowerCase()} em ${preview.imovel.bairro ?? preview.imovel.cidade ?? "localização sob consulta"}.`;
  const imagem = getCapaUrl(preview.imovel);

  return {
    title: getSitePageTitle(preview.corretor, titulo),
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      images: imagem ? [{ url: imagem, alt: titulo }] : undefined,
    },
    twitter: {
      card: imagem ? "summary_large_image" : "summary",
      title: titulo,
      description: descricao,
      images: imagem ? [imagem] : undefined,
    },
    robots: { index: false, follow: false },
  };
}

export default async function PreviewImovelPage({ params }: PreviewPageProps) {
  const { token } = await params;
  const preview = await resolveImovelSharePreview(token);

  if (!preview) {
    notFound();
  }

  const corretor = await resolveCorretorForSharePreview(preview.corretor);
  const pageUrl = buildImovelSharePreviewUrl(token, corretor);

  return (
    <SiteSharePreviewShell corretor={corretor}>
      <SiteImovelDetalheContent
        corretor={corretor}
        imovel={preview.imovel}
        basePath=""
        absolutePageUrl={pageUrl}
        shareMode
      />
    </SiteSharePreviewShell>
  );
}
