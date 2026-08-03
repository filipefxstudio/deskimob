"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { indicarImovelComAuditoria } from "@/lib/actions/atendimentos";
import { searchImoveisForLead } from "@/lib/actions/leads";
import { getImovelFotoThumbnailUrl } from "@/lib/imoveis/foto-url";
import { formatCurrency } from "@/lib/site/format";
import type { Imovel, Lead } from "@/types";

interface ImoveisIndicadosTabProps {
  lead: Lead;
  imoveis: Imovel[];
}

type SearchResult = Awaited<ReturnType<typeof searchImoveisForLead>>[number];

export function ImoveisIndicadosTab({ lead, imoveis }: ImoveisIndicadosTabProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();

  function buscar() {
    startTransition(async () => {
      const data = await searchImoveisForLead(busca);
      setResultados(data);
    });
  }

  function indicar(imovelId: string) {
    startTransition(async () => {
      await indicarImovelComAuditoria(lead.id, imovelId);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-primary">Imóveis indicados</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus data-icon="inline-start" />
              Indicar imóvel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Indicar imóvel</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por título, código ou bairro..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <Button type="button" onClick={buscar} disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {resultados.map((imovel) => (
                <li key={imovel.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted"
                    onClick={() => indicar(imovel.id)}
                  >
                    <p className="font-medium">{imovel.titulo ?? imovel.codigo}</p>
                    <p className="text-xs text-muted-foreground">{imovel.bairro}</p>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </div>

      {imoveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum imóvel indicado ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {imoveis.map((imovel) => (
            <ImovelCard key={imovel.id} imovel={imovel} />
          ))}
        </div>
      )}
    </div>
  );
}

function ImovelCard({ imovel }: { imovel: Imovel }) {
  const valor = imovel.valor_venda ?? imovel.valor_locacao;
  const capa = imovel.fotos?.sort((a, b) => a.ordem - b.ordem)[0]?.url;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      {capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getImovelFotoThumbnailUrl(capa)}
          alt=""
          className="h-32 w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-32 items-center justify-center bg-muted text-xs text-muted-foreground">
          Sem foto
        </div>
      )}
      <div className="p-3">
        <p className="font-medium text-primary">{imovel.titulo ?? imovel.codigo}</p>
        <p className="text-xs text-muted-foreground">{imovel.bairro}</p>
        {valor ? (
          <p className="mt-1 text-sm font-semibold">{formatCurrency(valor)}</p>
        ) : null}
      </div>
    </article>
  );
}
