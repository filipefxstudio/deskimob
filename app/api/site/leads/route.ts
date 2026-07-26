import { NextResponse } from "next/server";

import { processarLeadIntegracao } from "@/lib/atendimentos/integracao-lead";
import {
  notificarCorretorContatoSite,
  notificarCorretorInteresseImovel,
} from "@/lib/site/email";
import { getCorretorByDominio, getCorretorBySlug } from "@/lib/site/queries";
import { getSiteEmail } from "@/lib/site/social";
import { createServiceRoleClient } from "@/lib/supabase/admin";

interface SiteLeadBody {
  corretor_id?: string;
  tenant_slug?: string;
  hostname?: string;
  nome?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  imovel_id?: string;
  preferencia_contato?: string;
  origem?: string;
}

async function resolveCorretor(body: SiteLeadBody, tenantHeader: string | null) {
  if (body.corretor_id) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("corretores")
      .select("*")
      .eq("id", body.corretor_id)
      .maybeSingle();
    return data;
  }

  const slug = body.tenant_slug ?? tenantHeader;
  if (slug) {
    return getCorretorBySlug(slug);
  }

  if (body.hostname) {
    return getCorretorByDominio(body.hostname);
  }

  return null;
}

export async function POST(request: Request) {
  let body: SiteLeadBody;

  try {
    body = (await request.json()) as SiteLeadBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const tenantHeader = request.headers.get("x-tenant-slug");
  const corretor = await resolveCorretor(body, tenantHeader);

  if (!corretor) {
    return NextResponse.json({ error: "Corretor não encontrado." }, { status: 404 });
  }

  const nome = body.nome?.trim() ?? "";
  const telefone = body.telefone?.trim() ?? "";

  if (!nome) {
    return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });
  }

  if (!telefone) {
    return NextResponse.json({ error: "Informe seu telefone." }, { status: 400 });
  }

  const observacoesPartes = [body.observacoes?.trim()].filter(Boolean);

  if (body.preferencia_contato?.trim()) {
    observacoesPartes.unshift(`Preferência de contato: ${body.preferencia_contato.trim()}`);
  }

  const observacoes = observacoesPartes.join("\n\n") || null;

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    console.error("[site/leads] admin client", error);
    return NextResponse.json({ error: "Erro de configuração." }, { status: 500 });
  }

  let resultado;
  try {
    resultado = await processarLeadIntegracao(supabase, {
      corretorId: corretor.id,
      nome,
      telefone,
      email: body.email?.trim() || null,
      imovelId: body.imovel_id ?? null,
      observacoes,
      origem: "site",
    });
  } catch (error) {
    console.error("[site/leads] processarLeadIntegracao failed", error);
    return NextResponse.json({ error: "Não foi possível registrar seu contato." }, { status: 500 });
  }

  const emailDestino = getSiteEmail(corretor);

  if (emailDestino) {
    if (body.imovel_id) {
      const { data: imovel } = await supabase
        .from("imoveis")
        .select("titulo, codigo, codigo_personalizado")
        .eq("id", body.imovel_id)
        .maybeSingle();

      const emailResult = await notificarCorretorInteresseImovel({
        email: emailDestino,
        corretorNome: corretor.nome,
        leadNome: nome,
        leadTelefone: telefone,
        leadEmail: body.email?.trim() || null,
        imovelTitulo: imovel?.titulo ?? "Imóvel",
        imovelCodigo: imovel?.codigo_personalizado ?? imovel?.codigo ?? null,
        observacoes: body.observacoes?.trim() || null,
        preferenciaContato: body.preferencia_contato?.trim() || null,
      });

      if (!emailResult.success) {
        console.error("[site/leads] email imovel failed", emailResult.error);
      }
    } else {
      const emailResult = await notificarCorretorContatoSite({
        email: emailDestino,
        corretorNome: corretor.nome,
        leadNome: nome,
        leadTelefone: telefone,
        leadEmail: body.email?.trim() || null,
        observacoes: body.observacoes?.trim() || null,
      });

      if (!emailResult.success) {
        console.error("[site/leads] email contato failed", emailResult.error);
      }
    }
  } else {
    console.warn("[site/leads] corretor sem e-mail de contato configurado", {
      corretorId: corretor.id,
    });
  }

  return NextResponse.json({
    success: true,
    leadId: resultado.leadId,
    criado: resultado.criado,
    message: "Mensagem enviada com sucesso! Entraremos em contato em breve.",
  });
}
