import { resolveSiteHostContext } from "@/lib/site/host";

export type { ImoveisPublicosFilters } from "@/lib/site/imovel-filters";
export {
  buildImoveisSearchParams,
  parseImoveisSearchParams,
  PUBLIC_IMOVEIS_PAGE_SIZE,
} from "@/lib/site/filters";
export async function resolveSiteBasePath(options: {
  tenantSlug: string;
  routeKind: "slug" | "custom";
  hostname?: string;
}): Promise<string> {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const ctx = resolveSiteHostContext(host);

  if (options.routeKind === "custom") {
    if (ctx.isCustomDomain) {
      return "";
    }

    return `/site-custom/${options.hostname ?? ctx.hostname}`;
  }

  if (ctx.isSubdomain || ctx.isCustomDomain) {
    return "";
  }

  return `/${options.tenantSlug}`;
}

export function sitePath(basePath: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!basePath) {
    return normalizedPath;
  }

  if (normalizedPath === "/") {
    return basePath;
  }

  return `${basePath}${normalizedPath}`;
}
