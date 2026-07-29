"use client";

import { AbaAtendimentosConfig } from "@/components/configuracoes/AbaAtendimentosConfig";
import { AbaExportarDados } from "@/components/configuracoes/AbaExportarDados";
import { AbaEquipe } from "@/components/configuracoes/AbaEquipe";
import { AbaImoveisConfig } from "@/components/configuracoes/AbaImoveisConfig";
import { AbaPerfil } from "@/components/configuracoes/AbaPerfil";
import { AbaSite } from "@/components/configuracoes/AbaSite";
import { AbaWhatsApp } from "@/components/configuracoes/AbaWhatsApp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const allTabs = ["perfil", "whatsapp", "imoveis", "atendimentos", "equipe", "site", "exportar"] as const;
  type TabValue = (typeof allTabs)[number];
  const tabValues: TabValue[] = ["perfil", "whatsapp", "imoveis", "atendimentos"];
  if (canManageEquipe) {
    tabValues.push("equipe");
  }
  if (isAdmin) {
    tabValues.push("site");
  }
  tabValues.push("exportar");
  const defaultTab = tabValues.includes(initialTab as TabValue) ? initialTab : "perfil";

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
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
        <AbaPerfil
          corretor={corretor}
          isAccountOwner={isAccountOwner}
          nome={usuarioLogado.nome}
          email={usuarioLogado.email}
          telefone={usuarioLogado.telefone}
          fotoUrl={usuarioLogado.fotoUrl}
        />
      </TabsContent>

      <TabsContent value="whatsapp">
        <AbaWhatsApp corretor={corretor} plano={plano} agenteConfig={agenteConfig} />
      </TabsContent>

      <TabsContent value="imoveis">
        <AbaImoveisConfig
          tiposImovel={tiposImovel}
          statusImovel={statusImovel}
          marcaDaguaConfig={marcaDaguaConfig}
          fichaVisitaConfig={fichaVisitaConfig}
          motivosDesativacao={motivosDesativacao}
        />
      </TabsContent>

      <TabsContent value="atendimentos">
        <AbaAtendimentosConfig
          midiasOrigem={midiasOrigem}
          initialConfig={atendimentoConfig}
          initialMotivos={motivosDescarte}
          dashboardConfig={dashboardConfig}
        />
      </TabsContent>

      {canManageEquipe ? (
        <TabsContent value="equipe">
          <AbaEquipe perfis={perfisEquipe} corretor={corretor} isAdmin={isAdmin} />
        </TabsContent>
      ) : null}

      {isAdmin ? (
        <TabsContent value="site">
          <AbaSite corretor={corretor} />
        </TabsContent>
      ) : null}

      <TabsContent value="exportar">
        <AbaExportarDados />
      </TabsContent>
    </Tabs>
  );
}
