import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorBySlug } from "@/lib/site/queries";
import {
  mapImovelPublicoRow,
  PUBLIC_IMOVEL_SELECT,
  type ImovelPublico,
} from "@/lib/site/imovel-publico";
import type { Corretor, ImovelFoto } from "@/types";

type ImovelPublicoRow = ImovelPublico & {
  imovel_fotos: ImovelFoto[] | null;
};

const CORRETOR_PREVIEW_COLUMNS =
  "id, user_id, nome, email, telefone, creci, slug, dominio_custom, dominio_custom_status, foto_url, logo_url, site_cor_primaria, site_cor_secundaria, site_favicon_url, site_tarja_cor, site_nome_exibicao, hero_image_url, hero_titulo, hero_subtitulo, sobre, sobre_titulo, sobre_texto, sobre_foto_url, site_sobre_titulo, site_sobre_texto, site_sobre_foto_url, site_creci, site_telefone_vendas, site_telefone_locacao, site_email, site_instagram, site_youtube, site_tiktok, site_linkedin, site_facebook, site_horario, site_endereco, site_gtm_id, contato_email, contato_telefone, contato_endereco, contato_horario, whatsapp, criado_em, atualizado_em";

async function fetchImovelPublicoById(
  supabase: ReturnType<typeof createServiceRoleClient>,
  imovelId: string,
): Promise<ImovelPublico | null> {
  const { data, error } = await supabase
    .from("imoveis")
    .select(PUBLIC_IMOVEL_SELECT)
    .eq("id", imovelId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapImovelPublicoRow(data as unknown as ImovelPublicoRow);
}

export async function resolveImovelSharePreview(
  token: string,
): Promise<{ imovel: ImovelPublico; corretor: Corretor } | null> {
  let supabase;

  try {
    supabase = createServiceRoleClient();
  } catch {
    return null;
  }

  const { data: imovelRow, error: imovelError } = await supabase
    .from("imoveis")
    .select(PUBLIC_IMOVEL_SELECT)
    .eq("token_compartilhamento", token)
    .maybeSingle();

  if (!imovelError && imovelRow) {
    const row = imovelRow as unknown as ImovelPublicoRow;
    const { data: corretor, error: corretorError } = await supabase
      .from("corretores")
      .select(CORRETOR_PREVIEW_COLUMNS)
      .eq("id", row.corretor_id)
      .maybeSingle();

    if (!corretorError && corretor) {
      return {
        imovel: mapImovelPublicoRow(row),
        corretor: corretor as Corretor,
      };
    }
  }

  const { data: selecionado, error: selecionadoError } = await supabase
    .from("lead_imoveis_selecionados")
    .select("imovel_id, corretor_id")
    .eq("token_compartilhamento", token)
    .maybeSingle();

  if (selecionadoError || !selecionado?.imovel_id || !selecionado.corretor_id) {
    return null;
  }

  const [imovel, corretorResult] = await Promise.all([
    fetchImovelPublicoById(supabase, selecionado.imovel_id),
    supabase
      .from("corretores")
      .select(CORRETOR_PREVIEW_COLUMNS)
      .eq("id", selecionado.corretor_id)
      .maybeSingle(),
  ]);

  if (!imovel || corretorResult.error || !corretorResult.data) {
    return null;
  }

  return {
    imovel,
    corretor: corretorResult.data as Corretor,
  };
}

export async function resolveCorretorForSharePreview(
  corretor: Corretor,
): Promise<Corretor> {
  if (corretor.dominio_custom !== undefined) {
    return corretor;
  }

  const bySlug = await getCorretorBySlug(corretor.slug);
  return bySlug ?? corretor;
}
