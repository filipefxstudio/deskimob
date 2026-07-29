"use server";

import { revalidatePath } from "next/cache";

import {
  DEFAULT_MIDIAS_ORIGEM,
  DEFAULT_TIPOS_IMOVEL_CUSTOM,
  EQUIPE_LIMITE_USUARIOS,
  MOTIVOS_DESATIVACAO,
  STORAGE_BUCKET_MARCA_DAGUA,
} from "@/lib/constants/imoveis";
import {
  dedupePerfisEquipe,
  getEquipeAccessContext,
  isActiveAdminPerfil,
  isPerfilConvitePendente,
  isPrincipalPerfil,
  isValidEmail,
  perfilTemAuthVinculado,
  requireEquipeManager,
} from "@/lib/auth/equipe-access";
import { mapAuthErrorFromSupabase } from "@/lib/auth/errors";
import { enviarConviteEquipe } from "@/lib/email/invite";
import { ensureStatusImovelDefaults } from "@/lib/imoveis/status-defaults";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { logPostgrestError } from "@/lib/supabase/postgrest-error";
import { createClient } from "@/lib/supabase/server";
import type { Corretor, MarcaDaguaConfig, MidiaOrigem, MotivoDesativacao, PapelUsuario, Perfil, StatusImovel, TipoImovelCustom } from "@/types";

export type ConfigActionResult = {
  success?: boolean;
  error?: string;
  message?: string;
};

async function getServiceRoleClientSafe() {
  try {
    return createServiceRoleClient();
  } catch (error) {
    console.error("[configuracoes] service role unavailable", error);
    return null;
  }
}

