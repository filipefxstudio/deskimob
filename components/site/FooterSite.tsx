import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SocialIcons } from "@/components/site/SocialIcons";
import { sitePath } from "@/lib/site/paths";
import { getSiteCreci, getSiteEmail, getSiteNomeExibicao, getSocialLinks } from "@/lib/site/social";
import { buildWhatsAppUrl, buildContatoWhatsAppMessage } from "@/lib/site/whatsapp";
import type { Corretor } from "@/types";

interface FooterSiteProps {
  corretor: Corretor;
  basePath: string;
}

export function FooterSite({ corretor, basePath }: FooterSiteProps) {
  const nomeExibicao = getSiteNomeExibicao(corretor);
  const creci = getSiteCreci(corretor);
  const email = getSiteEmail(corretor);
  const telefone = corretor.site_telefone_vendas ?? corretor.contato_telefone ?? corretor.telefone;
  const whatsappUrl = buildWhatsAppUrl(corretor, buildContatoWhatsAppMessage());
  const socialLinks = getSocialLinks(corretor);
  const currentYear = new Date().getFullYear();
  const endereco = corretor.site_endereco?.trim();

  return (
    <footer className="mt-auto border-t border-border bg-primary text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <h3 className="text-lg font-semibold">{nomeExibicao}</h3>
          {creci ? (
            <p className="mt-2 text-sm text-white/80">CRECI {creci}</p>
          ) : null}
          <SocialIcons links={socialLinks} className="mt-4" iconClassName="size-5 text-white" />
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white/90">Contato</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            {telefone ? (
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0" />
                {telefone}
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" />
              {email}
            </li>
            {whatsappUrl ? (
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-accent"
                >
                  <WhatsAppIcon className="size-4" />
                  WhatsApp
                </a>
              </li>
            ) : null}
            {endereco ? (
              <li className="flex items-start gap-2 pt-1 text-white/70">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>{endereco}</span>
              </li>
            ) : (
              <li className="flex items-start gap-2 pt-1 text-xs text-white/60">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                Atendimento imobiliário em todo o Brasil
              </li>
            )}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white/90">Links</h4>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>
              <Link href={sitePath(basePath, "/imoveis")} className="hover:text-accent">
                Ver imóveis
              </Link>
            </li>
            <li>
              <Link href={sitePath(basePath, "/sobre")} className="hover:text-accent">
                Sobre
              </Link>
            </li>
            <li>
              <Link href={sitePath(basePath, "/contato")} className="hover:text-accent">
                Contato
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-white/60 sm:px-6 lg:px-8">
          © {currentYear} {nomeExibicao}. Powered by Deskimob.
        </p>
      </div>
    </footer>
  );
}
