import { redirect } from "next/navigation";

import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { createClient } from "@/lib/supabase/server";
import type { Corretor } from "@/types";

/** Exige sessão autenticada; evita redirecionar para /login quando o usuário já está logado. */
export async function getCorretorForDashboardPage(): Promise<
  | { corretor: Corretor }
  | { corretor: null; showUnavailable: true }
  | { corretor: null; showUnavailable: false }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const corretor = await getCorretorForUser();
  if (!corretor) {
    return { corretor: null, showUnavailable: true };
  }

  return { corretor };
}
