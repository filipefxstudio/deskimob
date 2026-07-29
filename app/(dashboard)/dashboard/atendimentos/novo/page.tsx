import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { NovoAtendimentoForm } from "@/components/atendimentos/NovoAtendimentoForm";
import { getAtendimentoConfig, getBairrosImoveisCadastrados } from "@/lib/actions/atendimentos";
import { getTiposImovelCustom } from "@/lib/actions/configuracoes";
import { getMidiasOrigem, getPerfisForLeads } from "@/lib/actions/leads";
import { parseNovoAtendimentoPrefill } from "@/lib/atendimentos/novo-prefill";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";

export const metadata: Metadata = {
  title: "Novo atendimento | Deskimob",
  description: "Cadastrar novo atendimento",
};

export default async function NovoAtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    redirect("/login");
  }

  const params = await searchParams;
  const prefill = parseNovoAtendimentoPrefill(params);

  const [midias, perfis, config, tiposImovel, perfilAtual, bairrosCadastrados] = await Promise.all([
    getMidiasOrigem(),
    getPerfisForLeads(),
    getAtendimentoConfig(),
    getTiposImovelCustom(),
    getPerfilForUser(),
    getBairrosImoveisCadastrados(),
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
      <NovoAtendimentoForm
        midias={midias}
        perfis={perfis}
        perfilAtualId={perfilAtual?.id ?? null}
        tiposImovel={tiposImovel}
        faixaValorPercent={config?.faixa_valor_percent ?? 20}
        bairrosCadastrados={bairrosCadastrados}
        prefill={prefill}
      />
    </div>
  );
}
