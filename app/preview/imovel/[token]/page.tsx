import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MapPin,
  MessageCircle,
} from "lucide-react";

import { ImovelStats } from "@/components/imoveis/ImovelStats";

import { ImovelGaleria } from "@/components/site/ImovelGaleria";
import { Button } from "@/components/ui/button";
import {
  formatEndereco,
  getFinalidadeLabel,
  getTipoLabel,
  getValorExibicao,
} from "@/lib/site/format";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildImovelWhatsAppUrl } from "@/lib/site/whatsapp";
import type { Corretor, Imovel } from "@/types";

interface PreviewPageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Preview do imóvel | Deskimob",
  robots: { index: false, follow: false },
};

export default async function PreviewImovelPage({ params }: PreviewPageProps) {
  const { token } = await params;

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    notFound();
  }

  const { data: selecionado, error } = await supabase
    .from("lead_imoveis_selecionados")
    .select(
      "*, imovel:imoveis(*, fotos:imovel_fotos(*)), corretor:corretores(id, nome, whatsapp, telefone, slug)",
    )
    .eq("token_compartilhamento", token)
    .maybeSingle();

  if (error || !selecionado?.imovel) {
    notFound();
  }

  const imovel = selecionado.imovel as Imovel;
  const corretor = selecionado.corretor as Pick<
    Corretor,
    "id" | "nome" | "whatsapp" | "telefone" | "slug"
  >;

  const titulo = imovel.titulo ?? "Imóvel disponível";
  const valorLabel = getValorExibicao(imovel);
  const pageUrl = `https://${process.env.NEXT_PUBLIC_DOMAIN ?? "deskimob.com.br"}/preview/imovel/${token}`;
  const whatsappUrl = buildImovelWhatsAppUrl(corretor as Corretor, imovel, pageUrl);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">Preview exclusivo</p>
        <h1 className="text-lg font-semibold text-primary">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{corretor.nome}</p>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-4">
        <ImovelGaleria fotos={imovel.fotos ?? []} titulo={titulo} />

        <div>
          {valorLabel ? (
            <p className="text-2xl font-bold text-primary">{valorLabel}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {getTipoLabel(imovel.tipo)} · {getFinalidadeLabel(imovel.finalidade)}
          </p>
        </div>

        <ImovelStats
          imovel={imovel}
          variant="detail"
          showAreaTotal
          iconClassName="text-muted-foreground"
        />

        <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {formatEndereco(imovel)}
        </p>

        {imovel.descricao ? (
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p className="whitespace-pre-wrap">{imovel.descricao}</p>
          </div>
        ) : null}
      </main>

      {whatsappUrl ? (
        <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-card p-4 shadow-lg">
          <div className="mx-auto flex max-w-4xl justify-center">
            <Button asChild size="lg" className="w-full max-w-md bg-[#2DC653] hover:bg-[#25a847]">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle data-icon="inline-start" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
