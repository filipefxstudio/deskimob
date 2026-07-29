import { SiteImoveisListingView } from "@/components/site/SiteImoveisListingView";
import type { ImoveisPublicosFilters } from "@/lib/site/queries";
import {
  getBairrosPublicos,
  getCidadesPublicos,
  getImoveisPublicosPaginados,
  getImoveisSimilaresPublicos,
} from "@/lib/site/queries";
import type { Corretor, FinalidadeImovel } from "@/types";

interface SiteImoveisListingProps {
  corretor: Corretor;
  finalidade?: FinalidadeImovel;
  filters: ImoveisPublicosFilters;
  title: string;
  subtitle?: string;
  emptyMessage?: string;
}

export async function SiteImoveisListing({
  corretor,
  finalidade,
  filters,
  title,
  subtitle,
  emptyMessage = "Nenhum imóvel encontrado com os filtros selecionados.",
}: SiteImoveisListingProps) {
  const mergedFilters: ImoveisPublicosFilters = {
    ...filters,
    finalidade: finalidade ?? filters.finalidade,
  };

  const [resultado, bairros, cidades] = await Promise.all([
    getImoveisPublicosPaginados(corretor.id, mergedFilters),
    getBairrosPublicos(corretor.id),
    getCidadesPublicos(corretor.id),
  ]);

  const { imoveis, total, pagina, totalPaginas } = resultado;

  const similares = await getImoveisSimilaresPublicos(
    corretor.id,
    mergedFilters,
    imoveis.map((imovel) => imovel.id),
  );

  const inicio = total === 0 ? 0 : (pagina - 1) * resultado.pageSize + 1;
  const fim = Math.min(pagina * resultado.pageSize, total);

  return (
    <SiteImoveisListingView
      bairros={bairros}
      cidades={cidades}
      filters={mergedFilters}
      fixedFinalidade={finalidade}
      imoveis={imoveis}
      similares={similares}
      pagina={pagina}
      totalPaginas={totalPaginas}
      title={title}
      subtitle={subtitle}
      emptyMessage={emptyMessage}
      inicio={inicio}
      fim={fim}
      total={total}
    />
  );
}
