import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteLayoutShell } from "@/components/site/SiteLayoutShell";
import { getSiteDefaultDescription, getSiteFavicon, getSitePageTitle } from "@/lib/site/metadata";
import { resolveSiteBasePath } from "@/lib/site/paths";
import { getCorretorByDominio } from "@/lib/site/queries";

export const dynamic = "force-dynamic";

interface CustomDomainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ hostname: string }>;
}

export async function generateMetadata({ params }: CustomDomainLayoutProps): Promise<Metadata> {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));

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

export default async function CustomDomainLayout({ children, params }: CustomDomainLayoutProps) {
  const { hostname } = await params;
  const decodedHostname = decodeURIComponent(hostname);
  const corretor = await getCorretorByDominio(decodedHostname);
  const basePath = await resolveSiteBasePath({
    tenantSlug: corretor?.slug ?? "",
    routeKind: "custom",
    hostname: decodedHostname,
  });

  if (!corretor) {
    notFound();
  }

  return (
    <SiteLayoutShell corretor={corretor} basePath={basePath}>
      {children}
    </SiteLayoutShell>
  );
}
