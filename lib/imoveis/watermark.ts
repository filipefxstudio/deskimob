import type { MarcaDaguaConfig } from "@/types";

async function getSharp() {
  const { default: sharp } = await import("sharp");
  return sharp;
}

const POSITION_MAP: Record<
  string,
  (width: number, height: number, wmWidth: number, wmHeight: number, margin: number) => {
    left: number;
    top: number;
  }
> = {
  centro: (width, height, wmWidth, wmHeight) => ({
    left: Math.round((width - wmWidth) / 2),
    top: Math.round((height - wmHeight) / 2),
  }),
  superior_esquerdo: (_width, _height, _wmWidth, _wmHeight, margin) => ({
    left: margin,
    top: margin,
  }),
  superior_direito: (width, _height, wmWidth, _wmHeight, margin) => ({
    left: width - wmWidth - margin,
    top: margin,
  }),
  inferior_esquerdo: (_width, height, _wmWidth, wmHeight, margin) => ({
    left: margin,
    top: height - wmHeight - margin,
  }),
  inferior_direito: (width, height, wmWidth, wmHeight, margin) => ({
    left: width - wmWidth - margin,
    top: height - wmHeight - margin,
  }),
};

export async function applyWatermark(
  imageBuffer: Buffer,
  config: Pick<MarcaDaguaConfig, "tamanho_percent" | "opacidade_percent" | "posicao">,
  logoBuffer: Buffer,
): Promise<Buffer> {
  const sharp = await getSharp();
  const image = sharp(imageBuffer);
  const { width = 800, height = 600 } = await image.metadata();

  const logoWidth = Math.round(width * (config.tamanho_percent / 100));
  const { data, info } = await sharp(logoBuffer)
    .resize({ width: logoWidth })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const opacityFactor = config.opacidade_percent / 100;
  for (let index = 3; index < data.length; index += 4) {
    data[index] = Math.round(data[index] * opacityFactor);
  }

  const watermarkBuffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  const wmWidth = info.width;
  const wmHeight = info.height;
  const margin = Math.round(width * 0.02);
  const getPosition = POSITION_MAP[config.posicao] ?? POSITION_MAP.inferior_direito;
  const { left, top } = getPosition(width, height, wmWidth, wmHeight, margin);

  return image
    .composite([{ input: watermarkBuffer, left, top }])
    .jpeg({ quality: 85 })
    .toBuffer();
}
