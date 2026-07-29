import {
  destroyCloudinaryPublicId,
  uploadFotoImovel,
} from "@/lib/imoveis/foto-cloudinary-core";
import {
  IMOBEE_RATE_LIMIT_MS,
  IMOVIEW_IMPORT_CORRETOR_ID,
} from "@/lib/imoview/constants";
import { fetchWithRetry } from "@/lib/imoview/fetch-with-retry";
import {
  isValidImageBuffer,
  looksLikeUtf8CorruptedBinary,
} from "@/lib/supabase/storage-upload";
import type { SupabaseClient } from "@supabase/supabase-js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function guessContentType(buffer: Buffer, url: string): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  if (
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  const ext = url.split(".").pop()?.toLowerCase().split("?")[0];
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function downloadPhoto(url: string): Promise<Buffer | null> {
  try {
    const response = await fetchWithRetry(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (looksLikeUtf8CorruptedBinary(buffer) || !isValidImageBuffer(buffer)) {
      return null;
    }

    return buffer;
  } catch {
    return null;
  }
}

export async function imovelHasPhotos(
  admin: SupabaseClient,
  imovelId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from("imovel_fotos")
    .select("id", { count: "exact", head: true })
    .eq("imovel_id", imovelId);

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function importPhotosForImovel(
  admin: SupabaseClient,
  imovelId: string,
  photoUrls: string[],
): Promise<{ downloaded: number; failed: number; skipped: boolean }> {
  if (photoUrls.length === 0) {
    return { downloaded: 0, failed: 0, skipped: false };
  }

  if (await imovelHasPhotos(admin, imovelId)) {
    return { downloaded: 0, failed: 0, skipped: true };
  }

  let downloaded = 0;
  let failed = 0;

  for (let ordem = 0; ordem < photoUrls.length; ordem += 1) {
    const url = photoUrls[ordem];
    const buffer = await downloadPhoto(url);

    if (!buffer) {
      failed += 1;
      continue;
    }

    let uploadResult: { url: string; publicId: string };

    try {
      uploadResult = await uploadFotoImovel(
        buffer,
        IMOVIEW_IMPORT_CORRETOR_ID,
        imovelId,
        guessContentType(buffer, url),
      );
    } catch {
      failed += 1;
      continue;
    }

    const { error: insertError } = await admin.from("imovel_fotos").insert({
      imovel_id: imovelId,
      url: uploadResult.url,
      cloudinary_public_id: uploadResult.publicId,
      ordem,
      legenda: null,
    });

    if (insertError) {
      try {
        await destroyCloudinaryPublicId(uploadResult.publicId);
      } catch {
        // ignore cleanup failure
      }
      failed += 1;
    } else {
      downloaded += 1;
    }

    if (ordem < photoUrls.length - 1) {
      await sleep(IMOBEE_RATE_LIMIT_MS);
    }
  }

  return { downloaded, failed, skipped: false };
}
