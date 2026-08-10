import type { Metadata } from "next";

import { SiteHomeContent } from "@/components/site/SiteHomeContent";
import { getSiteDefaultDescription, getSitePageTitle } from "@/lib/site/metadata";
import { getCorretorByDominio } from "@/lib/site/queries";

interface CustomHomePageProps {
  params: Promise<{ hostname: string }>;
}

export default async function CustomHomePage({ params }: CustomHomePageProps) {
  const { hostname } = await params;
  const decodedHostname = decodeURIComponent(hostname);
  const corretor = await getCorretorByDominio(decodedHostname);

  if (!corretor) {
    return null;
  }

  return <SiteHomeContent corretor={corretor} />;
}

export async function generateMetadata({ params }: CustomHomePageProps): Promise<Metadata> {
  const { hostname } = await params;
  const corretor = await getCorretorByDominio(decodeURIComponent(hostname));

  if (!corretor) {
    return { title: "Site não encontrado" };
  }

  return {
    title: getSitePageTitle(corretor),
    description: getSiteDefaultDescription(corretor),
  };
}
