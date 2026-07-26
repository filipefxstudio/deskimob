import { cache } from "react";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getImovelFotoPublicUrl } from "@/lib/imoveis/foto-url";
import type {
  Corretor,
  FinalidadeImovel,
  Imovel,
  ImovelFoto,
  TipoImovel,
} from "@/types";

const CORRETOR_PUBLIC_COLUMNS =
  "id, user_id, nome, email, telefone, creci, slug, dominio_custom, foto_url, logo_url, site_cor_primaria, site_cor_secundaria, site_favicon_url, site_tarja_cor, site_nome_exibicao, hero_image_url, hero_titulo, hero_subtitulo, sobre, sobre_titulo, sobre_texto, sobre_foto_url, site_sobre_titulo, site_sobre_texto, site_sobre_foto_url, site_creci, site_telefone_vendas, site_telefone_locacao, site_email, site_instagram, site_youtube, site_tiktok, site_linkedin, site_facebook, site_horario, site_endereco, contato_email, contato_telefone, contato_endereco, contato_horario, whatsapp, criado_em, atualizado_em";

async function createSiteReadClient() {
  try {
    return createServiceRoleClient();
  } catch {
    return createClient();
  }
}

export interface ImoveisPublicosFilters {
  tipo?: TipoImovel;
  finalidade?: FinalidadeImovel;
  bairro?: string;
  codigo?: string;
  valorMin?: number;
  valorMax?: number;
}

type ImovelRow = Imovel & {
  imovel_fotos: ImovelFoto[] | null;
};

function mapImovelRow(row: ImovelRow): Imovel {
  const { imovel_fotos, ...rest } = row;
  const fotos = imovel_fotos ?? row.fotos ?? [];

  return {
    ...rest,
    fotos: [...fotos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((foto) => ({
        ...foto,
        url: getImovelFotoPublicUrl(foto.url),
      })),
  };
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

export const getCorretorBySlug = cache(async (slug: string): Promise<Corretor | null> => {
  const supabase = await createSiteReadClient();
  const { data, error } = await supabase
    .from("corretores")
    .select(CORRETOR_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
});

export const getCorretorByDominio = cache(
  async (hostname: string): Promise<Corretor | null> => {
    const supabase = await createSiteReadClient();
    const normalized = normalizeHostname(hostname);
    const candidates = [normalized, `www.${normalized}`];

    for (const dominio of candidates) {
      const { data } = await supabase
        .from("corretores")
        .select(CORRETOR_PUBLIC_COLUMNS)
        .eq("dominio_custom", dominio)
        .maybeSingle();

      if (data) {
        return data;
      }
    }

    return null;
  },
);

export const getImoveisPublicos = cache(
  async (
    corretorId: string,
    filters: ImoveisPublicosFilters = {},
  ): Promise<Imovel[]> => {
    const supabase = await createSiteReadClient();

    let query = supabase
      .from("imoveis")
      .select("*, imovel_fotos(*)")
      .eq("corretor_id", corretorId)
      .eq("publicado_site", true)
      .eq("status", "disponivel")
      .order("atualizado_em", { ascending: false });

    if (filters.tipo) {
      query = query.eq("tipo", filters.tipo);
    }

    if (filters.finalidade) {
      query = query.eq("finalidade", filters.finalidade);
    }

    if (filters.bairro) {
      query = query.ilike("bairro", `%${filters.bairro}%`);
    }

    if (filters.codigo) {
      const codigo = filters.codigo.trim();
      query = query.or(
        `codigo.ilike.%${codigo}%,codigo_personalizado.ilike.%${codigo}%`,
      );
    }

    if (filters.valorMin !== undefined) {
      if (filters.finalidade === "locacao") {
        query = query.gte("valor_locacao", filters.valorMin);
      } else if (filters.finalidade === "venda") {
        query = query.gte("valor_venda", filters.valorMin);
      } else {
        query = query.or(
          `valor_venda.gte.${filters.valorMin},valor_locacao.gte.${filters.valorMin}`,
        );
      }
    }

    if (filters.valorMax !== undefined) {
      if (filters.finalidade === "locacao") {
        query = query.lte("valor_locacao", filters.valorMax);
      } else if (filters.finalidade === "venda") {
        query = query.lte("valor_venda", filters.valorMax);
      } else {
        query = query.or(
          `valor_venda.lte.${filters.valorMax},valor_locacao.lte.${filters.valorMax}`,
        );
      }
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return (data as ImovelRow[]).map(mapImovelRow);
  },
);

export const getImoveisDestaquePublicos = cache(
  async (corretorId: string): Promise<Imovel[]> => {
    const supabase = await createSiteReadClient();

    const { data: destaques, error: destaquesError } = await supabase
      .from("imoveis")
      .select("*, imovel_fotos(*)")
      .eq("corretor_id", corretorId)
      .eq("publicado_site", true)
      .eq("destaque_site", true)
      .eq("status", "disponivel")
      .order("atualizado_em", { ascending: false })
      .limit(50);

    if (!destaquesError && destaques && destaques.length > 0) {
      return (destaques as ImovelRow[]).map(mapImovelRow);
    }

    return getImoveisPublicos(corretorId);
  },
);

export const getImovelPublico = cache(
  async (corretorId: string, slug: string): Promise<Imovel | null> => {
    const supabase = await createSiteReadClient();

    const { data, error } = await supabase
      .from("imoveis")
      .select("*, imovel_fotos(*)")
      .eq("corretor_id", corretorId)
      .eq("slug", slug)
      .eq("publicado_site", true)
      .eq("status", "disponivel")
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapImovelRow(data as ImovelRow);
  },
);

export const getBairrosPublicos = cache(async (corretorId: string): Promise<string[]> => {
  const supabase = await createSiteReadClient();

  const { data, error } = await supabase
    .from("imoveis")
    .select("bairro")
    .eq("corretor_id", corretorId)
    .eq("publicado_site", true)
    .eq("status", "disponivel")
    .not("bairro", "is", null);

  if (error || !data) {
    return [];
  }

  const bairros = new Set<string>();

  for (const row of data) {
    if (row.bairro?.trim()) {
      bairros.add(row.bairro.trim());
    }
  }

  return [...bairros].sort((a, b) => a.localeCompare(b, "pt-BR"));
});

export const hasImoveisLocacao = cache(async (corretorId: string): Promise<boolean> => {
  const supabase = await createSiteReadClient();

  const { count, error } = await supabase
    .from("imoveis")
    .select("id", { count: "exact", head: true })
    .eq("corretor_id", corretorId)
    .eq("publicado_site", true)
    .eq("status", "disponivel")
    .eq("finalidade", "locacao");

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
});
