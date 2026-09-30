import type { MetadataRoute } from "next";

import {
  DESKIMOB_PWA_BACKGROUND_COLOR,
  DESKIMOB_PWA_DESCRIPTION,
  DESKIMOB_PWA_ICON_PATHS,
  DESKIMOB_PWA_NAME,
  DESKIMOB_PWA_SHORT_NAME,
  DESKIMOB_PWA_START_URL,
  DESKIMOB_PWA_THEME_COLOR,
} from "@/lib/site/deskimob-pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: DESKIMOB_PWA_NAME,
    short_name: DESKIMOB_PWA_SHORT_NAME,
    description: DESKIMOB_PWA_DESCRIPTION,
    start_url: DESKIMOB_PWA_START_URL,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: DESKIMOB_PWA_BACKGROUND_COLOR,
    theme_color: DESKIMOB_PWA_THEME_COLOR,
    lang: "pt-BR",
    icons: [
      {
        src: DESKIMOB_PWA_ICON_PATHS.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: DESKIMOB_PWA_ICON_PATHS.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: DESKIMOB_PWA_ICON_PATHS.icon512Maskable,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
