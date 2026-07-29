import type { CSSProperties } from "react";

import {
  DEFAULT_SITE_COR_PRIMARIA,
  DEFAULT_SITE_COR_SECUNDARIA,
} from "@/lib/constants/site";
import type { Corretor } from "@/types";

type SiteThemeCorretor = Pick<Corretor, "site_cor_primaria" | "site_cor_secundaria">;

export function getSiteCorSecundaria(corretor: SiteThemeCorretor): string {
  return corretor.site_cor_secundaria ?? DEFAULT_SITE_COR_SECUNDARIA;
}

export function getSiteThemeStyle(corretor: SiteThemeCorretor): CSSProperties {
  const corPrimaria = corretor.site_cor_primaria ?? DEFAULT_SITE_COR_PRIMARIA;
  const corSecundaria = getSiteCorSecundaria(corretor);

  return {
    "--primary": corPrimaria,
    "--secondary": corSecundaria,
    "--accent": corSecundaria,
    "--color-primary": corPrimaria,
    "--color-secondary": corSecundaria,
  } as CSSProperties;
}
