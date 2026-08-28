import { ImovelCardPublico } from "@/components/site/ImovelCardPublico";
import type { Imovel } from "@/types";

interface ImoveisSimilaresSectionProps {
  imoveis: Imovel[];
}

export function ImoveisSimilaresSection({ imoveis }: ImoveisSimilaresSectionProps) {
  if (imoveis.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-border pt-10">
      <h2 className="text-xl font-bold text-primary">Imóveis similares</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Outras opções parecidas com sua busca, inclusive em bairros próximos.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {imoveis.map((imovel) => (
          <ImovelCardPublico key={imovel.id} imovel={imovel} />
        ))}
      </div>
    </section>
  );
}
