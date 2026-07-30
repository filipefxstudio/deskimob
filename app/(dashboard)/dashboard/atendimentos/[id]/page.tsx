import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AtendimentoClient } from "@/components/atendimentos/AtendimentoClient";
import {
  getAtendimentoCompleto,
  getAtendimentoConfig,
  getImoveisRadar,
  getMotivosDescarte,
  podeTransferirAtendimento,
} from "@/lib/actions/atendimentos";
import { getTiposImovelCustom } from "@/lib/actions/configuracoes";
import { getStatusImovelList } from "@/lib/actions/imoveis";
import { getPerfisForLeads } from "@/lib/actions/leads";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";

export const metadata: Metadata = {
  title: "Atendimento | Deskimob",
  description: "Detalhes do atendimento",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AtendimentoDetailPage({ params }: PageProps) {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    redirect("/login");
  }

  const { id } = await params;
  const data = await getAtendimentoCompleto(id);

  if (!data) {
    notFound();
  }

  const { lead, visitas, propostas, negocios, imoveisSelecionados, auditoria } = data;

  const [perfis, imoveisRadar, motivos, podeTransferir, tiposImovel, statusList, perfilAtual, atendimentoConfig] =
    await Promise.all([
    getPerfisForLeads(),
    getImoveisRadar(id),
    getMotivosDescarte(),
    podeTransferirAtendimento(),
    getTiposImovelCustom(),
    getStatusImovelList(corretor.id),
    getPerfilForUser(),
    getAtendimentoConfig(),
  ]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <Link
        href="/dashboard/atendimentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        Voltar para atendimentos
      </Link>

      <AtendimentoClient
        lead={lead}
        perfis={perfis}
        perfilAtualId={perfilAtual?.id ?? null}
        imoveisRadar={imoveisRadar}
        visitas={visitas}
        propostas={propostas}
        negocios={negocios}
        imoveisSelecionados={imoveisSelecionados}
        auditoria={auditoria}
        motivos={motivos}
        podeTransferir={podeTransferir}
        tiposImovel={tiposImovel}
        corretorSlug={corretor.slug}
        statusList={statusList}
        faixaValorPercent={atendimentoConfig?.faixa_valor_percent ?? 20}
      />
    </div>
  );
}
