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
): Promise<{ titulo: string; slug: string }> {
  let titulo = await fetchImobeeOgTitle(metadata.titulo, codigo);

  if (!titulo?.trim()) {
    titulo = metadata.titulo?.trim() || "";
  }

  const updatePayload: Record<string, unknown> = {
    publicado_site: true,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    aceita_financiamento: metadata.aceitaFinanciamento,
    aceita_permuta: metadata.aceitaPermuta,
  };

  let slug = generateImovelSlug(titulo, cidade);

  if (titulo) {
    updatePayload.titulo = titulo;
    slug = await ensureUniqueImovelSlug(admin, slug);
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

  const { titulo } = await enrichImovelFromImobee(admin, imovelId, codigo, cidade, metadata);

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
    warning:
      photoResult.failed > 0
        ? `${photoResult.failed} foto(s) falharam.`
        : undefined,
  };
}
