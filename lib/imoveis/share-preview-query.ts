import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorBySlug, mapImovelRow } from "@/lib/site/queries";
import type { Corretor, Imovel, ImovelFoto } from "@/types";

type ImovelRow = Imovel & {
  imovel_fotos: ImovelFoto[] | null;
};

const CORRETOR_PREVIEW_COLUMNS =
  "id, user_id, nome, email, telefone, creci, slug, dominio_custom, dominio_custom_status, foto_url, logo_url, site_cor_primaria, site_cor_secundaria, site_favicon_url, site_tarja_cor, site_nome_exibicao, hero_image_url, hero_titulo, hero_subtitulo, sobre, sobre_titulo, sobre_texto, sobre_foto_url, site_sobre_titulo, site_sobre_texto, site_sobre_foto_url, site_creci, site_telefone_vendas, site_telefone_locacao, site_email, site_instagram, site_youtube, site_tiktok, site_linkedin, site_facebook, site_horario, site_endereco, contato_email, contato_telefone, contato_endereco, contato_horario, whatsapp, criado_em, atualizado_em";

export async function resolveImovelSharePreview(
  token: string,
): Promise<{ imovel: Imovel; corretor: Corretor } | null> {
  let supabase;

  try {
    supabase = createServiceRoleClient();
  } catch {
    return null;
  }

  const { data: imovelRow, error: imovelError } = await supabase
    .from("imoveis")
    .select(`*, imovel_fotos(*)`)
    .eq("token_compartilhamento", token)
    .maybeSingle();

  if (!imovelError && imovelRow) {
    const { data: corretor, error: corretorError } = await supabase
      .from("corretores")
      .select(CORRETOR_PREVIEW_COLUMNS)
      .eq("id", imovelRow.corretor_id)
      .maybeSingle();

    if (!corretorError && corretor) {
      return {
        imovel: mapImovelRow(imovelRow as ImovelRow),
        corretor: corretor as Corretor,
      };
    }
  }

  const { data: selecionado, error: selecionadoError } = await supabase
    .from("lead_imoveis_selecionados")
    .select(`*, imovel:imoveis(*, imovel_fotos(*)), corretor:corretores(${CORRETOR_PREVIEW_COLUMNS})`)
    .eq("token_compartilhamento", token)
    .maybeSingle();

  if (selecionadoError || !selecionado?.imovel || !selecionado.corretor) {
    return null;
  }

  return {
    imovel: mapImovelRow(selecionado.imovel as ImovelRow),
    corretor: selecionado.corretor as Corretor,
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
