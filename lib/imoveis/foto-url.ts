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

const CLOUDINARY_UPLOAD_SEGMENT = "/upload/";

/** URL reduzida para cards e listagens (Cloudinary transform; Supabase sem transform). */
export function getImovelFotoThumbnailUrl(
  storedUrl: string,
  width = 480,
): string {
  const publicUrl = getImovelFotoPublicUrl(storedUrl);
  if (!publicUrl || publicUrl.startsWith("blob:")) {
    return publicUrl;
  }

  if (isCloudinaryImovelFotoUrl(publicUrl)) {
    const uploadIndex = publicUrl.indexOf(CLOUDINARY_UPLOAD_SEGMENT);
    if (uploadIndex === -1) {
      return publicUrl;
    }

    const prefix = publicUrl.slice(0, uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length);
    const suffix = publicUrl.slice(uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length);
    const transform = `w_${width},c_fill,q_auto,f_auto/`;
    if (suffix.startsWith("w_")) {
      return publicUrl;
    }

    return `${prefix}${transform}${suffix}`;
  }

  return publicUrl;
}

export function extractImovelFotoStoragePath(storedUrl: string): string | null {
  return extractStoragePathFromPublicUrl(storedUrl, STORAGE_BUCKET_IMOVEIS);
}
