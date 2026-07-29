import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ImovelForm } from "@/components/imoveis/ImovelForm";
import { Button } from "@/components/ui/button";
import { getPerfisEquipe } from "@/lib/actions/configuracoes";
import { getImovelById, getStatusImovelList } from "@/lib/actions/imoveis";
import { getAlertaRepublicacaoImovel } from "@/lib/imoveis/republicacao-alerta";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";

interface EditarImovelPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EditarImovelPageProps): Promise<Metadata> {
  const { id } = await params;
  const imovel = await getImovelById(id);

  return {
    title: imovel?.titulo
      ? `Editar ${imovel.titulo} | Deskimob`
      : "Editar imóvel | Deskimob",
    description: "Edite as informações do imóvel",
  };
}

export default async function EditarImovelPage({ params }: EditarImovelPageProps) {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    redirect("/login");
  }

  const { id } = await params;
  const [imovel, statusList, perfis, perfilAtual, alertaRepublicacao] = await Promise.all([
    getImovelById(id),
    getStatusImovelList(corretor.id),
    getPerfisEquipe(),
    getPerfilForUser(),
    getAlertaRepublicacaoImovel(id),
  ]);

  if (!imovel) {
    notFound();
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href={`/dashboard/imoveis/${imovel.id}`}>
              <ArrowLeft data-icon="inline-start" />
              Voltar para detalhes
            </Link>
          </Button>
          <h2 className="text-lg font-semibold text-primary">Editar imóvel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize as informações de {imovel.titulo ?? "seu imóvel"}.
          </p>
        </div>
      </div>

      <ImovelForm
        mode="edit"
        imovel={imovel}
        statusList={statusList}
        perfis={perfis}
        perfilAtualId={perfilAtual?.id ?? null}
        perfil={perfilAtual}
        alertaRepublicacao={alertaRepublicacao}
      />
    </div>
  );
}
