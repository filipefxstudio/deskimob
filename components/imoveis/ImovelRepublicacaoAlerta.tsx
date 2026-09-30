import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { AlertaRepublicacaoImovel } from "@/lib/imoveis/republicacao-alerta";

interface ImovelRepublicacaoAlertaProps {
  alerta: AlertaRepublicacaoImovel;
}

export function ImovelRepublicacaoAlerta({ alerta }: ImovelRepublicacaoAlertaProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-brand/40 bg-brand/5 px-4 py-4 text-foreground shadow-xs"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="text-base font-semibold">Imóvel republicado — conferência necessária</p>
          <p>
            Este cadastro foi criado por republicação. Já existe outro imóvel neste endereço com
            status{" "}
            <strong>{alerta.statusOrigemLabel}</strong> (código #{alerta.imovelOrigemCodigo}).
          </p>
          <p className="font-medium text-foreground">
            Confira endereço, fotos e dados antes de aprovar a publicação.
          </p>
          <Link
            href={`/dashboard/imoveis/${alerta.imovelOrigemId}`}
            className="inline-block font-medium text-brand underline underline-offset-2"
          >
            Ver cadastro anterior
          </Link>
        </div>
      </div>
    </div>
  );
}
