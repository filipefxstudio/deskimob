import { IMOBIEE_API_URL, IMOBEE_RATE_LIMIT_MS } from "@/lib/imoview/constants";
import { fetchWithRetry } from "@/lib/imoview/fetch-with-retry";
import type { ImobeeMetadata } from "@/lib/imoview/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchImobeeMetadata(codigo: string): Promise<ImobeeMetadata | null> {
  const body = new URLSearchParams({ codigo, finalidade: "venda" });

  const response = await fetchWithRetry(IMOBIEE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return null;

  const json = (await response.json()) as {
    lista?: Array<{
      titulo?: string;
      latitude?: string | number;
      longitude?: string | number;
      aceitafinanciamento?: boolean | string;
      aceitapermuta?: boolean | string;
      fotos?: Array<{ url?: string; descricao?: string }>;
    }>;
  };

  const item = json.lista?.[0];
  if (!item) return null;

  const parseCoord = (v: string | number | undefined): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const parseBool = (v: boolean | string | undefined): boolean | null => {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean") return v;
    const lower = String(v).toLowerCase();
    if (lower === "sim" || lower === "true" || lower === "1") return true;
    if (lower === "nao" || lower === "não" || lower === "false" || lower === "0") return false;
    return null;
  };

  return {
    titulo: item.titulo ?? "",
    latitude: parseCoord(item.latitude),
    longitude: parseCoord(item.longitude),
    aceitaFinanciamento: parseBool(item.aceitafinanciamento),
    aceitaPermuta: parseBool(item.aceitapermuta),
    fotos: (item.fotos ?? [])
      .filter((f) => f.url)
      .map((f) => ({ url: f.url!, descricao: f.descricao ?? null })),
  };
}

export async function fetchImobeeMetadataBatch(
  codigos: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, ImobeeMetadata>> {
  const result = new Map<string, ImobeeMetadata>();

  for (let i = 0; i < codigos.length; i += 1) {
    const codigo = codigos[i];
    try {
      const meta = await fetchImobeeMetadata(codigo);
      if (meta) result.set(codigo, meta);
    } catch {
      // skip failed
    }
    onProgress?.(i + 1, codigos.length);
    if (i < codigos.length - 1) {
      await sleep(IMOBEE_RATE_LIMIT_MS);
    }
  }

  return result;
}

export async function fetchPhotoContentLength(url: string): Promise<number | null> {
  try {
    const head = await fetchWithRetry(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(10000),
    });

    if (head.ok) {
      const len = head.headers.get("content-length");
      if (len) {
        const bytes = Number.parseInt(len, 10);
        if (Number.isFinite(bytes) && bytes > 0) return bytes;
      }
    }

    const range = await fetchWithRetry(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(10000),
    });

    const contentRange = range.headers.get("content-range");
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) return Number.parseInt(match[1], 10);
    }

    const len = range.headers.get("content-length");
    if (len) return Number.parseInt(len, 10);
  } catch {
    // ignore
  }

  return null;
}
