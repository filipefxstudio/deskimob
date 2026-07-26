import { NextResponse } from "next/server";

import { sendEmail } from "@/lib/email/resend";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: corretor, error: corretorError } = await supabase
    .from("corretores")
    .select("id, nome, email, site_email, contato_email")
    .eq("user_id", user.id)
    .single();

  if (corretorError || !corretor) {
    return NextResponse.json(
      { error: "Corretor não encontrado para o usuário autenticado." },
      { status: 404 },
    );
  }

  const to =
    corretor.site_email?.trim() ||
    corretor.contato_email?.trim() ||
    corretor.email?.trim() ||
    "";

  if (!to) {
    return NextResponse.json(
      { error: "Nenhum e-mail cadastrado no perfil do corretor." },
      { status: 400 },
    );
  }

  const subject = "Deskimob — teste de e-mail";
  const html = `
    <h2>Teste de e-mail</h2>
    <p>Olá${corretor.nome ? `, ${corretor.nome}` : ""}.</p>
    <p>Este é um e-mail de teste enviado pelo Deskimob em ${new Date().toLocaleString("pt-BR")}.</p>
    <p>Se você recebeu esta mensagem, o envio via Resend está funcionando.</p>
  `;

  const result = await sendEmail("testEmail", to, subject, html);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        to,
        message: result.error ?? "Falha ao enviar e-mail de teste.",
        resendBody: result.resendBody ?? null,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    to,
    message: "E-mail de teste enviado com sucesso.",
    resendBody: result.resendBody ?? null,
  });
}
