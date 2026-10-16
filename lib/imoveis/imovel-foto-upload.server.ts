import "server-only";

import { revalidatePath } from "next/cache";

import { getMarcaDaguaConfigByCorretorId } from "@/lib/actions/configuracoes";

type ImovelActionResult = {
  success?: boolean;
  error?: string;
  imovelId?: string;
};
import { ensureImovelOwnership } from "@/lib/imoveis/ensure-imovel-ownership.server";
import { removeImovelFotosFromStorage, uploadFotoImovel } from "@/lib/imoveis/foto-cloudinary";
import { compressImageBufferForStorage } from "@/lib/imoveis/foto-compress.server";
import { applyWatermark } from "@/lib/imoveis/watermark";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type FotoUploadInput = {
  file: File;
  legenda?: string;
  ordem: number;
};

type FotoUploadMetadata = {
  tempId: string;
  legenda?: string;
  ordem: number;
};

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function processImageBuffer(
  corretorId: string,
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  let processed = await compressImageBufferForStorage(buffer);

  if ("error" in processed) {
    return processed;
  }

  const config = await getMarcaDaguaConfigByCorretorId(corretorId);

  if (config?.logo_url) {
    const logoBuffer = await fetchLogoBuffer(config.logo_url);

    if (logoBuffer) {
      try {
        const watermarked = await applyWatermark(processed.buffer, config, logoBuffer);
        const recompressed = await compressImageBufferForStorage(watermarked);

        if ("error" in recompressed) {
          return recompressed;
        }

        processed = recompressed;
      } catch (error) {
        console.error("[processImageBuffer] watermark failed", error);
      }
    }
  }

  return processed;
}

async function uploadFotosForImovel(
  corretorId: string,
  imovelId: string,
  fotos: FotoUploadInput[],
): Promise<ImovelActionResult | null> {
  if (fotos.length === 0) {
    return null;
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch (error) {
    console.error("[uploadFotosForImovel] service role client failed", error);
    return {
      error: "Upload de fotos indisponível. Verifique a configuração do banco de dados.",
    };
  }

  const sortedFotos = [...fotos].sort((a, b) => a.ordem - b.ordem);

  for (const foto of sortedFotos) {
    const rawBuffer = Buffer.from(await foto.file.arrayBuffer());
    const processed = await processImageBuffer(corretorId, rawBuffer);

    if ("error" in processed) {
      return { error: processed.error };
    }

    let uploadResult: { url: string; publicId: string };

    try {
      uploadResult = await uploadFotoImovel(
        processed.buffer,
        corretorId,
        imovelId,
        processed.contentType,
      );
    } catch (error) {
      console.error("[uploadFotosForImovel] cloudinary upload failed", error);
      return { error: "Não foi possível enviar as fotos. Tente novamente." };
    }

    const { error: fotoInsertError } = await admin.from("imovel_fotos").insert({
      imovel_id: imovelId,
      url: uploadResult.url,
      cloudinary_public_id: uploadResult.publicId,
      ordem: foto.ordem,
      legenda: foto.legenda?.trim() || null,
    });

    if (fotoInsertError) {
      console.error("[uploadFotosForImovel] foto insert failed", fotoInsertError);
      try {
        await removeImovelFotosFromStorage([
          { url: uploadResult.url, cloudinary_public_id: uploadResult.publicId },
        ]);
      } catch (cleanupError) {
        console.error("[uploadFotosForImovel] cloudinary rollback failed", cleanupError);
      }
      return { error: "Não foi possível salvar as fotos do imóvel." };
    }
  }

  return null;
}

export async function uploadImovelFotos(
  imovelId: string,
  formData: FormData,
): Promise<ImovelActionResult> {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const owns = await ensureImovelOwnership(imovelId, corretor.id);

  if (!owns) {
    return { error: "Imóvel não encontrado." };
  }

  const metadataRaw = formData.get("metadata");

  if (!metadataRaw || typeof metadataRaw !== "string") {
    return { error: "Dados das fotos inválidos." };
  }

  let metadata: FotoUploadMetadata[];

  try {
    metadata = JSON.parse(metadataRaw) as FotoUploadMetadata[];
  } catch {
    return { error: "Dados das fotos inválidos." };
  }

  if (!Array.isArray(metadata) || metadata.length === 0) {
    return { success: true, imovelId };
  }

  const fotos: FotoUploadInput[] = [];

  for (const item of metadata) {
    const file = formData.get(`file:${item.tempId}`);

    if (!(file instanceof File) || file.size === 0) {
      continue;
    }

    fotos.push({
      file,
      legenda: item.legenda,
      ordem: item.ordem,
    });
  }

  if (fotos.length === 0) {
    return {
      error:
        "Não foi possível receber os arquivos das fotos. Tente salvar novamente ou envie menos fotos por vez.",
    };
  }

  const uploadResult = await uploadFotosForImovel(corretor.id, imovelId, fotos);

  if (uploadResult?.error) {
    return uploadResult;
  }

  revalidatePath("/dashboard/imoveis");
  revalidatePath(`/dashboard/imoveis/${imovelId}`);

  return { success: true, imovelId };
}
