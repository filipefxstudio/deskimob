"use client";

import { useEffect } from "react";

import { AbaAtendimentosConfig } from "@/components/configuracoes/AbaAtendimentosConfig";
import { AbaExportarDados } from "@/components/configuracoes/AbaExportarDados";
import { AbaEquipe } from "@/components/configuracoes/AbaEquipe";
import { AbaImoveisConfig } from "@/components/configuracoes/AbaImoveisConfig";
import { AbaPerfil } from "@/components/configuracoes/AbaPerfil";
import { AbaSite } from "@/components/configuracoes/AbaSite";
import { AbaWhatsApp } from "@/components/configuracoes/AbaWhatsApp";
import { DeferredTabPanel } from "@/components/ui/deferred-tab-panel";
import { ConfigTabSkeleton } from "@/components/ui/page-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstantTabs } from "@/hooks/use-instant-tabs";
import type { AgenteConfigPublic } from "@/lib/actions/agente-config";
import type { UsuarioLogadoDisplay } from "@/lib/auth/equipe-access";
import type {
  AtendimentoConfig,
  ConfigFichaVisita,
  Corretor,
  DashboardConfig,
  MarcaDaguaConfig,
  MidiaOrigem,
  MotivoDesativacao,
  MotivoDescarte,
  Perfil,
  PlanoAssinatura,
  StatusImovel,
  TipoImovelCustom,
} from "@/types";

const ALL_TABS = ["perfil", "whatsapp", "imoveis", "atendimentos", "equipe", "site", "exportar"] as const;
type TabValue = (typeof ALL_TABS)[number];

interface ConfiguracoesTabsProps {
  corretor: Corretor;
  isAccountOwner: boolean;
  usuarioLogado: UsuarioLogadoDisplay;
  plano: PlanoAssinatura;
  agenteConfig: AgenteConfigPublic;
  tiposImovel: TipoImovelCustom[];
  midiasOrigem: MidiaOrigem[];
  perfisEquipe: Perfil[];
  statusImovel: StatusImovel[];
  marcaDaguaConfig: MarcaDaguaConfig | null;
  dashboardConfig: DashboardConfig;
  atendimentoConfig: AtendimentoConfig | null;
  fichaVisitaConfig: ConfigFichaVisita | null;
  motivosDescarte: MotivoDescarte[];
  motivosDesativacao: MotivoDesativacao[];
  initialTab?: string;
  canManageEquipe?: boolean;
  isAdmin?: boolean;
}

function resolveDefaultTab(
  initialTab: string,
  allowedTabs: TabValue[],
): TabValue {
  return allowedTabs.includes(initialTab as TabValue) ? (initialTab as TabValue) : "perfil";
}

export function ConfiguracoesTabs({
  corretor,
  isAccountOwner,
  usuarioLogado,
  plano,
  agenteConfig,
  tiposImovel,
  midiasOrigem,
  perfisEquipe,
  statusImovel,
  marcaDaguaConfig,
  dashboardConfig,
  atendimentoConfig,
  fichaVisitaConfig,
  motivosDescarte,
  motivosDesativacao,
  initialTab = "perfil",
  canManageEquipe = false,
  isAdmin = false,
}: ConfiguracoesTabsProps) {
  const allowedTabs: TabValue[] = ["perfil", "whatsapp", "imoveis", "atendimentos"];
  if (canManageEquipe) {
    allowedTabs.push("equipe");
  }
  if (isAdmin) {
    allowedTabs.push("site");
  }
  allowedTabs.push("exportar");

  const defaultTab = resolveDefaultTab(initialTab, allowedTabs);
  const { selectedTab, displayTab, selectTab, isContentPending } =
    useInstantTabs<TabValue>(defaultTab);

  useEffect(() => {
    function syncUrl(tab: TabValue) {
      const params = new URLSearchParams(window.location.search);
      params.set("aba", tab);
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
    }

    syncUrl(selectedTab);
  }, [selectedTab]);

  const skeleton = <ConfigTabSkeleton />;

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => selectTab(value as TabValue)}
      className="w-full"
    >
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="perfil">Meu perfil</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        <TabsTrigger value="imoveis">Imóveis</TabsTrigger>
        <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
        {canManageEquipe ? <TabsTrigger value="equipe">Equipe</TabsTrigger> : null}
        {isAdmin ? <TabsTrigger value="site">Meu site</TabsTrigger> : null}
        <TabsTrigger value="exportar">Exportar meus dados</TabsTrigger>
      </TabsList>

      <TabsContent value="perfil">
        <DeferredTabPanel
          tabId="perfil"
          selectedTab={selectedTab}
          displayTab={displayTab}
          isContentPending={isContentPending}
          skeleton={skeleton}
        >
          <AbaPerfil
            corretor={corretor}
            isAccountOwner={isAccountOwner}
            nome={usuarioLogado.nome}
            email={usuarioLogado.email}
            telefone={usuarioLogado.telefone}
            fotoUrl={usuarioLogado.fotoUrl}
          />
        </DeferredTabPanel>
      </TabsContent>

      <TabsContent value="whatsapp">
        <DeferredTabPanel
          tabId="whatsapp"
          selectedTab={selectedTab}
          displayTab={displayTab}
          isContentPending={isContentPending}
          skeleton={skeleton}
        >
          <AbaWhatsApp corretor={corretor} plano={plano} agenteConfig={agenteConfig} />
        </DeferredTabPanel>
      </TabsContent>

      <TabsContent value="imoveis">
        <DeferredTabPanel
          tabId="imoveis"
          selectedTab={selectedTab}
          displayTab={displayTab}
          isContentPending={isContentPending}
          skeleton={skeleton}
        >
          <AbaImoveisConfig
            tiposImovel={tiposImovel}
            statusImovel={statusImovel}
            marcaDaguaConfig={marcaDaguaConfig}
            fichaVisitaConfig={fichaVisitaConfig}
            motivosDesativacao={motivosDesativacao}
          />
        </DeferredTabPanel>
      </TabsContent>

      <TabsContent value="atendimentos">
        <DeferredTabPanel
          tabId="atendimentos"
          selectedTab={selectedTab}
          displayTab={displayTab}
          isContentPending={isContentPending}
          skeleton={skeleton}
        >
          <AbaAtendimentosConfig
            midiasOrigem={midiasOrigem}
            initialConfig={atendimentoConfig}
            initialMotivos={motivosDescarte}
            dashboardConfig={dashboardConfig}
          />
        </DeferredTabPanel>
      </TabsContent>

      {canManageEquipe ? (
        <TabsContent value="equipe">
          <DeferredTabPanel
            tabId="equipe"
            selectedTab={selectedTab}
            displayTab={displayTab}
            isContentPending={isContentPending}
            skeleton={skeleton}
          >
            <AbaEquipe perfis={perfisEquipe} corretor={corretor} isAdmin={isAdmin} />
          </DeferredTabPanel>
        </TabsContent>
      ) : null}

      {isAdmin ? (
        <TabsContent value="site">
          <DeferredTabPanel
            tabId="site"
            selectedTab={selectedTab}
            displayTab={displayTab}
            isContentPending={isContentPending}
            skeleton={skeleton}
          >
            <AbaSite corretor={corretor} />
          </DeferredTabPanel>
        </TabsContent>
      ) : null}

      <TabsContent value="exportar">
        <DeferredTabPanel
          tabId="exportar"
          selectedTab={selectedTab}
          displayTab={displayTab}
          isContentPending={isContentPending}
          skeleton={skeleton}
        >
          <AbaExportarDados />
        </DeferredTabPanel>
      </TabsContent>
    </Tabs>
  );
}
