import type { Metadata } from "next";

import { DESKIMOB_PWA_ICON_PATHS } from "@/lib/site/deskimob-pwa";

export const DESKIMOB_FAVICON_ICO_PATH = "/deskimob-favicon.ico";
export const DESKIMOB_FAVICON_PNG_PATH = "/deskimob-favicon.png";
export const DESKIMOB_APPLE_ICON_PATH = DESKIMOB_PWA_ICON_PATHS.appleTouchIcon;

/** Favicon e ícones oficiais do CRM Deskimob (aba, atalho e instalação PWA). */
export const deskimobFaviconMetadata: Metadata["icons"] = {
  icon: [
    { url: DESKIMOB_FAVICON_ICO_PATH, sizes: "32x32", type: "image/x-icon" },
    { url: DESKIMOB_FAVICON_PNG_PATH, sizes: "32x32", type: "image/png" },
    { url: DESKIMOB_PWA_ICON_PATHS.icon192, sizes: "192x192", type: "image/png" },
    { url: DESKIMOB_PWA_ICON_PATHS.icon512, sizes: "512x512", type: "image/png" },
  ],
  shortcut: [{ url: DESKIMOB_FAVICON_ICO_PATH, type: "image/x-icon" }],
  apple: [{ url: DESKIMOB_APPLE_ICON_PATH, sizes: "180x180", type: "image/png" }],
};
