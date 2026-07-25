export function getMainDomain(): string {
  return process.env.NEXT_PUBLIC_DOMAIN || "deskimob.com.br";
}

export const RESERVED_APP_PATHS = new Set([
  "api",
  "auth",
  "dashboard",
  "login",
  "cadastro",
  "redefinir-senha",
  "site-custom",
  "preview",
  "_next",
]);

export interface SiteHostContext {
  hostname: string;
  mainDomain: string;
  appDomain: string;
  isLocalhost: boolean;
  isVercelApp: boolean;
  isMainApp: boolean;
  isSubdomain: boolean;
  isCustomDomain: boolean;
  tenantFromSubdomain: string | null;
}

export function parseHostname(hostHeader: string | null | undefined): string {
  return (hostHeader ?? "").split(":")[0].toLowerCase();
}

export function resolveSiteHostContext(hostHeader: string | null | undefined): SiteHostContext {
  const hostname = parseHostname(hostHeader);
  const mainDomain = getMainDomain();
  const appDomain = `app.${mainDomain}`;

  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isVercelApp = hostname.endsWith(".vercel.app");
  const isMainApp =
    isLocalhost ||
    isVercelApp ||
    hostname === appDomain ||
    hostname === mainDomain;

  const isSubdomain =
    !isMainApp &&
    hostname.endsWith(`.${mainDomain}`) &&
    !hostname.startsWith("www.");

  const isCustomDomain = !isMainApp && !isSubdomain && hostname.length > 0;

  const tenantFromSubdomain = isSubdomain
    ? hostname.slice(0, -(`.${mainDomain}`.length))
    : null;

  return {
    hostname,
    mainDomain,
    appDomain,
    isLocalhost,
    isVercelApp,
    isMainApp,
    isSubdomain,
    isCustomDomain,
    tenantFromSubdomain,
  };
}

export function isReservedAppPath(pathname: string): boolean {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment ? RESERVED_APP_PATHS.has(segment) : false;
}

export function isReservedTenantSlug(slug: string): boolean {
  return RESERVED_APP_PATHS.has(slug.toLowerCase());
}
