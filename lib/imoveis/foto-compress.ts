import sharp from "sharp";

import {
  isValidImageBuffer,
  looksLikeUtf8CorruptedBinary,
} from "@/lib/supabase/storage-upload";

export const FOTO_MAX_WIDTH = 1280;
export const FOTO_MAX_HEIGHT = 960;
export const FOTO_MAX_BYTES = 200 * 1024;
export const FOTO_MAX_BYTES_LABEL = "200 KB";
export const FOTO_UPLOAD_BATCH_SIZE = 4;

export const FOTO_SIZE_LIMIT_USER_MESSAGE = `O tamanho das imagens ultrapassou o limite permitido (até ${FOTO_MAX_BYTES_LABEL} por foto, dimensão máxima ${FOTO_MAX_WIDTH}×${FOTO_MAX_HEIGHT}). Aguarde a compressão terminar ou envie menos fotos por vez.`;

export const FOTO_UPLOAD_PAYLOAD_LIMIT_MESSAGE = `O envio ultrapassou o limite de tamanho do servidor. As fotos são comprimidas para até ${FOTO_MAX_BYTES_LABEL} cada — aguarde a compressão e salve novamente com menos fotos por lote.`;

export const FOTO_COMPRESS_CLIENT_OPTIONS = {
  maxSizeMB: FOTO_MAX_BYTES / (1024 * 1024),
  maxWidthOrHeight: FOTO_MAX_WIDTH,
  useWebWorker: true,
  initialQuality: 0.82,
} as const;

export function parseFotoUploadHttpError(status: number, bodyText: string): string | null {
  const lower = bodyText.toLowerCase();

  if (
    status === 413 ||
    lower.includes("body exceeded") ||
    lower.includes("payload too large") ||
    lower.includes("request entity too large") ||
    lower.includes("content too large")
  ) {
    return FOTO_UPLOAD_PAYLOAD_LIMIT_MESSAGE;
  }

  if (status === 504 || status === 502) {
    return "O envio das fotos demorou demais. Tente salvar com menos fotos por vez.";
  }

  return null;
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
}
