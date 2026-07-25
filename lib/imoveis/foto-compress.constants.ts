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
