"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface AtendimentoTabsProps {
  panels: Record<AtendimentoTabId, ReactNode>;
}

export function AtendimentoTabs({ panels }: AtendimentoTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = TAB_ITEMS.find((t) => t.id === tabParam)?.id ?? "dados";

  function setTab(tab: AtendimentoTabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setTab(v as AtendimentoTabId)}>
      <div className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Link
          href="/dashboard/atendimentos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ChevronLeft className="size-4" />
          Voltar para atendimentos
        </Link>

        <div className="md:hidden">
          <Select value={activeTab} onValueChange={(v) => setTab(v as AtendimentoTabId)}>
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
          {panels[tab.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
