"use server";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_SITE_COR_PRIMARIA,
  DEFAULT_SITE_COR_SECUNDARIA,
  DEFAULT_SITE_TARJA_COR,
  STORAGE_BUCKET_SITE_ASSETS,
} from "@/lib/constants/site";
import { requireSiteAdmin } from "@/lib/auth/equipe-access";
import { API_KEY_MASK } from "@/lib/constants/agente";
import { sendEmail } from "@/lib/email/resend";
import { isReservedTenantSlug } from "@/lib/site/host";
import {
  canSendSiteLeadEmail,
  getSiteEmailProviderStatus,
  getSiteLeadsNotificationEmail,
  resolveSiteEmailCredentials,
} from "@/lib/site/notificacoes-email";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { Corretor } from "@/types";

export type SiteConfigActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
  url?: string;
};

export type SaveIdentidadeVisualInput = {
  site_cor_primaria: string;
  site_cor_secundaria: string;
  site_tarja_cor: string;
};

export type SaveHeroPageInput = {
  hero_titulo: string;
  hero_subtitulo: string;
};

export type SaveSobreInput = {
  site_sobre_titulo: string;
  site_sobre_texto: string;
};

export type SaveContatoInput = {
  site_nome_exibicao: string;
  site_creci: string;
  site_telefone_vendas: string;
  site_telefone_locacao: string;
  site_email: string;
  site_instagram: string;
  site_youtube: string;
  site_tiktok: string;
  site_linkedin: string;
  site_facebook: string;
  site_horario: string;
  site_endereco: string;
};

export type SaveSiteDominioInput = {
  dominio_custom: string;
  slug?: string;
};

function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

async function requireSiteAdminCorretor(): Promise<
  { error: string } | { corretor: Corretor }
> {
  const ctx = await requireSiteAdmin();

  if ("error" in ctx) {
    return ctx;
  }

  return { corretor: ctx.corretor };
}

async function uploadSiteAsset(
  formData: FormData,
  fieldName: string,
  fileName: string,
): Promise<SiteConfigActionResult & { url?: string }> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;

  const file = formData.get(fieldName) as File | null;

  if (!file || file.size === 0) {
    return { error: "Selecione uma imagem." };
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Upload indisponível. Verifique a configuração do Supabase Storage." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const storagePath = `${corretor.id}/${fileName}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET_SITE_ASSETS)
    .upload(storagePath, buffer, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadError) {
    console.error(`[uploadSiteAsset:${fileName}]`, uploadError);
    return { error: "Não foi possível enviar a imagem." };
  }

  const { data: publicUrlData } = admin.storage
    .from(STORAGE_BUCKET_SITE_ASSETS)
    .getPublicUrl(storagePath);

  return { success: true, url: publicUrlData.publicUrl, message: "Imagem enviada." };
}

export async function saveIdentidadeVisual(
  data: SaveIdentidadeVisualInput,
): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;

  const primaria = data.site_cor_primaria.trim() || DEFAULT_SITE_COR_PRIMARIA;
  const secundaria = data.site_cor_secundaria.trim() || DEFAULT_SITE_COR_SECUNDARIA;
  const tarja = data.site_tarja_cor.trim() || DEFAULT_SITE_TARJA_COR;

  if (!isValidHexColor(primaria) || !isValidHexColor(secundaria) || !isValidHexColor(tarja)) {
    return { error: "Informe cores válidas no formato #RRGGBB." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({
      site_cor_primaria: primaria,
      site_cor_secundaria: secundaria,
      site_tarja_cor: tarja,
    })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar as cores." };
  }

  revalidatePath("/dashboard/configuracoes");
  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}`);
  }

  return { success: true, message: "Identidade visual salva." };
}

export async function uploadLogo(formData: FormData): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;
  const uploadResult = await uploadSiteAsset(formData, "logo", "logo");

  if (uploadResult.error || !uploadResult.url) {
    return uploadResult;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({ logo_url: uploadResult.url })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar a logo." };
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");

  return { success: true, url: uploadResult.url, message: "Logo enviada." };
}

export async function uploadFavicon(formData: FormData): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;
  const uploadResult = await uploadSiteAsset(formData, "favicon", "favicon");
  if (uploadResult.error || !uploadResult.url) {
    return uploadResult;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({ site_favicon_url: uploadResult.url })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar o favicon." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, url: uploadResult.url, message: "Favicon enviado." };
}

export async function uploadHero(formData: FormData): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;
  const uploadResult = await uploadSiteAsset(formData, "hero", "hero");

  if (uploadResult.error || !uploadResult.url) {
    return uploadResult;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({ hero_image_url: uploadResult.url })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar a imagem do hero." };
  }

  revalidatePath("/dashboard/configuracoes");
  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}`);
  }

  return { success: true, url: uploadResult.url, message: "Imagem do hero enviada." };
}

