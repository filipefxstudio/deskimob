import type { Metadata } from "next";

import { ImoveisListing } from "@/components/imoveis/ImoveisListing";
import { getImoveis, getImoveisWorkflowBadges, getStatusImovelList } from "@/lib/actions/imoveis";
import { CorretorUnavailableMessage } from "@/components/dashboard/CorretorUnavailableMessage";
import {
  getCorretorForDashboardPage,
} from "@/lib/supabase/require-corretor-page";

export const metadata: Metadata = {
  title: "Imóveis | Deskimob",
  description: "Gerencie os imóveis do seu portfólio",
};

export default async function ImoveisPage() {
  const access = await getCorretorForDashboardPage();

  if (!access.corretor) {
    return access.showUnavailable ? <CorretorUnavailableMessage /> : null;
  }

  const { corretor } = access;

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
      />
    </div>
  );
}