async function seedConfigRowsIfEmpty(
  corretorId: string,
  table: "tipo_imovel_custom" | "midia_origem" | "motivos_desativacao",
  rows: Record<string, unknown>[],
): Promise<void> {
  const admin = await getServiceRoleClientSafe();
  const countClient = admin ?? (await createClient());

  const { count, error: countError } = await countClient
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", corretorId);

  if (countError) {
    logPostgrestError(`seedConfigRowsIfEmpty:${table}:count`, countError);
    return;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const writeClient = admin ?? (await createClient());
  const { error: insertError } = await writeClient.from(table).insert(rows);

  if (insertError) {
    logPostgrestError(`seedConfigRowsIfEmpty:${table}:insert`, insertError);
  }
}

async function fetchConfigRows<T>(
  corretorId: string,
  table: "tipo_imovel_custom" | "midia_origem" | "motivos_desativacao" | "status_imovel",
  orderColumn: string,
): Promise<T[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("corretor_id", corretorId)
    .order(orderColumn);

  if (!error && (data?.length ?? 0) > 0) {
    return data as T[];
  }

  if (error) {
    logPostgrestError(`fetchConfigRows:${table}:user`, error);
  }

  const admin = await getServiceRoleClientSafe();
  if (!admin) {
    return (data ?? []) as T[];
  }

  const { data: fallback, error: fallbackError } = await admin
    .from(table)
    .select("*")
    .eq("corretor_id", corretorId)
    .order(orderColumn);

  if (fallbackError) {
    logPostgrestError(`fetchConfigRows:${table}:admin`, fallbackError);
    return (data ?? []) as T[];
  }

  return (fallback ?? []) as T[];
}

async function ensureTiposDefaults(corretorId: string) {
  await seedConfigRowsIfEmpty(
    corretorId,
    "tipo_imovel_custom",
    DEFAULT_TIPOS_IMOVEL_CUSTOM.map((nome) => ({
      corretor_id: corretorId,
      nome,
      ativo: true,
    })),
  );
}

async function ensureMidiasDefaults(corretorId: string) {
  await seedConfigRowsIfEmpty(
    corretorId,
    "midia_origem",
    DEFAULT_MIDIAS_ORIGEM.map((nome, ordem) => ({
      corretor_id: corretorId,
      nome,
      ordem,
      ativo: true,
    })),
  );
}

async function seedMotivosDesativacao(corretorId: string) {
  await seedConfigRowsIfEmpty(
    corretorId,
    "motivos_desativacao",
    MOTIVOS_DESATIVACAO.map((nome, ordem) => ({
      corretor_id: corretorId,
      nome,
      ordem,
      ativo: true,
    })),
  );
}

export async function getTiposImovelCustom(): Promise<TipoImovelCustom[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  await ensureTiposDefaults(corretor.id);

  return fetchConfigRows<TipoImovelCustom>(corretor.id, "tipo_imovel_custom", "nome");
}

export async function getMidiasOrigem(): Promise<MidiaOrigem[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  await ensureMidiasDefaults(corretor.id);

  return fetchConfigRows<MidiaOrigem>(corretor.id, "midia_origem", "ordem");
}

export async function getPerfisEquipe(): Promise<Perfil[]> {
  const ctx = await getEquipeAccessContext();
  const corretor = ctx?.corretor ?? (await getCorretorForUser());

  if (!corretor) {
    return [];
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("perfis")
      .select("*")
      .eq("corretor_id", corretor.id)
      .order("criado_em");

    if (error) {
      console.error("[getPerfisEquipe] failed", error);
      return [];
    }

    return dedupePerfisEquipe((data ?? []) as Perfil[], corretor.user_id);
  }

  const { data, error } = await admin
    .from("perfis")
    .select("*")
    .eq("corretor_id", corretor.id)
    .order("criado_em");

  if (error) {
    console.error("[getPerfisEquipe] failed", error);
    return [];
  }

  return dedupePerfisEquipe((data ?? []) as Perfil[], corretor.user_id);
}

async function countOtherActiveAdmins(
  admin: ReturnType<typeof createServiceRoleClient>,
  corretorId: string,
  corretor: Pick<Corretor, "user_id" | "email">,
  excludePerfilId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("perfis")
    .select("id, papel, user_id, email, ativo")
    .eq("corretor_id", corretorId)
    .eq("ativo", true)
    .neq("id", excludePerfilId);

  if (error) {
    console.error("[countOtherActiveAdmins] failed", error);
    return 0;
  }

  return (data ?? []).filter((row) =>
    isActiveAdminPerfil(row as Pick<Perfil, "ativo" | "papel" | "user_id" | "email">, corretor),
  ).length;
}

async function emailJaUsadoNoTenant(
  corretorId: string,
  email: string,
  ignorePerfilId?: string,
): Promise<boolean> {
  const admin = createServiceRoleClient();
  let query = admin
    .from("perfis")
    .select("id")
    .eq("corretor_id", corretorId)
    .ilike("email", email);

  if (ignorePerfilId) {
    query = query.neq("id", ignorePerfilId);
  }

  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

async function atualizarEmailLoginPerfil(
  perfil: Perfil,
  corretorId: string,
  corretor: Pick<Corretor, "user_id" | "email">,
  novoEmail: string,
): Promise<ConfigActionResult> {
  const admin = createServiceRoleClient();

  if (await emailJaUsadoNoTenant(corretorId, novoEmail, perfil.id)) {
    return { error: "Este e-mail já está em uso na equipe." };
  }

  if (!perfilTemAuthVinculado(perfil, corretor)) {
    return {
      success: true,
      message:
        "E-mail do convite atualizado. Quando o usuário criar a conta, use este endereço para entrar.",
    };
  }

  const authUserId = isPrincipalPerfil(perfil, corretor)
    ? corretor.user_id
    : perfil.user_id;

  const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
    email: novoEmail,
    email_confirm: true,
  });

  if (authError) {
    console.error("[atualizarEmailLoginPerfil] auth update failed", authError);
    const msg = authError.message.toLowerCase();

    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { error: "Este e-mail já está cadastrado em outra conta." };
    }

    return { error: "Não foi possível atualizar o e-mail de login." };
  }

  if (isPrincipalPerfil(perfil, corretor)) {
    await admin.from("corretores").update({ email: novoEmail }).eq("id", corretorId);
  }

  return { success: true };
}

