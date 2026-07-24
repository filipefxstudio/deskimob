function normalizeSupabaseBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim().replace(/\/$/, "") ?? "";

  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function buildStoragePublicUrl(bucket: string, storagePath: string): string {
  const base = normalizeSupabaseBaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

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

  if (storedUrl.startsWith("/api/storage/")) {
    return storedUrl;
  }

  let normalized = storedUrl.trim();

  if (
    !normalized.startsWith("http://") &&
    !normalized.startsWith("https://") &&
    normalized.includes("/storage/v1/object/public/")
  ) {
    normalized = `https://${normalized.replace(/^\/+/, "")}`;
  }

  const path = extractStoragePathFromPublicUrl(normalized, bucket);

  if (!path) {
    return normalized.startsWith("http") ? normalized : storedUrl;
  }

  try {
    return buildStoragePublicUrl(bucket, path);
  } catch {
    return normalized.startsWith("http") ? normalized : storedUrl;
  }
}
