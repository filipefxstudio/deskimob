import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

import { Button } from "@/components/ui/button";
import { sitePath } from "@/lib/site/paths";
import {
  getSiteCreci,
  getSiteEmail,
  getSiteNomeExibicao,
} from "@/lib/site/social";
import { buildWhatsAppUrl, buildContatoWhatsAppMessage } from "@/lib/site/whatsapp";
import type { Corretor } from "@/types";

interface SiteSobreContentProps {
  corretor: Corretor;
  basePath: string;
}

export function SiteSobreContent({ corretor, basePath }: SiteSobreContentProps) {
  const titulo =
    corretor.site_sobre_titulo ??
    corretor.sobre_titulo ??
    `Sobre ${getSiteNomeExibicao(corretor)}`;
  const texto =
    corretor.site_sobre_texto ??
    corretor.sobre_texto ??
    corretor.sobre ??
    "Corretor de imóveis dedicado a encontrar a melhor oportunidade para compra ou locação, com atendimento personalizado e transparência em cada etapa.";
  const fotoUrl = corretor.site_sobre_foto_url ?? corretor.sobre_foto_url;
  const creci = getSiteCreci(corretor);
  const whatsappUrl = buildWhatsAppUrl(corretor, buildContatoWhatsAppMessage());
  const telefone =
    corretor.site_telefone_vendas ?? corretor.contato_telefone ?? corretor.telefone;
  const email = getSiteEmail(corretor);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h1 className="text-3xl font-bold text-primary">{titulo}</h1>
          {creci ? <p className="mt-2 text-muted-foreground">CRECI {creci}</p> : null}

          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt={titulo}
              className="mt-8 aspect-[4/3] w-full max-w-xl rounded-2xl object-cover"
            />
          ) : null}

          <div className="mt-8 space-y-4 leading-relaxed text-[#2D3748]">
            <p className="whitespace-pre-line">{texto}</p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={sitePath(basePath, "/imoveis")}>Ver imóveis</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={sitePath(basePath, "/contato")}>Entrar em contato</Link>
            </Button>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary">Contato</h2>
          <ul className="mt-4 space-y-4 text-sm text-[#2D3748]">
            {telefone ? (
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                {telefone}
              </li>
            ) : null}
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
              {email}
            </li>
            {(corretor.site_endereco ?? corretor.contato_endereco) ? (
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                {corretor.site_endereco ?? corretor.contato_endereco}
              </li>
            ) : null}
            {(corretor.site_horario ?? corretor.contato_horario) ? (
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                {corretor.site_horario ?? corretor.contato_horario}
              </li>
            ) : null}
          </ul>

          {whatsappUrl ? (
            <Button asChild className="mt-6 w-full bg-[#25D366] hover:bg-[#1da851]">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-4" />
                WhatsApp
              </a>
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
