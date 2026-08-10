import { assertVercelConfigured, VercelApiError } from "@/lib/vercel/config";

type VercelQuery = Record<string, string | undefined>;

async function parseVercelError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string }; message?: string };
    return body.error?.message ?? body.message ?? `Erro Vercel (${response.status})`;
  } catch {
    return `Erro Vercel (${response.status})`;
  }
}

export async function vercelFetch<T>(
  path: string,
  init?: RequestInit & { query?: VercelQuery },
): Promise<T> {
  const { token, teamId } = assertVercelConfigured();
  const url = new URL(`https://api.vercel.com${path}`);

  if (teamId) {
    url.searchParams.set("teamId", teamId);
  }

  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseVercelError(response);
    throw new VercelApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
