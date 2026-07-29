import { IMOVIEW_FETCH_RETRY } from "@/lib/imoview/constants";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    retryOnStatus?: number[];
  } = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? IMOVIEW_FETCH_RETRY.maxAttempts;
  const delayMs = options.delayMs ?? IMOVIEW_FETCH_RETRY.delayMs;
  const retryOnStatus = options.retryOnStatus ?? [429, 502, 503, 504];

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);

      if (retryOnStatus.includes(response.status) && attempt < maxAttempts - 1) {
        await sleep(delayMs * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(lastError != null ? String(lastError) : "fetch failed");
}
