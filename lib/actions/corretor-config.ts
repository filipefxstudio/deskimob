"use server";

import { revalidatePath } from "next/cache";

import { STORAGE_BUCKET_SITE_ASSETS } from "@/lib/constants/site";
import { getEquipeAccessContext } from "@/lib/auth/equipe-access";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
  url?: string;
};

export type SavePerfilInput = {
  nome: string;
  telefone: string;
};

export type SaveWhatsAppInput = {
  zapi_instance_id: string;
  zapi_token: string;
  whatsapp: string;
};

export type SaveSiteInput = {
  dominio_custom: string;
};

export type ChangePasswordInput = {
  nova_senha: string;
  confirmar_senha: string;
};

async function uploadCorretorAsset(
  formData: FormData,
  fieldName: string,
  fileName: string,
): Promise<ActionResult & { url?: string }> {
  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

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
    console.error(`[uploadCorretorAsset:${fileName}]`, uploadError);
    return { error: "Não foi possível enviar a imagem." };
  }

  const { data: publicUrlData } = admin.storage
    .from(STORAGE_BUCKET_SITE_ASSETS)
    .getPublicUrl(storagePath);

  return { success: true, url: publicUrlData.publicUrl, message: "Imagem enviada." };
}

export async function savePerfilCorretor(data: SavePerfilInput): Promise<ActionResult> {
  const ctx = await getEquipeAccessContext();

  if (!ctx) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { corretor, perfil, isAccountOwner } = ctx;
  const nome = data.nome.trim();

  if (!nome) {
    return { error: "Informe seu nome." };
  }

  const telefone = data.telefone.trim() || null;
  const supabase = await createClient();

  if (isAccountOwner || !perfil) {
    const { error } = await supabase
      .from("corretores")
      .update({ nome, telefone })
      .eq("id", corretor.id);

    if (error) {
      return { error: "Não foi possível salvar seu perfil." };
    }
  } else {
    const { error } = await supabase
      .from("perfis")
      .update({ nome, telefone })
      .eq("id", perfil.id)
      .eq("corretor_id", corretor.id);

    if (error) {
      return { error: "Não foi possível salvar seu perfil." };
    }
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");

  return { success: true, message: "Perfil atualizado com sucesso." };
}

export async function uploadFotoPerfil(formData: FormData): Promise<ActionResult> {
  const ctx = await getEquipeAccessContext();
  if (!ctx) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const { corretor, perfil, isAccountOwner } = ctx;
  const uploadResult = await uploadCorretorAsset(formData, "foto", "perfil");
  if (uploadResult.error || !uploadResult.url) {
    return uploadResult;
  }

  const supabase = await createClient();

  if (isAccountOwner || !perfil) {
    const { error } = await supabase
      .from("corretores")
      .update({ foto_url: uploadResult.url })
      .eq("id", corretor.id);

    if (error) {
      return { error: "Não foi possível salvar a foto." };
    }
  } else {
    const { error } = await supabase
      .from("perfis")
      .update({ foto_url: uploadResult.url })
      .eq("id", perfil.id)
      .eq("corretor_id", corretor.id);

    if (error) {
      return { error: "Não foi possível salvar a foto." };
    }
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");
  return { success: true, url: uploadResult.url, message: "Foto atualizada." };
}

export async function uploadLogoCrm(formData: FormData): Promise<ActionResult> {
  const ctx = await getEquipeAccessContext();
  if (!ctx) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  if (!ctx.isAccountOwner) {
    return { error: "Somente o administrador principal pode alterar a logo do CRM." };
  }

  const { corretor } = ctx;

  const uploadResult = await uploadCorretorAsset(formData, "logo", "logo-crm");
  if (uploadResult.error || !uploadResult.url) {
    return uploadResult;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({ logo_crm_url: uploadResult.url })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar a logo do CRM." };
  }

  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard");

  return { success: true, url: uploadResult.url, message: "Logo do CRM enviada." };
}

export async function saveWhatsAppConfig(data: SaveWhatsAppInput): Promise<ActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const zapiInstanceId = data.zapi_instance_id.trim();
  const zapiToken = data.zapi_token.trim();
  const whatsapp = data.whatsapp.trim();

  if (!zapiInstanceId || !zapiToken) {
    return { error: "Preencha o ID da instância e o token da Z-API." };
  }

  if (!whatsapp) {
    return { error: "Informe o número do WhatsApp para receber mensagens." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({
      zapi_instance_id: zapiInstanceId,
      zapi_token: zapiToken,
      whatsapp,
    })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar as configurações do WhatsApp." };
  }

  revalidatePath("/dashboard/configuracoes");

  return { success: true, message: "WhatsApp configurado com sucesso." };
}

export async function changePassword(data: ChangePasswordInput): Promise<ActionResult> {
  const novaSenha = data.nova_senha.trim();
  const confirmar = data.confirmar_senha.trim();

  if (novaSenha.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  if (novaSenha !== confirmar) {
    return { error: "As senhas não coincidem." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: novaSenha });

  if (error) {
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }

  return { success: true, message: "Senha alterada com sucesso." };
}

export async function saveSiteConfig(data: SaveSiteInput): Promise<ActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("corretores")
    .update({
      dominio_custom: data.dominio_custom.trim() || null,
    })
    .eq("id", corretor.id);

  if (error) {
    return { error: "Não foi possível salvar as configurações do site." };
  }

  return { success: true, message: "Configurações do site salvas." };
}
