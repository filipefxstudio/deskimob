import { cache } from "react";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  mapImovelPublicoRow,
  PUBLIC_IMOVEL_SELECT,
  type ImovelPublico,
} from "@/lib/site/imovel-publico";
import {
  applyImoveisPublicosFilters,
  applyImoveisPublicosOrdenacao,
  PUBLIC_IMOVEIS_PAGE_SIZE,
  type ImoveisPublicosFilters,
} from "@/lib/site/imovel-filters";
import type { Corretor, ImovelFoto } from "@/types";

export type { ImoveisPublicosFilters } from "@/lib/site/imovel-filters";
export type { ImovelPublico } from "@/lib/site/imovel-publico";
export { PUBLIC_IMOVEIS_PAGE_SIZE } from "@/lib/site/imovel-filters";

const CORRETOR_PUBLIC_COLUMNS =
  "id, user_id, nome, email, telefone, creci, slug, dominio_custom, dominio_custom_status, foto_url, logo_url, site_cor_primaria, site_cor_secundaria, site_favicon_url, site_tarja_cor, site_nome_exibicao, hero_image_url, hero_titulo, hero_subtitulo, sobre, sobre_titulo, sobre_texto, sobre_foto_url, site_sobre_titulo, site_sobre_texto, site_sobre_foto_url, site_creci, site_telefone_vendas, site_telefone_locacao, site_email, site_instagram, site_youtube, site_tiktok, site_linkedin, site_facebook, site_horario, site_endereco, site_gtm_id, contato_email, contato_telefone, contato_endereco, contato_horario, whatsapp, criado_em, atualizado_em";

async function createSiteReadClient() {
  try {
    return createServiceRoleClient();
  } catch {
    return createClient();
  }
}

type ImovelPublicoRow = ImovelPublico & {
  imovel_fotos: ImovelFoto[] | null;
};

export interface ImoveisPublicosPaginatedResult {
  imoveis: ImovelPublico[];
  total: number;
  pagina: number;
  pageSize: number;
  totalPaginas: number;
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
  ): Promise<ImovelPublico[]> => {
    const result = await getImoveisPublicosPaginados(corretorId, {
      ...filters,
      pagina: 1,
    }, { pageSize: 10_000 });

    return result.imoveis;
  },
);

export const getImoveisPublicosPaginados = cache(
  async (
    corretorId: string,
    filters: ImoveisPublicosFilters = {},
    options?: { pageSize?: number; excludeIds?: string[] },
  ): Promise<ImoveisPublicosPaginatedResult> => {
    const supabase = await createSiteReadClient();
    const pageSize = options?.pageSize ?? PUBLIC_IMOVEIS_PAGE_SIZE;
    const pagina = filters.pagina && filters.pagina > 0 ? filters.pagina : 1;
    const offset = (pagina - 1) * pageSize;

    let countQuery = supabase
      .from("imoveis")
      .select("id", { count: "exact", head: true })
      .eq("corretor_id", corretorId)
      .eq("publicado_site", true)
      .eq("status", "disponivel");

    countQuery = applyImoveisPublicosFilters(countQuery, filters);

    if (options?.excludeIds?.length) {
      countQuery = countQuery.not("id", "in", `(${options.excludeIds.join(",")})`);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      return { imoveis: [], total: 0, pagina, pageSize, totalPaginas: 0 };
    }

    const total = count ?? 0;
    const totalPaginas = total > 0 ? Math.ceil(total / pageSize) : 0;

    let query = supabase
      .from("imoveis")
      .select(PUBLIC_IMOVEL_SELECT)
      .eq("corretor_id", corretorId)
      .eq("publicado_site", true)
      .eq("status", "disponivel")
      .range(offset, offset + pageSize - 1);

    query = applyImoveisPublicosFilters(query, filters);
    query = applyImoveisPublicosOrdenacao(query, filters);

    if (options?.excludeIds?.length) {
      query = query.not("id", "in", `(${options.excludeIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { imoveis: [], total, pagina, pageSize, totalPaginas };
    }

    return {
      imoveis: (data as unknown as ImovelPublicoRow[]).map(mapImovelPublicoRow),
      total,
      pagina,
      pageSize,
      totalPaginas,
    };
  },
);

export const getImoveisSimilaresPublicos = cache(
  async (
    corretorId: string,
    filters: ImoveisPublicosFilters,
    excludeIds: string[],
    limit = 6,
  ): Promise<ImovelPublico[]> => {
    const supabase = await createSiteReadClient();

    let query = supabase
      .from("imoveis")
      .select(PUBLIC_IMOVEL_SELECT)
      .eq("corretor_id", corretorId)
      .eq("publicado_site", true)
      .eq("status", "disponivel")
      .order("destaque_site", { ascending: false })
      .order("atualizado_em", { ascending: false })
      .limit(limit);

    query = applyImoveisPublicosFilters(query, filters, { skipBairros: true });

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return (data as unknown as ImovelPublicoRow[]).map(mapImovelPublicoRow);
  },
);

export const getImoveisDestaquePublicos = cache(
  async (corretorId: string): Promise<ImovelPublico[]> => {
    const supabase = await createSiteReadClient();

    const { data: destaques, error: destaquesError } = await supabase
      .from("imoveis")
      .select(PUBLIC_IMOVEL_SELECT)
      .eq("corretor_id", corretorId)
      .eq("publicado_site", true)
      .eq("destaque_site", true)
      .eq("status", "disponivel")
      .order("atualizado_em", { ascending: false })
      .limit(50);

    if (!destaquesError && destaques && destaques.length > 0) {
      return (destaques as unknown as ImovelPublicoRow[]).map(mapImovelPublicoRow);
    }

    return getImoveisPublicos(corretorId);
  },
);

export const getImovelPublico = cache(
  async (corretorId: string, slug: string): Promise<ImovelPublico | null> => {
    const supabase = await createSiteReadClient();

    const { data, error } = await supabase
      .from("imoveis")
      .select(PUBLIC_IMOVEL_SELECT)
      .eq("corretor_id", corretorId)
      .eq("slug", slug)
      .eq("publicado_site", true)
      .eq("status", "disponivel")
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return mapImovelPublicoRow(data as unknown as ImovelPublicoRow);
  },
);

export const getCidadesPublicos = cache(async (corretorId: string): Promise<string[]> => {
  const supabase = await createSiteReadClient();

  const { data, error } = await supabase
    .from("imoveis")
    .select("cidade")
    .eq("corretor_id", corretorId)
    .eq("publicado_site", true)
    .eq("status", "disponivel")
    .not("cidade", "is", null);

  if (error || !data) {
    return [];
  }

  const cidades = new Set<string>();

  for (const row of data) {
    if (row.cidade?.trim()) {
      cidades.add(row.cidade.trim());
    }
  }

  return [...cidades].sort((a, b) => a.localeCompare(b, "pt-BR"));
});

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
