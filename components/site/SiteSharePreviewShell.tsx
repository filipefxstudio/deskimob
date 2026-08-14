import type { CSSProperties, ReactNode } from "react";

import { SiteProvider } from "@/components/site/SiteProvider";
import {
  DEFAULT_SITE_COR_PRIMARIA,
  DEFAULT_SITE_COR_SECUNDARIA,
} from "@/lib/constants/site";
import type { Corretor } from "@/types";

interface SiteSharePreviewShellProps {
  corretor: Corretor;
  children: ReactNode;
}

export function SiteSharePreviewShell({ corretor, children }: SiteSharePreviewShellProps) {
  const corPrimaria = corretor.site_cor_primaria ?? DEFAULT_SITE_COR_PRIMARIA;
  const corSecundaria = corretor.site_cor_secundaria ?? DEFAULT_SITE_COR_SECUNDARIA;

  return (
    <SiteProvider corretor={corretor} basePath="" hasImoveisLocacao={false} whatsappChatEnabled={false}>
      <div
        className="min-h-dvh bg-white text-[#2D3748]"
        style={
          {
            "--primary": corPrimaria,
            "--secondary": corSecundaria,
            "--accent": corSecundaria,
            "--color-primary": corPrimaria,
            "--color-secondary": corSecundaria,
          } as CSSProperties
        }
      >
        <main className="min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </SiteProvider>
  );
}