export async function removeHero(): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({ hero_image_url: null })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível remover a imagem do hero." };
  }

  revalidatePath("/dashboard/configuracoes");
  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}`);
  }

  return { success: true, message: "Imagem do hero removida." };
}

export async function saveHeroPage(data: SaveHeroPageInput): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({
      hero_titulo: data.hero_titulo.trim() || null,
      hero_subtitulo: data.hero_subtitulo.trim() || null,
    })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar a página inicial." };
  }

  revalidatePath("/dashboard/configuracoes");
  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}`);
  }

  return { success: true, message: "Página inicial salva." };
}

export async function uploadSobreFoto(formData: FormData): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;
  const uploadResult = await uploadSiteAsset(formData, "foto", "sobre");

  if (uploadResult.error || !uploadResult.url) {
    return uploadResult;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({ site_sobre_foto_url: uploadResult.url })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar a foto." };
  }

  revalidatePath("/dashboard/configuracoes");
  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}/sobre`);
  }

  return { success: true, url: uploadResult.url, message: "Foto enviada." };
}

export async function saveSobrePage(data: SaveSobreInput): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({
      site_sobre_titulo: data.site_sobre_titulo.trim() || null,
      site_sobre_texto: data.site_sobre_texto.trim() || null,
    })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar a página Sobre." };
  }

  revalidatePath("/dashboard/configuracoes");
  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}/sobre`);
  }

  return { success: true, message: "Página Sobre salva." };
}

export async function saveContatoPage(data: SaveContatoInput): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({
      site_nome_exibicao: data.site_nome_exibicao.trim() || null,
      site_creci: data.site_creci.trim() || null,
      site_telefone_vendas: data.site_telefone_vendas.trim() || null,
      site_telefone_locacao: data.site_telefone_locacao.trim() || null,
      site_email: data.site_email.trim() || null,
      site_instagram: data.site_instagram.trim() || null,
      site_youtube: data.site_youtube.trim() || null,
      site_tiktok: data.site_tiktok.trim() || null,
      site_linkedin: data.site_linkedin.trim() || null,
      site_facebook: data.site_facebook.trim() || null,
      site_horario: data.site_horario.trim() || null,
      site_endereco: data.site_endereco.trim() || null,
    })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar a página Contato." };
  }

  revalidatePath("/dashboard/configuracoes");
  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}/contato`);
  }

  return { success: true, message: "Página Contato salva." };
}

async function resolveSiteSlugUpdate(
  corretor: Corretor,
  rawSlug: string | undefined,
): Promise<{ slug?: string; error?: string } | { skip: true }> {
  if (rawSlug === undefined) {
    return { skip: true };
  }

  const normalized = slugify(rawSlug.trim());

  if (!normalized || normalized.length < 2) {
    return { error: "Informe um slug válido com pelo menos 2 caracteres." };
  }

  if (isReservedTenantSlug(normalized)) {
    return { error: "Este slug não pode ser usado." };
  }

  if (normalized === corretor.slug) {
    return { skip: true };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("corretores")
    .select("id")
    .eq("slug", normalized)
    .neq("id", corretor.id)
    .maybeSingle();

  if (existing) {
    return { error: "Este slug já está em uso." };
  }

  return { slug: normalized };
}

export async function saveSiteDominio(data: SaveSiteDominioInput): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;
  const slugResult = await resolveSiteSlugUpdate(corretor, data.slug);

  if ("error" in slugResult && slugResult.error) {
    return { error: slugResult.error };
  }

  const supabase = await createClient();
  const updatePayload: { dominio_custom: string | null; slug?: string } = {
    dominio_custom: data.dominio_custom.trim() || null,
  };

  if ("slug" in slugResult && slugResult.slug) {
    updatePayload.slug = slugResult.slug;
  }

  const { error } = await supabase.from("corretores").update(updatePayload).eq("id", corretor.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Este slug já está em uso." };
    }
    return { error: "Não foi possível salvar as configurações do site." };
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");

  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}`);
  }

  if ("slug" in slugResult && slugResult.slug) {
    revalidatePath(`/${slugResult.slug}`);
  }

  const slugChanged = "slug" in slugResult && Boolean(slugResult.slug);

  return {
    success: true,
    message: slugChanged ? "Slug e domínio salvos." : "Domínio salvo.",
  };
}

export type SiteLeadsNotificacoesConfig = {
  leadsEmail: string;
  leadsEmailAtivo: boolean;
  resendFromEmail: string;
  hasResendApiKey: boolean;
  provider: "tenant" | "platform" | "none";
  canSend: boolean;
};

async function fetchCorretorEmailSettings(
  corretorId: string,
): Promise<Pick<
  Corretor,
  | "id"
  | "nome"
  | "email"
  | "site_email"
  | "contato_email"
  | "site_leads_email"
  | "site_leads_email_ativo"
  | "resend_from_email"
  | "resend_api_key"
> | null> {
  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return null;
  }

  const { data, error } = await admin
    .from("corretores")
    .select(
      "id, nome, email, site_email, contato_email, site_leads_email, site_leads_email_ativo, resend_from_email, resend_api_key",
    )
    .eq("id", corretorId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    Corretor,
    | "id"
    | "nome"
    | "email"
    | "site_email"
    | "contato_email"
    | "site_leads_email"
    | "site_leads_email_ativo"
    | "resend_from_email"
    | "resend_api_key"
  >;
}

