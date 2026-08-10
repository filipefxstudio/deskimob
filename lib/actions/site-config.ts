"use server";

import { revalidatePath } from "next/cache";

import { STORAGE_BUCKET_SITE_ASSETS } from "@/lib/constants/site";
import { requireSiteAdmin } from "@/lib/auth/equipe-access";
import { isReservedTenantSlug } from "@/lib/site/host";
import { normalizeSiteCorPrimaria, normalizeSiteCorSecundaria, isValidSiteHexColor } from "@/lib/site/color";
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

export type SaveSiteSlugInput = {
  slug?: string;
};

/** @deprecated Use SaveSiteSlugInput — domínio próprio usa site-domain.ts */
export type SaveSiteDominioInput = SaveSiteSlugInput;

function isValidHexColor(value: string): boolean {
  return isValidSiteHexColor(value);
}

function mapCorretorUpdateError(error: { code?: string; message?: string }): string {
  const message = error.message ?? "";

  if (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes("site_cor_primaria") ||
    message.includes("site_cor_secundaria")
  ) {
    return "O banco de dados está desatualizado. Avise o suporte para aplicar as migrations pendentes.";
  }

  if (error.code === "42501" || message.toLowerCase().includes("permission denied")) {
    return "Sem permissão para salvar. Saia e entre novamente na conta.";
  }

  return "Não foi possível salvar. Tente novamente em instantes.";
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

type CorretorSiteUpdatePayload = Partial<
  Pick<
    Corretor,
    | "logo_url"
    | "site_cor_primaria"
    | "site_cor_secundaria"
    | "site_favicon_url"
    | "hero_image_url"
    | "hero_titulo"
    | "hero_subtitulo"
    | "site_sobre_foto_url"
    | "site_sobre_titulo"
    | "site_sobre_texto"
    | "site_nome_exibicao"
    | "site_creci"
    | "site_telefone_vendas"
    | "site_telefone_locacao"
    | "site_email"
    | "site_instagram"
    | "site_youtube"
    | "site_tiktok"
    | "site_linkedin"
    | "site_facebook"
    | "site_horario"
    | "site_endereco"
    | "dominio_custom"
    | "slug"
  >
>;

async function updateCorretorSiteFields(
  corretorId: string,
  payload: CorretorSiteUpdatePayload,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("corretores")
    .update(payload)
    .eq("id", corretorId)
    .select("id")
    .maybeSingle();

  if (!error && data) {
    return {};
  }

  if (error) {
    console.error("[updateCorretorSiteFields] authenticated update failed", {
      corretorId,
      code: error.code,
      message: error.message,
    });
  } else {
    console.error("[updateCorretorSiteFields] authenticated update matched 0 rows", {
      corretorId,
    });
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch (fallbackError) {
    console.error("[updateCorretorSiteFields] service role unavailable", fallbackError);
    return {
      error: error
        ? mapCorretorUpdateError(error)
        : "Operação indisponível. Verifique a configuração do servidor.",
    };
  }

  const { data: adminData, error: adminError } = await admin
    .from("corretores")
    .update(payload)
    .eq("id", corretorId)
    .select("id")
    .maybeSingle();

  if (adminError) {
    console.error("[updateCorretorSiteFields] service role update failed", {
      corretorId,
      code: adminError.code,
      message: adminError.message,
    });
    return { error: mapCorretorUpdateError(adminError) };
  }

  if (!adminData) {
    console.error("[updateCorretorSiteFields] service role update matched 0 rows", { corretorId });
    return { error: "Conta não encontrada. Entre em contato com o suporte." };
  }

  if (error || !data) {
    console.warn("[updateCorretorSiteFields] used service role fallback", { corretorId });
  }

  return {};
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

  const primaria = normalizeSiteCorPrimaria(data.site_cor_primaria);
  const secundaria = normalizeSiteCorSecundaria(data.site_cor_secundaria);

  if (!isValidHexColor(primaria) || !isValidHexColor(secundaria)) {
    return { error: "Informe cores válidas no formato #RRGGBB." };
  }

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    site_cor_primaria: primaria,
    site_cor_secundaria: secundaria,
  });

  if (updateResult.error) {
    return { error: updateResult.error };
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    logo_url: uploadResult.url,
  });

  if (updateResult.error) {
    return { error: updateResult.error };
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    site_favicon_url: uploadResult.url,
  });

  if (updateResult.error) {
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    hero_image_url: uploadResult.url,
  });

  if (updateResult.error) {
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    hero_image_url: null,
  });

  if (updateResult.error) {
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    hero_titulo: data.hero_titulo.trim() || null,
    hero_subtitulo: data.hero_subtitulo.trim() || null,
  });

  if (updateResult.error) {
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    site_sobre_foto_url: uploadResult.url,
  });

  if (updateResult.error) {
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
    site_sobre_titulo: data.site_sobre_titulo.trim() || null,
    site_sobre_texto: data.site_sobre_texto.trim() || null,
  });

  if (updateResult.error) {
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

  const updateResult = await updateCorretorSiteFields(corretor.id, {
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
  });

  if (updateResult.error) {
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

export async function saveSiteSlug(data: SaveSiteSlugInput): Promise<SiteConfigActionResult> {
  const access = await requireSiteAdminCorretor();

  if ("error" in access) {
    return access;
  }

  const { corretor } = access;
  const slugResult = await resolveSiteSlugUpdate(corretor, data.slug);

  if ("error" in slugResult && slugResult.error) {
    return { error: slugResult.error };
  }

  if (!("slug" in slugResult) || !slugResult.slug) {
    return { success: true, message: "Nenhuma alteração no slug." };
  }

  const updateResult = await updateCorretorSiteFields(corretor.id, { slug: slugResult.slug });

  if (updateResult.error) {
    return { error: "Não foi possível salvar o slug do site." };
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");

  if (corretor.slug) {
    revalidatePath(`/${corretor.slug}`);
  }

  revalidatePath(`/${slugResult.slug}`);

  return {
    success: true,
    message: "Slug salvo.",
  };
}

/** Mantido por compatibilidade — salva apenas o slug. */
export async function saveSiteDominio(data: SaveSiteSlugInput): Promise<SiteConfigActionResult> {
  return saveSiteSlug(data);
}
