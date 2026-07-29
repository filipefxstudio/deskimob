import { fetchImobeeMetadata } from "@/lib/imoview/fetch-imobee-metadata";
import { fetchImobeeOgTitle } from "@/lib/imoview/fetch-imobee-title";
import { importPhotosForImovel } from "@/lib/imoview/import-photos";
import { ensureUniqueImovelSlug } from "@/lib/imoview/slug-unique";
import type { ImobeeMetadata } from "@/lib/imoview/types";
import { generateImovelSlug } from "@/lib/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImobeeEnrichmentResult = {
  tituloAtualizado: boolean;
  photosDownloaded: number;
  photosFailed: number;
  photosSkipped: boolean;
  warning?: string;
};

export async function enrichImovelFromImobee(
  admin: SupabaseClient,
  imovelId: string,
  codigo: string,
  cidade: string,
  metadata: ImobeeMetadata,
  corretorId: string,
): Promise<{ titulo: string | null; slug: string | null }> {
  // metadata.titulo da API é o slug da URL, não o título de exibição (Documento L §10.2)
  const urlSlug = metadata.titulo?.trim() ?? "";
  const tituloReal = urlSlug ? await fetchImobeeOgTitle(urlSlug, codigo) : null;

  const updatePayload: Record<string, unknown> = {
    publicado_site: true,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    aceita_financiamento: metadata.aceitaFinanciamento,
    aceita_permuta: metadata.aceitaPermuta,
  };

  let titulo: string | null = null;
  let slug: string | null = null;

  if (tituloReal?.trim()) {
    titulo = tituloReal.trim();
    slug = await ensureUniqueImovelSlug(admin, generateImovelSlug(titulo, cidade), corretorId);
    updatePayload.titulo = titulo;
    updatePayload.slug = slug;
  }

  const { error } = await admin.from("imoveis").update(updatePayload).eq("id", imovelId);

  if (error) {
    throw new Error(`Falha ao enriquecer imóvel ${codigo}: ${error.message}`);
  }

  return { titulo, slug };
}

export async function enrichImovelWithPhotos(
  admin: SupabaseClient,
  imovelId: string,
  codigo: string,
  cidade: string,
  corretorId: string,
): Promise<ImobeeEnrichmentResult> {
  const metadata = await fetchImobeeMetadata(codigo);

  if (!metadata) {
    return {
      tituloAtualizado: false,
      photosDownloaded: 0,
      photosFailed: 0,
      photosSkipped: false,
      warning: "Metadados Imobee indisponíveis.",
    };
  }

  const { titulo } = await enrichImovelFromImobee(
    admin,
    imovelId,
    codigo,
    cidade,
    metadata,
    corretorId,
  );

  const photoResult = await importPhotosForImovel(
    admin,
    imovelId,
    metadata.fotos.map((f) => f.url),
  );

  return {
    tituloAtualizado: Boolean(titulo),
    photosDownloaded: photoResult.downloaded,
    photosFailed: photoResult.failed,
    photosSkipped: photoResult.skipped,
    warning: [
      !titulo ? "og:title não encontrado — título automático mantido." : null,
      photoResult.failed > 0 ? `${photoResult.failed} foto(s) falharam.` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined,
  };
}
