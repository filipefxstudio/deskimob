import { STORAGE_BUCKET_IMOVEIS } from "@/lib/constants/imoveis";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

export async function getStorageUsageBytes(): Promise<number> {
  try {
    const admin = createServiceRoleClient();
    let total = 0;
    let offset = 0;

    while (true) {
      const { data, error } = await admin.storage.from(STORAGE_BUCKET_IMOVEIS).list("", {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error || !data || data.length === 0) break;

      for (const item of data) {
        if (item.metadata?.size) {
          total += item.metadata.size;
        }
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return total;
  } catch {
    return 0;
  }
}

export function formatBytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function computePhotoStats(sizes: number[]): {
  avgBytesPerPhoto: number;
  p90BytesPerPhoto: number;
} {
  if (sizes.length === 0) {
    return { avgBytesPerPhoto: 150_000, p90BytesPerPhoto: 250_000 };
  }

  const sum = sizes.reduce((a, b) => a + b, 0);
  return {
    avgBytesPerPhoto: Math.round(sum / sizes.length),
    p90BytesPerPhoto: Math.round(percentile(sizes, 90)),
  };
}

export function stratifiedSample<T>(
  items: T[],
  sampleSize: number,
  keyFn: (item: T) => number,
): T[] {
  if (items.length <= sampleSize) return items;

  const buckets = new Map<number, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  const result: T[] = [];
  const bucketKeys = [...buckets.keys()].sort((a, b) => a - b);
  let remaining = sampleSize;

  for (const key of bucketKeys) {
    const bucket = buckets.get(key) ?? [];
    const take = Math.max(1, Math.round((bucket.length / items.length) * sampleSize));
    const actual = Math.min(take, bucket.length, remaining);
    result.push(...bucket.slice(0, actual));
    remaining -= actual;
    if (remaining <= 0) break;
  }

  return result.slice(0, sampleSize);
}
