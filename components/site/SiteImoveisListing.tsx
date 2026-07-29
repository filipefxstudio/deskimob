import { FiltrosBusca } from "@/components/site/FiltrosBusca";
import { ImoveisSimilaresSection } from "@/components/site/ImoveisSimilaresSection";
import { ImovelCardPublico } from "@/components/site/ImovelCardPublico";
import { SitePagination } from "@/components/site/SitePagination";
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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
        ) : (
          <p className="mt-2 text-muted-foreground">
            {total === 0
              ? "Nenhum resultado"
              : `${total} ${total === 1 ? "resultado" : "resultados"} encontrados`}
            {total > 0 ? ` · exibindo ${inicio}–${fim}` : null}
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <FiltrosBusca
            bairros={bairros}
            cidades={cidades}
            initialValues={mergedFilters}
            layout="sidebar"
            fixedFinalidade={finalidade}
          />
        </aside>

        <div>
          {imoveis.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {imoveis.map((imovel) => (
                  <ImovelCardPublico key={imovel.id} imovel={imovel} />
                ))}
              </div>

              <div className="mt-10">
                <SitePagination
                  filters={mergedFilters}
                  pagina={pagina}
                  totalPaginas={totalPaginas}
                />
              </div>

              <ImoveisSimilaresSection imoveis={similares} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
