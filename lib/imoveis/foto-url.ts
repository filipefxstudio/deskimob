import { STORAGE_BUCKET_IMOVEIS } from "@/lib/constants/imoveis";
import {
  extractStoragePathFromPublicUrl,
  resolveStoragePublicUrl,
} from "@/lib/supabase/storage-url";

export function isCloudinaryImovelFotoUrl(url: string): boolean {
  return url.includes("res.cloudinary.com/");
}

/** URL pública da foto (Cloudinary ou Supabase Storage legado). */
export function getImovelFotoPublicUrl(storedUrl: string): string {
  if (!storedUrl || storedUrl.startsWith("blob:") || isCloudinaryImovelFotoUrl(storedUrl)) {
    return storedUrl;
  }

  return resolveStoragePublicUrl(storedUrl, STORAGE_BUCKET_IMOVEIS);
}

/** URL exibida no CRM — bucket público, link direto do Supabase (sem proxy autenticado). */
export function getImovelFotoDashboardUrl(storedUrl: string): string {
  return getImovelFotoPublicUrl(storedUrl);
}

export function extractImovelFotoStoragePath(storedUrl: string): string | null {
  return extractStoragePathFromPublicUrl(storedUrl, STORAGE_BUCKET_IMOVEIS);
}
