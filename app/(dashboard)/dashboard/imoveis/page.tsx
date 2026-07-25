import type { Metadata } from "next";

import { ImoveisListing } from "@/components/imoveis/ImoveisListing";
import { getImoveis, getImoveisWorkflowBadges, getStatusImovelList } from "@/lib/actions/imoveis";import { STATUS_IMOVEL } from "@/lib/constants/imoveis";
import { CorretorUnavailableMessage } from "@/components/dashboard/CorretorUnavailableMessage";
import {
  getCorretorForDashboardPage,
} from "@/lib/supabase/require-corretor-page";
import type { StatusImovelSlug } from "@/types";

export const metadata: Metadata = {
  title: "Imóveis | Deskimob",
  description: "Gerencie os imóveis do seu portfólio",
};

export default async function ImoveisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getCorretorForDashboardPage();

  if (!access.corretor) {
    return access.showUnavailable ? <CorretorUnavailableMessage /> : null;
  }

  const { corretor } = access;

  const params = await searchParams;
  const initialBusca = typeof params.busca === "string" ? params.busca : "";
  const initialBairro = typeof params.bairro === "string" ? params.bairro : "";
  const statusParam = typeof params.status === "string" ? params.status : "";
  const validStatusSlugs = new Set(STATUS_IMOVEL.map((item) => item.value));
  const initialStatusSlug = validStatusSlugs.has(statusParam as StatusImovelSlug)
    ? (statusParam as StatusImovelSlug)
    : undefined;

  const [imoveis, statusList, workflowBadges] = await Promise.all([
    getImoveis(),
    getStatusImovelList(corretor.id),
    getImoveisWorkflowBadges(),
  ]);

  return (
    <div className="flex-1 p-4 md:p-6">
      <ImoveisListing
        imoveis={imoveis}
        corretorSlug={corretor.slug}
        statusList={statusList}
        workflowBadges={workflowBadges}
        initialBusca={initialBusca}
        initialBairro={initialBairro}
        initialStatusSlug={initialStatusSlug}
      />
    </div>
  );
}
