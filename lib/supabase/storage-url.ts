export function buildStoragePublicUrl(bucket: string, storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

export function extractStoragePathFromPublicUrl(
  url: string,
  bucket: string,
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);

  if (index === -1) {
    return null;
  }

  const rawPath = url.slice(index + marker.length);
  return rawPath
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

/** Rebuild public URL using current NEXT_PUBLIC_SUPABASE_URL (fixes localhost/old project links). */
export function resolveStoragePublicUrl(storedUrl: string, bucket: string): string {
  if (!storedUrl || storedUrl.startsWith("blob:")) {
    return storedUrl;
  }

  const path = extractStoragePathFromPublicUrl(storedUrl, bucket);

  if (!path) {
    return storedUrl;
  }

  try {
    return buildStoragePublicUrl(bucket, path);
  } catch {
    return storedUrl;
  }
}
