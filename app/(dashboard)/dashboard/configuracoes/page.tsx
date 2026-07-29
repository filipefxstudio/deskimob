import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfiguracoesTabs } from "@/components/configuracoes/ConfiguracoesTabs";
import { getAgenteConfig, getPlanoCorretor } from "@/lib/actions/agente-config";
import { getConfigFichaVisita } from "@/lib/actions/ficha-visita";
import { getAtendimentoConfig, getMotivosDescarte } from "@/lib/actions/atendimentos";
import { getDashboardConfig } from "@/lib/actions/dashboard-config";
import {
  getMarcaDaguaConfig,
  getMidiasOrigem,
  getMotivosDesativacao,
  getPerfisEquipe,
  getStatusImovelConfig,
  getTiposImovelCustom,
} from "@/lib/actions/configuracoes";
import { getEquipeAccessContext, getUsuarioLogadoDisplay } from "@/lib/auth/equipe-access";
import type { PlanoAssinatura } from "@/types";

export const metadata: Metadata = {
  title: "Configurações | Deskimob",
  description: "Configure perfil, site, WhatsApp e agente de IA",
};

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getEquipeAccessContext();

  if (!ctx) {
    redirect("/login");
  }

  const { corretor, canManageEquipe, isAdmin, isAccountOwner } = ctx;
  const usuario = getUsuarioLogadoDisplay(ctx);

  const params = await searchParams;
  const initialTab = typeof params.aba === "string" ? params.aba : "perfil";

  const [planoResult, agenteConfigResult] = await Promise.all([
    getPlanoCorretor(corretor.id),
    getAgenteConfig(corretor.id),
  ]);

  const plano: PlanoAssinatura =
    typeof planoResult === "string" ? planoResult : "basico";
  const [tiposImovel, midiasOrigem, perfisEquipe, statusImovel, marcaDaguaConfig, dashboardConfig, atendimentoConfig, fichaVisitaConfig, motivosDescarte, motivosDesativacao] =
    await Promise.all([
      getTiposImovelCustom(),
      getMidiasOrigem(),
      getPerfisEquipe(),
      getStatusImovelConfig(),
      getMarcaDaguaConfig(),
      getDashboardConfig(),
      getAtendimentoConfig(),
      getConfigFichaVisita(),
      getMotivosDescarte(),
      getMotivosDesativacao(),
    ]);

  if ("error" in agenteConfigResult || !dashboardConfig) {
    redirect("/login");
  }

  const agenteConfig = agenteConfigResult;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
        <div>
          <h2 className="text-lg font-semibold text-primary">Configurações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seu perfil, site, integrações e agente de IA.
          </p>
        </div>

        <ConfiguracoesTabs
          corretor={corretor}
          isAccountOwner={isAccountOwner}
          usuarioLogado={usuario}
          plano={plano}
          agenteConfig={agenteConfig}
          tiposImovel={tiposImovel}
          midiasOrigem={midiasOrigem}
          perfisEquipe={perfisEquipe}
          statusImovel={statusImovel}
          marcaDaguaConfig={marcaDaguaConfig}
          dashboardConfig={dashboardConfig}
          atendimentoConfig={atendimentoConfig}
          fichaVisitaConfig={fichaVisitaConfig}
          motivosDescarte={motivosDescarte}
          motivosDesativacao={motivosDesativacao}
          initialTab={initialTab}
          canManageEquipe={canManageEquipe}
          isAdmin={isAdmin}
        />
    </div>
  );
}
