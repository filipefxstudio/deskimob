import { STORAGE_BUCKET_IMOVEIS } from "@/lib/constants/imoveis";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";

function guessContentType(path: string, buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return "image/png";
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path")?.trim();

  if (!path) {
    return Response.json({ error: "Caminho da foto inválido." }, { status: 400 });
  }

  if (path.includes("..")) {
    return Response.json({ error: "Caminho da foto inválido." }, { status: 400 });
  }

  const corretor = await getCorretorForUser();

  if (!corretor) {
    return Response.json({ error: "Sessão expirada." }, { status: 401 });
  }

  if (!path.startsWith(`${corretor.id}/`)) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  let admin;

  try {
    admin = createServiceRoleClient();
  } catch {
    return Response.json({ error: "Storage indisponível." }, { status: 503 });
  }

  const { data, error } = await admin.storage.from(STORAGE_BUCKET_IMOVEIS).download(path);

  if (error || !data) {
    console.error("[storage/imoveis-fotos] download failed", { path, error });
    return Response.json({ error: "Foto não encontrada no storage." }, { status: 404 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const contentType = guessContentType(path, buffer);

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
