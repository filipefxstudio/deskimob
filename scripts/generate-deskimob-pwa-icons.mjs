import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error("Usage: node scripts/generate-deskimob-pwa-icons.mjs <path-to-logo.png>");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public");
const pwaDir = path.join(publicDir, "pwa");
const appDir = path.join(root, "app");

fs.mkdirSync(pwaDir, { recursive: true });

/** Ícone já é quadrado com fundo — preenche o canvas inteiro. */
async function fullBleedPng(size, outPath) {
  await sharp(src).resize(size, size, { fit: "cover", position: "centre" }).png().toFile(outPath);
}

/** Android maskable: mesma arte com leve margem (~88%) sobre fundo laranja da marca. */
async function maskablePng(size, outPath) {
  const inner = Math.round(size * 0.88);
  const logo = await sharp(src)
    .resize(inner, inner, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: "#f18f01",
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
}

async function run() {
  await fullBleedPng(192, path.join(pwaDir, "icon-192.png"));
  await fullBleedPng(512, path.join(pwaDir, "icon-512.png"));
  await maskablePng(512, path.join(pwaDir, "icon-512-maskable.png"));
  await fullBleedPng(180, path.join(publicDir, "apple-touch-icon.png"));
  await fullBleedPng(32, path.join(publicDir, "deskimob-favicon.png"));
  await sharp(path.join(publicDir, "deskimob-favicon.png")).toFile(
    path.join(publicDir, "deskimob-favicon.ico"),
  );
  await fs.promises.copyFile(
    path.join(publicDir, "deskimob-favicon.ico"),
    path.join(publicDir, "favicon.ico"),
  );
  await fullBleedPng(512, path.join(appDir, "icon.png"));
  console.log("Ícones oficiais Deskimob gerados (PWA + favicon).");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
