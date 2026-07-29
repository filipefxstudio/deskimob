import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ImovelDetalhes } from "@/components/imoveis/ImovelDetalhes";
import { getAuditoriaImovel, getImovelDesempenho } from "@/lib/actions/imovel-desempenho";
import { getImovelById, getStatusImovelList } from "@/lib/actions/imoveis";
import { getAlertaRepublicacaoImovel } from "@/lib/imoveis/republicacao-alerta";
import { getCorretorForUser } from "@/lib/supabase/get-corretor";
import { getPerfilForUser } from "@/lib/supabase/get-perfil";

interface ImovelDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ImovelDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const imovel = await getImovelById(id);

  return {
    title: imovel?.titulo
      ? `${imovel.titulo} | Deskimob`
      : "Detalhes do imóvel | Deskimob",
    description: "Visualize os detalhes do imóvel",
  };
}

export default async function ImovelDetailPage({ params }: ImovelDetailPageProps) {
  const corretor = await getCorretorForUser();

  if (!corretor) {
    redirect("/login");
  }

  const { id } = await params;
  const [imovel, statusList, auditoria, desempenho, perfil, alertaRepublicacao] =
    await Promise.all([
    getImovelById(id),
    getStatusImovelList(corretor.id),
    getAuditoriaImovel(id),
    getImovelDesempenho(id),
    getPerfilForUser(),
    getAlertaRepublicacaoImovel(id),
  ]);

  if (!imovel) {
    notFound();
  }

  return (
    <div className="flex-1 p-4 md:p-6">
      <ImovelDetalhes
        imovel={imovel}
        corretorSlug={corretor.slug}
        statusList={statusList}
        auditoria={auditoria}
        desempenho={desempenho}
        perfil={perfil}
        alertaRepublicacao={alertaRepublicacao}
      />
    </div>
  );
}
