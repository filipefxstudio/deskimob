import type { MetadataRoute } from "next";

import {
  DESKIMOB_APPLE_ICON_PATH,
  DESKIMOB_FAVICON_PNG_PATH,
} from "@/lib/site/deskimob-favicon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deskimob — CRM Imobiliário",
    short_name: "Deskimob",
    description: "CRM imobiliário para corretores",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#457B9D",
    icons: [
      {
        src: DESKIMOB_FAVICON_PNG_PATH,
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: DESKIMOB_APPLE_ICON_PATH,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: DESKIMOB_APPLE_ICON_PATH,
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