function buildSiteLeadsNotificacoesConfig(
  corretor: Pick<
    Corretor,
    | "email"
    | "site_email"
    | "contato_email"
    | "site_leads_email"
    | "site_leads_email_ativo"
    | "resend_from_email"
    | "resend_api_key"
  >,
): SiteLeadsNotificacoesConfig {
  return {
    leadsEmail: getSiteLeadsNotificationEmail(corretor as Corretor),
    leadsEmailAtivo: corretor.site_leads_email_ativo !== false,
    resendFromEmail: corretor.resend_from_email?.trim() ?? "",
    hasResendApiKey: Boolean(corretor.resend_api_key?.trim()),
    provider: getSiteEmailProviderStatus(corretor as Corretor),
    canSend: canSendSiteLeadEmail(corretor as Corretor),
  };
}

export async function getSiteLeadsNotificacoesConfig(): Promise<
  SiteLeadsNotificacoesConfig | { error: string }
> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const settings = await fetchCorretorEmailSettings(access.corretor.id);

  if (!settings) {
    return { error: "Não foi possível carregar as configurações de e-mail." };
  }

  return buildSiteLeadsNotificacoesConfig(settings);
}

export type SaveSiteLeadsNotificacoesInput = {
  site_leads_email: string;
  site_leads_email_ativo: boolean;
  resend_from_email: string;
  resend_api_key?: string;
};

function isResendKeyPlaceholder(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === API_KEY_MASK;
}

export async function saveSiteLeadsNotificacoes(
  data: SaveSiteLeadsNotificacoesInput,
): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const leadsEmail = data.site_leads_email.trim();

  if (data.site_leads_email_ativo && !leadsEmail) {
    return {
      error: "Informe o e-mail que receberá as notificações ou desative o envio por e-mail.",
    };
  }

  const resendFrom = data.resend_from_email.trim();
  const resendKeyInput = data.resend_api_key?.trim();

  if (resendKeyInput && !isResendKeyPlaceholder(resendKeyInput) && !resendFrom) {
    return { error: "Informe o e-mail remetente verificado no Resend." };
  }

  if (resendFrom && (isResendKeyPlaceholder(resendKeyInput) || !resendKeyInput)) {
    const existing = await fetchCorretorEmailSettings(access.corretor.id);

    if (!existing?.resend_api_key?.trim()) {
      return { error: "Informe a chave de API do Resend para usar remetente próprio." };
    }
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Operação indisponível. Verifique a configuração do servidor." };
  }

  const payload: Record<string, string | boolean | null> = {
    site_leads_email: leadsEmail || null,
    site_leads_email_ativo: data.site_leads_email_ativo,
    resend_from_email: resendFrom || null,
  };

  if (resendKeyInput && !isResendKeyPlaceholder(resendKeyInput)) {
    payload.resend_api_key = resendKeyInput;
  }

  const { error } = await admin.from("corretores").update(payload).eq("id", access.corretor.id);

  if (error) {
    console.error("[saveSiteLeadsNotificacoes] failed", error);
    return { error: "Não foi possível salvar as notificações por e-mail." };
  }

  revalidatePath("/dashboard/configuracoes");

  return { success: true, message: "Notificações por e-mail salvas." };
}

export async function testSiteLeadsNotificacaoEmail(): Promise<
  SiteConfigActionResult & { provider?: string }
> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const settings = await fetchCorretorEmailSettings(access.corretor.id);

  if (!settings) {
    return { error: "Não foi possível carregar as configurações de e-mail." };
  }

  const corretor = settings as Corretor;
  const to = getSiteLeadsNotificationEmail(corretor);

  if (!to) {
    return { error: "Configure o e-mail de destino antes de testar." };
  }

  const credentials = resolveSiteEmailCredentials(corretor);

  if (!credentials) {
    return {
      error:
        "Envio não configurado. Informe sua chave Resend abaixo ou peça ao suporte Deskimob para habilitar o envio da plataforma.",
    };
  }

  const subject = "[Site] Teste de notificação — Deskimob";
  const html = `
    <h2>Teste de notificação</h2>
    <p>Olá${corretor.nome ? `, ${corretor.nome}` : ""}.</p>
    <p>Se você recebeu este e-mail, as notificações de formulários do site estão funcionando.</p>
    <p><em>Enviado em ${new Date().toLocaleString("pt-BR")}</em></p>
  `;

  const result = await sendEmail("testSiteLeadsNotificacaoEmail", to, subject, html, {
    apiKey: credentials.apiKey,
    from: credentials.from,
  });

  if (!result.success) {
    return {
      error: result.error ?? "Falha ao enviar e-mail de teste.",
    };
  }

  return {
    success: true,
    message: `E-mail de teste enviado para ${to}.`,
    provider: credentials.provider,
  };
}
