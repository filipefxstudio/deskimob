import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfiguracoesTabs } from "@/components/configuracoes/ConfiguracoesTabs";
import { getAgenteConfig } from "@/lib/actions/agente-config";
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
import { getEquipeAccessContext } from "@/lib/auth/equipe-access";
import { createClient } from "@/lib/supabase/server";
import type { Assinatura, PlanoAssinatura } from "@/types";

export const metadata: Metadata = {
  title: "Configurações | Deskimob",
  description: "Configure perfil, site, WhatsApp e agente de IA",
};

function obterPlanoAtivo(assinaturas: Assinatura[] | undefined): PlanoAssinatura {
  const ativa = assinaturas?.find((item) => item.status === "ativo");
  return ativa?.plano ?? "basico";
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getEquipeAccessContext();

  if (!ctx) {
    redirect("/login");
  }

  const { corretor, canManageEquipe, isAdmin } = ctx;

  const params = await searchParams;
  const initialTab = typeof params.aba === "string" ? params.aba : "perfil";

  const supabase = await createClient();
  const { data: assinaturas } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("corretor_id", corretor.id);

  const plano = obterPlanoAtivo(assinaturas ?? undefined);
  const agenteConfigResult = await getAgenteConfig(corretor.id);
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
    redirect("/dashboard");
  }

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
          plano={plano}
          agenteConfig={agenteConfigResult}
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
