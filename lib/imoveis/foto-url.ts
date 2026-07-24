import { STORAGE_BUCKET_IMOVEIS } from "@/lib/constants/imoveis";
import {
  extractStoragePathFromPublicUrl,
  resolveStoragePublicUrl,
} from "@/lib/supabase/storage-url";

/** URL pública do Supabase Storage (site público). */
export function getImovelFotoPublicUrl(storedUrl: string): string {
  return resolveStoragePublicUrl(storedUrl, STORAGE_BUCKET_IMOVEIS);
}

/** URL via proxy autenticado do CRM (funciona mesmo com bucket privado ou Content-Type errado). */
export function getImovelFotoDashboardUrl(storedUrl: string): string {
  if (!storedUrl || storedUrl.startsWith("blob:")) {
    return storedUrl;
  }

  if (storedUrl.startsWith("/api/storage/imoveis-fotos")) {
    return storedUrl;
  }

  const path = extractStoragePathFromPublicUrl(storedUrl, STORAGE_BUCKET_IMOVEIS);

  if (!path) {
    return getImovelFotoPublicUrl(storedUrl);
  }

  return `/api/storage/imoveis-fotos?path=${encodeURIComponent(path)}`;
}

export function extractImovelFotoStoragePath(storedUrl: string): string | null {
  return extractStoragePathFromPublicUrl(storedUrl, STORAGE_BUCKET_IMOVEIS);
}
