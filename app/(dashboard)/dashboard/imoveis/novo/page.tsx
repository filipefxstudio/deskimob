import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ImovelForm } from "@/components/imoveis/ImovelForm";
import { Button } from "@/components/ui/button";
import { getPerfisEquipe } from "@/lib/actions/configuracoes";
import { getImovelById, getStatusImovelList } from "@/lib/actions/imoveis";
import { isImovelDuplicavel } from "@/lib/imoveis/republicar";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";

export const metadata: Metadata = {
  title: "Novo imóvel | Deskimob",
  description: "Cadastre um novo imóvel no portfólio",
};

export default async function NovoImovelPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicar?: string }>;
}) {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    redirect("/login");
  }

  const params = await searchParams;
  let duplicarSource = null;

  if (params.duplicar) {
    const source = await getImovelById(params.duplicar);
    if (source && isImovelDuplicavel(source.status)) {
      duplicarSource = source;
    }
  }

  const [statusList, perfis, perfilAtual] = await Promise.all([
    getStatusImovelList(corretor.id),
    getPerfisEquipe(),
    getPerfilForUser(),
  ]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
              <Link href="/dashboard/imoveis">
                <ArrowLeft data-icon="inline-start" />
                Voltar para imóveis
              </Link>
            </Button>
            <h2 className="text-lg font-semibold text-primary">
              {duplicarSource ? "Duplicar imóvel" : "Novo imóvel"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {duplicarSource
                ? "Revise os dados copiados, informe o complemento da nova unidade e salve."
                : "Preencha as informações para cadastrar um imóvel no seu portfólio."}
            </p>
          </div>
        </div>

      <ImovelForm
        duplicarSource={duplicarSource}
        statusList={statusList}
        perfis={perfis}
        perfilAtualId={perfilAtual?.id ?? null}
      />
    </div>
  );
}
