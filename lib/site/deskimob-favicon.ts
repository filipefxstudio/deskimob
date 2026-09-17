import type { Metadata } from "next";

export const DESKIMOB_FAVICON_ICO_PATH = "/deskimob-favicon.ico";
export const DESKIMOB_FAVICON_PNG_PATH = "/deskimob-favicon.png";
export const DESKIMOB_APPLE_ICON_PATH = "/apple-touch-icon.png";

/** Favicon oficial do CRM Deskimob (login, dashboard, admin). */
export const deskimobFaviconMetadata: Metadata["icons"] = {
  icon: [
    { url: DESKIMOB_FAVICON_ICO_PATH, sizes: "32x32", type: "image/x-icon" },
    { url: DESKIMOB_FAVICON_PNG_PATH, sizes: "32x32", type: "image/png" },
  ],
  shortcut: [{ url: DESKIMOB_FAVICON_ICO_PATH, type: "image/x-icon" }],
  apple: [{ url: DESKIMOB_APPLE_ICON_PATH, sizes: "180x180", type: "image/png" }],
};
