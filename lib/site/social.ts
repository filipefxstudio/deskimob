import type { Corretor } from "@/types";

export interface SocialLink {
  rede: "instagram" | "youtube" | "tiktok" | "linkedin" | "facebook";
  url: string;
  label: string;
}

function normalizeSocialUrl(value: string, baseUrl: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@/, "");
  return `${baseUrl}${handle}`;
}

export function getSocialLinks(corretor: Corretor): SocialLink[] {
  const links: SocialLink[] = [];

  if (corretor.site_instagram?.trim()) {
    links.push({
      rede: "instagram",
      url: normalizeSocialUrl(corretor.site_instagram, "https://instagram.com/"),
      label: "Instagram",
    });
  }
  if (corretor.site_youtube?.trim()) {
    links.push({
      rede: "youtube",
      url: normalizeSocialUrl(corretor.site_youtube, "https://youtube.com/"),
      label: "YouTube",
    });
  }
  if (corretor.site_tiktok?.trim()) {
    links.push({
      rede: "tiktok",
      url: normalizeSocialUrl(corretor.site_tiktok, "https://tiktok.com/@"),
      label: "TikTok",
    });
  }
  if (corretor.site_linkedin?.trim()) {
    links.push({
      rede: "linkedin",
      url: normalizeSocialUrl(corretor.site_linkedin, "https://linkedin.com/in/"),
      label: "LinkedIn",
    });
  }
  if (corretor.site_facebook?.trim()) {
    links.push({
      rede: "facebook",
      url: normalizeSocialUrl(corretor.site_facebook, "https://facebook.com/"),
      label: "Facebook",
    });
  }

  return links;
}

export function getSiteNomeExibicao(corretor: Corretor): string {
  return corretor.site_nome_exibicao?.trim() || "Imobiliária";
}

export function getSiteCreci(corretor: Corretor): string | null {
  return corretor.site_creci?.trim() || null;
}

export function getSiteEmail(corretor: Corretor): string {
  return corretor.site_email?.trim() || corretor.contato_email?.trim() || "";
}
