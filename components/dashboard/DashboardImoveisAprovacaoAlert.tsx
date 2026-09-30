import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DashboardImoveisAprovacaoAlertProps {
  count: number;
}

export function DashboardImoveisAprovacaoAlert({
  count,
}: DashboardImoveisAprovacaoAlertProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-brand" />
        <div>
          <p className="font-medium text-foreground">
            {count} {count === 1 ? "imóvel" : "imóveis"} aguardando aprovação
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise os cadastros pendentes antes de publicar no site e portais.
          </p>
        </div>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard/imoveis?status=aguardando_aprovacao">Ver imóveis</Link>
      </Button>
    </div>
  );
}
