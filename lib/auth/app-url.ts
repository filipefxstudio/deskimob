/** URL base do app (login, callbacks de auth, e-mails). */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_BASE_URL?.replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}
