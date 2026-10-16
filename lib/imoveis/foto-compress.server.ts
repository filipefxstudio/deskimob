import "server-only";

import {
  FOTO_MAX_BYTES,
  FOTO_MAX_HEIGHT,
  FOTO_MAX_WIDTH,
} from "@/lib/imoveis/foto-compress.constants";
import sharp from "@/lib/imoveis/sharp.server";
import {
  isValidImageBuffer,
  looksLikeUtf8CorruptedBinary,
} from "@/lib/supabase/storage-upload";

/** Aceita buffer já comprimido no navegador quando o Sharp não está disponível. */
const FOTO_SERVER_FALLBACK_MAX_BYTES = 600 * 1024;

function sniffImageContentType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return "image/png";
  }

  if (buffer[0] === 0x47 && buffer[1] === 0x49) {
    return "image/gif";
  }

  return "image/webp";
}

function acceptPrecompressedBuffer(
  buffer: Buffer,
  maxBytes: number,
): { buffer: Buffer; contentType: string } | null {
  if (looksLikeUtf8CorruptedBinary(buffer) || !isValidImageBuffer(buffer)) {
    return null;
  }

  if (buffer.length > maxBytes) {
    return null;
  }

  return { buffer, contentType: sniffImageContentType(buffer) };
}

export async function compressImageBufferForStorage(
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType: string } | { error: string }> {
  if (looksLikeUtf8CorruptedBinary(buffer)) {
    return {
      error: "Arquivo de imagem inválido. Remova a foto e envie o arquivo novamente.",
    };
  }

  if (!isValidImageBuffer(buffer)) {
    return { error: "Formato de imagem não reconhecido. Use JPG, PNG ou WebP." };
  }

  try {
    let quality = 85;
    let result: Buffer | null = null;

    while (quality >= 55) {
      result = await sharp(buffer, { failOn: "error" })
        .rotate()
        .resize({
          width: FOTO_MAX_WIDTH,
          height: FOTO_MAX_HEIGHT,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (result.length <= FOTO_MAX_BYTES) {
        break;
      }

      quality -= 5;
    }

    if (!result || !isValidImageBuffer(result)) {
      return { error: "Não foi possível processar a imagem." };
    }

    if (result.length > FOTO_MAX_BYTES) {
      const meta = await sharp(result).metadata();
      const currentWidth = meta.width ?? FOTO_MAX_WIDTH;
      const currentHeight = meta.height ?? FOTO_MAX_HEIGHT;
      const scale = Math.sqrt(FOTO_MAX_BYTES / result.length) * 0.92;
      const targetWidth = Math.max(640, Math.floor(currentWidth * scale));
      const targetHeight = Math.max(480, Math.floor(currentHeight * scale));

      result = await sharp(buffer, { failOn: "error" })
        .rotate()
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer();
    }

    if (!isValidImageBuffer(result)) {
      return { error: "Não foi possível processar a imagem. Tente outro arquivo." };
    }

    return { buffer: result, contentType: "image/jpeg" };
  } catch (error) {
    console.error("[compressImageBufferForStorage] sharp failed", error);

    const fallback =
      acceptPrecompressedBuffer(buffer, FOTO_SERVER_FALLBACK_MAX_BYTES) ??
      acceptPrecompressedBuffer(buffer, FOTO_MAX_BYTES);

    if (fallback) {
      return fallback;
    }

    return { error: "Não foi possível processar a imagem. Tente outro arquivo." };
  }
}
