import { cache } from "react";

import { resolveCorretorForUser } from "@/lib/supabase/resolve-corretor";

export const getCorretorForUser = cache(resolveCorretorForUser);

export function getSaudacao(): string {
  const hora = new Date().getHours();

  if (hora >= 5 && hora < 12) {
    return "Bom dia";
  }

  if (hora >= 12 && hora < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}
