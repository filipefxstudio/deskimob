"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeferredTabPanel } from "@/components/ui/deferred-tab-panel";
import {
  TabPanelGridSkeleton,
  TabPanelSkeleton,
} from "@/components/ui/page-skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstantTabs } from "@/hooks/use-instant-tabs";

const TAB_ITEMS = [
  { id: "dados", label: "Detalhes do atendimento" },
  { id: "radar", label: "Radar de imóveis" },
  { id: "selecionados", label: "Imóveis Selecionados" },
  { id: "visitas", label: "Visitas" },
  { id: "propostas", label: "Propostas" },
  { id: "negocio", label: "Negócio fechado" },
  { id: "auditoria", label: "Auditoria" },
] as const;

export type AtendimentoTabId = (typeof TAB_ITEMS)[number]["id"];

function isAtendimentoTabId(value: string | null): value is AtendimentoTabId {
  return TAB_ITEMS.some((tab) => tab.id === value);
}

function atendimentoTabSkeleton(tabId: AtendimentoTabId) {
  if (tabId === "radar" || tabId === "selecionados") {
    return <TabPanelGridSkeleton cards={6} />;
  }

  return <TabPanelSkeleton rows={tabId === "auditoria" ? 8 : 5} />;
}

interface AtendimentoTabsProps {
  panels: Record<AtendimentoTabId, ReactNode>;
}

export function AtendimentoTabs({ panels }: AtendimentoTabsProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = isAtendimentoTabId(tabParam) ? tabParam : "dados";

  const { selectedTab, displayTab, selectTab, isContentPending } =
    useInstantTabs<AtendimentoTabId>(initialTab);

  const syncUrl = useCallback((tab: AtendimentoTabId) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const handleTabChange = useCallback(
    (tab: AtendimentoTabId) => {
      selectTab(tab);
      syncUrl(tab);
    },
    [selectTab, syncUrl],
  );

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get("tab");
      const tab = isAtendimentoTabId(tabFromUrl) ? tabFromUrl : "dados";
      selectTab(tab);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [selectTab]);

  const tabSkeletons = useMemo(
    () =>
      Object.fromEntries(
        TAB_ITEMS.map((tab) => [tab.id, atendimentoTabSkeleton(tab.id)]),
      ) as Record<AtendimentoTabId, ReactNode>,
    [],
  );

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => handleTabChange(value as AtendimentoTabId)}
    >
      <div className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Link
          href="/dashboard/atendimentos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="size-4" />
          Voltar para atendimentos
        </Link>

        <div className="md:hidden">
          <Select
            value={selectedTab}
            onValueChange={(value) => handleTabChange(value as AtendimentoTabId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a aba" />
            </SelectTrigger>
            <SelectContent>
              {TAB_ITEMS.map((tab) => (
                <SelectItem key={tab.id} value={tab.id}>
                  {tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsList className="hidden h-auto w-full flex-wrap justify-start gap-1 md:flex">
          {TAB_ITEMS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {TAB_ITEMS.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-4">
          <DeferredTabPanel
            tabId={tab.id}
            selectedTab={selectedTab}
            displayTab={displayTab}
            isContentPending={isContentPending}
            skeleton={tabSkeletons[tab.id]}
          >
            {panels[tab.id]}
          </DeferredTabPanel>
        </TabsContent>
      ))}
    </Tabs>
  );
}
