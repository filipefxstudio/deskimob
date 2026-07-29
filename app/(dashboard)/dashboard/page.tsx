import type { Metadata } from "next";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { DashboardImoveisAprovacaoAlert } from "@/components/dashboard/DashboardImoveisAprovacaoAlert";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
import { getDashboardDataBothTabs } from "@/lib/actions/dashboard";
import { countImoveisAguardandoAprovacao } from "@/lib/actions/imovel-desempenho";
import { getOnboardingItems } from "@/lib/mock/dashboard";
import { CorretorUnavailableMessage } from "@/components/dashboard/CorretorUnavailableMessage";
import { getEquipeAccessContext, getUsuarioLogadoDisplay } from "@/lib/auth/equipe-access";
import { createClient } from "@/lib/supabase/server";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";
import { podeAprovarImovel } from "@/lib/imoveis/aprovacao";

export const metadata: Metadata = {
  title: "Dashboard | Deskimob",
  description: "Painel do corretor Deskimob",
};

const INITIAL_PERIOD = {
  preset: "mes" as const,
  customStart: "",
  customEnd: "",
};

export default async function DashboardPage() {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    return <CorretorUnavailableMessage />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ctx = await getEquipeAccessContext();
  const nome =
    ctx != null
      ? getUsuarioLogadoDisplay(ctx, user?.email).nome
      : corretor.nome;
  const perfilCompleto = Boolean(corretor.telefone && corretor.creci);
  const onboardingItems = getOnboardingItems({ perfilCompleto });
  const siteHref = corretor.slug ? `/${corretor.slug}` : undefined;

  const { venda, locacao } = await getDashboardDataBothTabs({
    periodPreset: INITIAL_PERIOD.preset,
  });

  const perfil = await getPerfilForUser(corretor.id);
  const imoveisAguardando =
    podeAprovarImovel(perfil) ? await countImoveisAguardandoAprovacao() : 0;

  if (!venda || !locacao) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-6">
        <DashboardGreeting nome={nome} />
        <p className="text-muted-foreground">Não foi possível carregar o dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      <DashboardGreeting nome={nome} />
      <DashboardImoveisAprovacaoAlert count={imoveisAguardando} />
      <OnboardingBanner items={onboardingItems} siteHref={siteHref} />
      <DashboardClient
        statsVenda={venda}
        statsLocacao={locacao}
        initialPeriod={INITIAL_PERIOD}
      />
    </div>
  );
}
