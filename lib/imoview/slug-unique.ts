import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureUniqueImovelSlug(
  admin: SupabaseClient,
  baseSlug: string,
  corretorId: string,
): Promise<string> {
  const normalizedBase = baseSlug || "imovel";
  let slug = normalizedBase;
  let counter = 1;

  while (true) {
    const { data } = await admin
      .from("imoveis")
      .select("id")
      .eq("corretor_id", corretorId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    slug = `${normalizedBase}-${counter}`;
    counter += 1;
  }
}

export async function imovelExistsByCodigo(
  admin: SupabaseClient,
  codigo: string,
  corretorId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("imoveis")
    .select("id")
    .eq("corretor_id", corretorId)
    .eq("codigo", codigo)
    .maybeSingle();

  return data?.id ?? null;
}
