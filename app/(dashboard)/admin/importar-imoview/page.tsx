import type { Metadata } from "next";

import { ImoviewImportClient } from "@/components/admin/ImoviewImportClient";

export const metadata: Metadata = {
  title: "Importar Imoview | Deskimob",
  description: "Ferramenta interna de migração Imoview → Deskimob",
};

export default function ImportarImoviewPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">Importar Imoview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Migração interna de imóveis a partir do XLS exportado do Imoview.
        </p>
      </div>
      <ImoviewImportClient />
    </div>
  );
}
