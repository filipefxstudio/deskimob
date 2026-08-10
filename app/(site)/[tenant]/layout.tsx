import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteLayoutShell } from "@/components/site/SiteLayoutShell";
import { isReservedTenantSlug } from "@/lib/site/host";
import { getSiteDefaultDescription, getSiteFavicon, getSitePageTitle } from "@/lib/site/metadata";
import { resolveSiteBasePath } from "@/lib/site/paths";
import { getCorretorBySlug } from "@/lib/site/queries";

export const dynamic = "force-dynamic";

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({ params }: TenantLayoutProps): Promise<Metadata> {
  const { tenant } = await params;

  if (isReservedTenantSlug(tenant)) {
    return { title: "Site não encontrado" };
  }

  const corretor = await getCorretorBySlug(tenant);

  if (!corretor) {
    return { title: "Site não encontrado" };
  }

  const favicon = getSiteFavicon(corretor);

  return {
    title: getSitePageTitle(corretor),
    description: getSiteDefaultDescription(corretor),
    ...(favicon ? { icons: favicon } : {}),
  };
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenant } = await params;

  if (isReservedTenantSlug(tenant)) {
    notFound();
  }

  const corretor = await getCorretorBySlug(tenant);
  const basePath = await resolveSiteBasePath({ tenantSlug: tenant, routeKind: "slug" });

  if (!corretor) {
    notFound();
  }

  return (
    <SiteLayoutShell corretor={corretor} basePath={basePath}>
      {children}
    </SiteLayoutShell>
  );
}
