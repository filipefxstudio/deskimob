import type { Corretor } from "@/types";

export type SiteEmailProvider = "tenant" | "platform" | "none";

export type SiteEmailCredentials = {
  provider: SiteEmailProvider;
  apiKey: string;
  from: string;
};

/** E-mail público exibido no site (contato). */
export function getSiteEmailPublico(corretor: Corretor): string {
  return corretor.site_email?.trim() || corretor.contato_email?.trim() || corretor.email?.trim() || "";
}

/** Destino das notificações de formulários do site. */
export function getSiteLeadsNotificationEmail(corretor: Corretor): string {
  return (
    corretor.site_leads_email?.trim() ||
    getSiteEmailPublico(corretor)
  );
}

export function isSiteLeadsEmailAtivo(corretor: Corretor): boolean {
  return corretor.site_leads_email_ativo !== false;
}

export function resolveSiteEmailCredentials(corretor: Corretor): SiteEmailCredentials | null {
  const tenantKey = corretor.resend_api_key?.trim();
  const tenantFrom = corretor.resend_from_email?.trim();

  if (tenantKey && tenantFrom) {
    return {
      provider: "tenant",
      apiKey: tenantKey,
      from: tenantFrom,
    };
  }

  const platformKey = process.env.RESEND_API_KEY?.trim();
  const platformFrom = process.env.RESEND_FROM_EMAIL?.trim();

  if (platformKey) {
    return {
      provider: "platform",
      apiKey: platformKey,
      from: platformFrom || "Deskimob <onboarding@resend.dev>",
    };
  }

  return null;
}

export function getSiteEmailProviderStatus(corretor: Corretor): SiteEmailProvider {
  return resolveSiteEmailCredentials(corretor)?.provider ?? "none";
}

export function canSendSiteLeadEmail(corretor: Corretor): boolean {
  if (!isSiteLeadsEmailAtivo(corretor)) {
    return false;
  }

  if (!getSiteLeadsNotificationEmail(corretor)) {
    return false;
  }

  return resolveSiteEmailCredentials(corretor) !== null;
}
