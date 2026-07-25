import { cache } from "react";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import { createClient } from "@/lib/supabase/server";
import type { Corretor } from "@/types";

async function fetchCorretorById(corretorId: string): Promise<Corretor | null> {
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("corretores")
      .select("*")
      .eq("id", corretorId)
      .maybeSingle();

    if (error) {
      console.error("[fetchCorretorById] failed", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[fetchCorretorById] service role unavailable", error);
    return null;
  }
}

export const getCorretorForUser = cache(async (): Promise<Corretor | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: ownerCorretor } = await supabase
    .from("corretores")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (ownerCorretor) {
    return ownerCorretor;
  }

  const perfil = await getPerfilForUser();
  if (!perfil?.corretor_id) {
    return null;
  }

  return fetchCorretorById(perfil.corretor_id);
});

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
