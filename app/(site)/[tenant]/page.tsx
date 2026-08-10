import type { Metadata } from "next";

import { SiteHomeContent } from "@/components/site/SiteHomeContent";
import { getSiteDefaultDescription, getSitePageTitle } from "@/lib/site/metadata";
import { getCorretorBySlug } from "@/lib/site/queries";

interface TenantHomePageProps {
  params: Promise<{ tenant: string }>;
}

export default async function TenantHomePage({ params }: TenantHomePageProps) {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);

  if (!corretor) {
    return null;
  }

  return <SiteHomeContent corretor={corretor} />;
}

export async function generateMetadata({ params }: TenantHomePageProps): Promise<Metadata> {
  const { tenant } = await params;
  const corretor = await getCorretorBySlug(tenant);

  if (!corretor) {
    return { title: "Site não encontrado" };
  }

  return {
    title: getSitePageTitle(corretor),
    description: getSiteDefaultDescription(corretor),
  };
}
