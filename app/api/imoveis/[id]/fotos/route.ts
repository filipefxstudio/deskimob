import { uploadImovelFotos } from "@/lib/actions/imoveis";
import { FOTO_UPLOAD_PAYLOAD_LIMIT_MESSAGE } from "@/lib/imoveis/foto-compress";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: imovelId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (message.includes("exceeded") || message.includes("too large")) {
      return Response.json({ error: FOTO_UPLOAD_PAYLOAD_LIMIT_MESSAGE }, { status: 413 });
    }

    return Response.json({ error: "Não foi possível ler o envio das fotos." }, { status: 400 });
  }

  const result = await uploadImovelFotos(imovelId, formData);

  if (result.error) {
    return Response.json(result, { status: 400 });
  }

  return Response.json(result);
}
