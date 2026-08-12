import type { Metadata } from "next";

export const DESKIMOB_FAVICON_PATH = "/deskimob-favicon.ico";

export const deskimobFaviconMetadata: Metadata["icons"] = {
  icon: [{ url: DESKIMOB_FAVICON_PATH, type: "image/x-icon" }],
  shortcut: [{ url: DESKIMOB_FAVICON_PATH, type: "image/x-icon" }],
};
