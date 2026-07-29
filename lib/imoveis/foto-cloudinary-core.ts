import { v2 as cloudinary } from "cloudinary";

import { STORAGE_BUCKET_IMOVEIS } from "@/lib/constants/imoveis";
import { extractImovelFotoStoragePath } from "@/lib/imoveis/foto-url";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export interface ImovelFotoStorageRef {
  url: string;
  cloudinary_public_id?: string | null;
}

function ensureCloudinaryConfigured(): void {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function getCloudinaryUploadPreset(): string {
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim();

  if (!preset) {
    throw new Error("CLOUDINARY_UPLOAD_PRESET is not configured.");
  }

  return preset;
}

function assertCloudinaryConfigured(): void {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    !process.env.CLOUDINARY_API_KEY?.trim() ||
    !process.env.CLOUDINARY_API_SECRET?.trim()
  ) {
    throw new Error("Cloudinary credentials are not configured.");
  }
}

export async function uploadFotoImovel(
  fileBuffer: Buffer,
  corretorId: string,
  imovelId: string,
  contentType = "image/jpeg",
): Promise<{ url: string; publicId: string }> {
  assertCloudinaryConfigured();
  ensureCloudinaryConfigured();

  const result = await cloudinary.uploader.upload(
    `data:${contentType};base64,${fileBuffer.toString("base64")}`,
    {
      upload_preset: getCloudinaryUploadPreset(),
      folder: `deskimob/${corretorId}/${imovelId}`,
      resource_type: "image",
    },
  );

  if (!result.secure_url || !result.public_id) {
    throw new Error("Cloudinary upload returned an incomplete response.");
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function destroyCloudinaryPublicId(publicId: string): Promise<void> {
  assertCloudinaryConfigured();
  ensureCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId);
}

export async function removeImovelFotosFromStorage(fotos: ImovelFotoStorageRef[]): Promise<void> {
  if (fotos.length === 0) {
    return;
  }

  const cloudinaryIds = fotos
    .map((foto) => foto.cloudinary_public_id?.trim())
    .filter((publicId): publicId is string => Boolean(publicId));

  for (const publicId of cloudinaryIds) {
    try {
      await destroyCloudinaryPublicId(publicId);
    } catch (error) {
      console.error("[removeImovelFotosFromStorage] cloudinary destroy failed", {
        publicId,
        error,
      });
    }
  }

  const storagePaths = fotos
    .filter((foto) => !foto.cloudinary_public_id?.trim())
    .map((foto) => extractImovelFotoStoragePath(foto.url))
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length === 0) {
    return;
  }

  try {
    const admin = createServiceRoleClient();
    await admin.storage.from(STORAGE_BUCKET_IMOVEIS).remove(storagePaths);
  } catch (error) {
    console.error("[removeImovelFotosFromStorage] supabase cleanup failed", error);
  }
}