export async function addTipoImovelCustom(nome: string): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const trimmed = nome.trim();
  if (!trimmed) {
    return { error: "Informe o nome do tipo." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tipo_imovel_custom").insert({
    corretor_id: corretor.id,
    nome: trimmed,
    ativo: true,
  });

  if (error) {
    return { error: "Não foi possível adicionar o tipo." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Tipo adicionado." };
}

export async function toggleTipoImovelCustom(
  id: string,
  ativo: boolean,
): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tipo_imovel_custom")
    .update({ ativo })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    return { error: "Não foi possível atualizar o tipo." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

export async function addMidiaOrigem(nome: string): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const trimmed = nome.trim();
  if (!trimmed) {
    return { error: "Informe o nome da mídia." };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("midia_origem")
    .select("ordem")
    .eq("corretor_id", corretor.id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordem = (last?.ordem ?? -1) + 1;

  const { error } = await supabase.from("midia_origem").insert({
    corretor_id: corretor.id,
    nome: trimmed,
    ordem,
    ativo: true,
  });

  if (error) {
    return { error: "Não foi possível adicionar a mídia." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Mídia adicionada." };
}

export async function toggleMidiaOrigem(
  id: string,
  ativo: boolean,
): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("midia_origem")
    .update({ ativo })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    return { error: "Não foi possível atualizar a mídia." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

export async function editMidiaOrigem(
  id: string,
  nome: string,
): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const trimmed = nome.trim();
  if (!trimmed) {
    return { error: "Informe o nome da mídia." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("midia_origem")
    .update({ nome: trimmed })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    return { error: "Não foi possível atualizar a mídia." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Mídia atualizada." };
}

export async function deleteMidiaOrigem(id: string): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("midia_origem")
    .delete()
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    return { error: "Não foi possível excluir a mídia." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Mídia excluída." };
}

export async function reorderMidiasOrigem(
  orderedIds: string[],
): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const supabase = await createClient();

  for (let index = 0; index < orderedIds.length; index += 1) {
    await supabase
      .from("midia_origem")
      .update({ ordem: index })
      .eq("id", orderedIds[index])
      .eq("corretor_id", corretor.id);
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

export async function convidarPerfil(data: {
  nome: string;
  email: string;
  telefone?: string;
  papel: PapelUsuario;
}): Promise<ConfigActionResult> {
  const access = await requireEquipeManager();
  if ("error" in access) {
    return { error: access.error };
  }

  const { corretor } = access;
  const perfis = await getPerfisEquipe();

  if (perfis.length >= EQUIPE_LIMITE_USUARIOS) {
    return { error: `Limite de ${EQUIPE_LIMITE_USUARIOS} usuários atingido.` };
  }

  const nome = data.nome.trim();
  const email = data.email.trim().toLowerCase();

  if (!nome || !email) {
    return { error: "Informe nome e e-mail." };
  }

  if (!isValidEmail(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (await emailJaUsadoNoTenant(corretor.id, email)) {
    return { error: "Este e-mail já está em uso na equipe." };
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Operação indisponível. Verifique a configuração do servidor." };
  }

  const { data: inviteAuth, error: inviteAuthError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      deskimob_invite: true,
      corretor_id: corretor.id,
    },
  });

  if (inviteAuthError || !inviteAuth.user) {
    const msg = inviteAuthError?.message?.toLowerCase() ?? "";
    console.error("[convidarPerfil] auth user create failed", inviteAuthError);

    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { error: "Este e-mail já possui conta no sistema." };
    }

    return { error: "Não foi possível preparar o convite." };
  }

  const inviteUserId = inviteAuth.user.id;

  const { error } = await admin.from("perfis").insert({
    corretor_id: corretor.id,
    user_id: inviteUserId,
    nome,
    email,
    telefone: data.telefone?.trim() || null,
    papel: data.papel,
    ativo: false,
  });

  if (error) {
    console.error("[convidarPerfil] failed", error);
    await admin.auth.admin.deleteUser(inviteUserId);
    return { error: "Não foi possível registrar o convite." };
  }

  console.info("[convidarPerfil] sending invite email", {
    to: email,
    nome,
    papel: data.papel,
    corretorNome: corretor.nome,
  });

  const emailResult = await enviarConviteEquipe({
    email,
    nome,
    papel: data.papel,
    corretorNome: corretor.nome,
  });

  revalidatePath("/dashboard/configuracoes");

  if (!emailResult.success) {
    console.error("[convidarPerfil] invite email failed", {
      to: email,
      error: emailResult.error,
      resendBody: emailResult.resendBody ?? null,
    });

    const detail = emailResult.error?.trim();
    const message = detail
      ? `Perfil registrado, mas o e-mail de convite não pôde ser enviado: ${detail}`
      : "Perfil registrado, mas o e-mail de convite não pôde ser enviado.";

    return {
      success: true,
      message,
    };
  }

  return {
    success: true,
    message: "Convite enviado! O usuário receberá um e-mail com link de acesso.",
  };
}

export async function togglePerfilAtivo(
  id: string,
  ativo: boolean,
): Promise<ConfigActionResult> {
  const access = await requireEquipeManager();
  if ("error" in access) {
    return { error: access.error };
  }

  const { corretor } = access;

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Operação indisponível. Verifique a configuração do servidor." };
  }

  const { data: perfil } = await admin
    .from("perfis")
    .select("*")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!perfil) {
    return { error: "Perfil não encontrado." };
  }

  if (isPrincipalPerfil(perfil as Perfil, corretor) && !ativo) {
    return { error: "O administrador principal não pode ser desativado." };
  }

  const { error } = await admin
    .from("perfis")
    .update({ ativo })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    return { error: "Não foi possível atualizar o perfil." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

function getAuthUserIdForPerfil(
  perfil: Perfil,
  corretor: Pick<Corretor, "user_id" | "email">,
): string | null {
  if (isPrincipalPerfil(perfil, corretor)) {
    return corretor.user_id;
  }

  if (isPerfilConvitePendente(perfil, corretor)) {
    if (perfil.user_id && perfil.user_id !== corretor.user_id) {
      return perfil.user_id;
    }

    return null;
  }

  return perfil.user_id || null;
}

async function definirSenhaLoginPerfil(
  perfil: Perfil,
  corretor: Pick<Corretor, "user_id" | "email">,
  senha: string,
): Promise<ConfigActionResult> {
  const authUserId = getAuthUserIdForPerfil(perfil, corretor);

  if (!authUserId) {
    return {
      error: "Este membro ainda não possui conta de login vinculada para receber senha.",
    };
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Operação indisponível. Verifique a configuração do servidor." };
  }

  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    password: senha,
  });

  if (error) {
    console.error("[definirSenhaLoginPerfil] auth update failed", error);
    return { error: mapAuthErrorFromSupabase(error) };
  }

  return { success: true };
}

export async function editarPerfil(
  id: string,
  data: {
    nome: string;
    email: string;
    papel: PapelUsuario;
    senhaInicial?: string;
    confirmarSenhaInicial?: string;
  },
): Promise<ConfigActionResult> {
  const access = await requireEquipeManager();
  if ("error" in access) {
    return { error: access.error };
  }

  const { corretor, isAdmin } = access;
  const nome = data.nome.trim();
  const email = data.email.trim().toLowerCase();
  const senhaInicial = data.senhaInicial?.trim() ?? "";
  const confirmarSenhaInicial = data.confirmarSenhaInicial?.trim() ?? "";
  const querDefinirSenha = senhaInicial.length > 0 || confirmarSenhaInicial.length > 0;

  if (!nome || !email) return { error: "Informe nome e e-mail." };
  if (!isValidEmail(email)) return { error: "Informe um e-mail válido." };

  if (querDefinirSenha) {
    if (!isAdmin) {
      return { error: "Somente administradores podem definir senha inicial." };
    }

    if (!senhaInicial || !confirmarSenhaInicial) {
      return { error: "Preencha a senha inicial e a confirmação." };
    }

    if (senhaInicial.length < 6) {
      return { error: "A senha deve ter pelo menos 6 caracteres." };
    }

    if (senhaInicial !== confirmarSenhaInicial) {
      return { error: "As senhas não coincidem." };
    }
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Operação indisponível. Verifique a configuração do servidor." };
  }

  const { data: perfil, error: fetchError } = await admin
    .from("perfis")
    .select("*")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (fetchError || !perfil) {
    return { error: "Perfil não encontrado." };
  }

  const perfilAtual = perfil as Perfil;
  const principal = isPrincipalPerfil(perfilAtual, corretor);

  if (principal) {
    data.papel = "admin";
  }

  if (principal && data.papel !== "admin") {
    return { error: "O administrador principal deve permanecer com papel Admin." };
  }

  if (!principal && perfilAtual.papel === "admin" && data.papel !== "admin") {
    const outrosAdmins = await countOtherActiveAdmins(
      admin,
      corretor.id,
      corretor,
      id,
    );

    if (outrosAdmins < 1) {
      return { error: "A equipe precisa de pelo menos um administrador ativo." };
    }
  }

  const emailAlterado = email !== perfilAtual.email.trim().toLowerCase();
  let emailMessage: string | undefined;

  if (emailAlterado) {
    const emailResult = await atualizarEmailLoginPerfil(
      perfilAtual,
      corretor.id,
      corretor,
      email,
    );

    if (emailResult.error) {
      return { error: emailResult.error };
    }

    emailMessage = emailResult.message;
  }

  if (querDefinirSenha) {
    const senhaResult = await definirSenhaLoginPerfil(perfilAtual, corretor, senhaInicial);

    if (senhaResult.error) {
      return { error: senhaResult.error };
    }
  }

  const { error } = await admin
    .from("perfis")
    .update({ nome, email, papel: data.papel })
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível atualizar o perfil." };

  revalidatePath("/dashboard/configuracoes");

  const senhaMessage = querDefinirSenha ? " Senha de login atualizada." : "";

  if (emailAlterado && isPerfilConvitePendente(perfilAtual, corretor)) {
    return {
      success: true,
      message:
        (emailMessage ??
          "Perfil atualizado. O e-mail de login será usado quando o convidado ativar a conta.") +
        senhaMessage,
    };
  }

  if (emailAlterado) {
    return {
      success: true,
      message: (emailMessage ?? "Perfil e e-mail de login atualizados.") + senhaMessage,
    };
  }

  if (querDefinirSenha) {
    return { success: true, message: "Perfil atualizado. Senha de login definida." };
  }

  return { success: true, message: "Perfil atualizado." };
}

export async function excluirPerfil(id: string): Promise<ConfigActionResult> {
  const access = await requireEquipeManager();
  if ("error" in access) {
    return { error: access.error };
  }

  const { corretor } = access;

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Operação indisponível. Verifique a configuração do servidor." };
  }

  const { data: perfil } = await admin
    .from("perfis")
    .select("*")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!perfil) return { error: "Perfil não encontrado." };

  const perfilAtual = perfil as Perfil;

  if (isPrincipalPerfil(perfilAtual, corretor)) {
    return { error: "O administrador principal não pode ser excluído." };
  }

  if (perfilAtual.papel === "admin" && perfilAtual.ativo) {
    const outrosAdmins = await countOtherActiveAdmins(
      admin,
      corretor.id,
      corretor,
      id,
    );

    if (outrosAdmins < 1) {
      return { error: "Não é possível excluir o único administrador ativo." };
    }
  }

  const { error } = await admin
    .from("perfis")
    .delete()
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível excluir o perfil." };

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Perfil excluído." };
}

export async function getStatusImovelConfig(): Promise<StatusImovel[]> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return [];
  }

  try {
    await ensureStatusImovelDefaults(corretor.id);
  } catch (error) {
    console.error("[getStatusImovelConfig] ensure defaults failed", error);
  }

  return fetchConfigRows<StatusImovel>(corretor.id, "status_imovel", "ordem");
}

export async function addStatusImovel(data: {
  nome: string;
  cor: string;
  ordem?: number;
}): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const nome = data.nome.trim();
  if (!nome) {
    return { error: "Informe o nome do status." };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("status_imovel")
    .select("ordem")
    .eq("corretor_id", corretor.id)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ordem = data.ordem ?? (last?.ordem ?? 0) + 1;

  const { error } = await supabase.from("status_imovel").insert({
    corretor_id: corretor.id,
    nome,
    cor: data.cor,
    padrao: false,
    ativo: true,
    ordem,
  });

  if (error) {
    return { error: "Não foi possível adicionar o status." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Status adicionado." };
}

export async function updateStatusImovel(
  id: string,
  data: { nome?: string; cor?: string; ordem?: number; ativo?: boolean },
): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("status_imovel")
    .update(data)
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    return { error: "Não foi possível atualizar o status." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

export async function deleteStatusImovel(id: string): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const supabase = await createClient();
  const { data: status } = await supabase
    .from("status_imovel")
    .select("padrao")
    .eq("id", id)
    .eq("corretor_id", corretor.id)
    .maybeSingle();

  if (!status) {
    return { error: "Status não encontrado." };
  }

  if (status.padrao) {
    return { error: "Status padrão não podem ser excluídos. Desative-o em vez disso." };
  }

  const { error } = await supabase
    .from("status_imovel")
    .delete()
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) {
    return { error: "Não foi possível excluir o status." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

export async function getMarcaDaguaConfigByCorretorId(
  corretorId: string,
): Promise<MarcaDaguaConfig | null> {
  return fetchMarcaDaguaConfigRow(corretorId);
}

export async function getMarcaDaguaConfig(): Promise<MarcaDaguaConfig | null> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return null;
  }

  return fetchMarcaDaguaConfigRow(corretor.id);
}

async function fetchMarcaDaguaConfigRow(corretorId: string): Promise<MarcaDaguaConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marca_dagua_config")
    .select("*")
    .eq("corretor_id", corretorId)
    .maybeSingle();

  if (!error) {
    return (data as MarcaDaguaConfig | null) ?? null;
  }

  logPostgrestError("fetchMarcaDaguaConfigRow", error);

  try {
    const admin = createServiceRoleClient();
    const { data: fallbackData, error: fallbackError } = await admin
      .from("marca_dagua_config")
      .select("*")
      .eq("corretor_id", corretorId)
      .maybeSingle();

    if (fallbackError) {
      logPostgrestError("fetchMarcaDaguaConfigRow:fallback", fallbackError);
      return null;
    }

    console.warn("[fetchMarcaDaguaConfigRow] used service role fallback", { corretorId });
    return (fallbackData as MarcaDaguaConfig | null) ?? null;
  } catch (fallbackError) {
    console.error("[fetchMarcaDaguaConfigRow] service role fallback unavailable", fallbackError);
    return null;
  }
}

async function upsertMarcaDaguaConfigRow(
  corretorId: string,
  payload: Record<string, string | number | null>,
): Promise<ConfigActionResult> {
  const existing = await fetchMarcaDaguaConfigRow(corretorId);

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { error: "Operação indisponível. Verifique a configuração do servidor." };
  }

  if (existing) {
    const { error } = await admin
      .from("marca_dagua_config")
      .update({
        ...payload,
        atualizado_em: new Date().toISOString(),
      })
      .eq("corretor_id", corretorId);

    if (error) {
      logPostgrestError("upsertMarcaDaguaConfigRow:update", error);
      return { error: "Não foi possível salvar a configuração." };
    }

    return { success: true };
  }

  const { error } = await admin.from("marca_dagua_config").insert({
    corretor_id: corretorId,
    ...payload,
  });

  if (error) {
    logPostgrestError("upsertMarcaDaguaConfigRow:insert", error);
    return { error: "Não foi possível salvar a configuração." };
  }

  return { success: true };
}

export async function saveMarcaDaguaConfig(data: {
  tamanho_percent: number;
  opacidade_percent: number;
  posicao: string;
}): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const saveResult = await upsertMarcaDaguaConfigRow(corretor.id, {
    tamanho_percent: data.tamanho_percent,
    opacidade_percent: data.opacidade_percent,
    posicao: data.posicao,
  });

  if (saveResult.error) {
    return saveResult;
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Configurações salvas." };
}

export async function uploadMarcaDaguaLogo(
  formData: FormData,
): Promise<ConfigActionResult & { logoUrl?: string }> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada." };
  }

  const file = formData.get("logo") as File | null;

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
  const storagePath = `${corretor.id}/logo.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET_MARCA_DAGUA)
    .upload(storagePath, buffer, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadError) {
    console.error("[uploadMarcaDaguaLogo] failed", uploadError);
    return { error: "Não foi possível enviar a logo." };
  }

  const { data: publicUrlData } = admin.storage
    .from(STORAGE_BUCKET_MARCA_DAGUA)
    .getPublicUrl(storagePath);

  const logoUrl = publicUrlData.publicUrl;
  const saveResult = await upsertMarcaDaguaConfigRow(corretor.id, {
    logo_url: logoUrl,
  });

  if (saveResult.error) {
    return saveResult;
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, logoUrl, message: "Logo enviada." };
}

// ---------------------------------------------------------------------------
// Motivos de desativação de imóvel
// ---------------------------------------------------------------------------

export async function getMotivosDesativacao(): Promise<MotivoDesativacao[]> {
  const corretor = await getCorretorForUser();
  if (!corretor) return [];

  await seedMotivosDesativacao(corretor.id);

  return fetchConfigRows<MotivoDesativacao>(corretor.id, "motivos_desativacao", "ordem");
}

export async function saveMotivoDesativacao(input: {
  id?: string;
  nome: string;
  ativo?: boolean;
}): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const nome = input.nome.trim();
  if (!nome) return { error: "Informe o nome do motivo." };

  const supabase = await createClient();

  if (input.id) {
    const { error } = await supabase
      .from("motivos_desativacao")
      .update({ nome, ativo: input.ativo ?? true })
      .eq("id", input.id)
      .eq("corretor_id", corretor.id);
    if (error) return { error: "Não foi possível salvar." };
  } else {
    const { count } = await supabase
      .from("motivos_desativacao")
      .select("id", { count: "exact", head: true })
      .eq("corretor_id", corretor.id);
    const { error } = await supabase.from("motivos_desativacao").insert({
      corretor_id: corretor.id,
      nome,
      ordem: count ?? 0,
      ativo: true,
    });
    if (error) return { error: "Não foi possível adicionar." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true, message: "Motivo salvo." };
}

export async function deleteMotivoDesativacao(id: string): Promise<ConfigActionResult> {
  const corretor = await getCorretorForUser();
  if (!corretor) return { error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("motivos_desativacao")
    .delete()
    .eq("id", id)
    .eq("corretor_id", corretor.id);

  if (error) return { error: "Não foi possível excluir." };

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}
