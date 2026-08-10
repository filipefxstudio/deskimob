"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDashed, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import {
  connectSiteDominio,
  disconnectSiteDominio,
  getSiteDominioStatus,
  verifySiteDominio,
} from "@/lib/actions/site-domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Corretor, DominioCustomStatus, SiteDominioStatusPayload } from "@/types";

interface SiteDominioAssistenteProps {
  corretor: Corretor;
  automationEnabled: boolean;
}

const STATUS_LABEL: Record<DominioCustomStatus, string> = {
  none: "Não configurado",
  pending_dns: "Aguardando DNS",
  active: "Ativo",
  error: "Erro",
};

function StatusBadge({ status }: { status: DominioCustomStatus }) {
  const styles: Record<DominioCustomStatus, string> = {
    none: "bg-muted text-muted-foreground",
    pending_dns: "bg-amber-100 text-amber-900",
    active: "bg-emerald-100 text-emerald-900",
    error: "bg-destructive/10 text-destructive",
  };

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function DnsRecordsTable({ records }: { records: SiteDominioStatusPayload["dnsRecords"] }) {
  if (records.length === 0) {
    return null;
  }

  function copyValue(value: string) {
    void navigator.clipboard.writeText(value);
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Nome</th>
            <th className="px-3 py-2">Valor</th>
            <th className="px-3 py-2" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.type}-${record.name}-${record.value}`} className="border-t">
              <td className="px-3 py-2 font-medium">{record.type}</td>
              <td className="px-3 py-2">{record.name}</td>
              <td className="max-w-[240px] truncate px-3 py-2 font-mono text-xs sm:max-w-none sm:whitespace-normal sm:break-all">
                {record.value}
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => copyValue(record.value)}
                  aria-label={`Copiar valor ${record.type} ${record.name}`}
                >
                  <Copy className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildInitialStatus(corretor: Corretor): SiteDominioStatusPayload {
  return {
    domain: corretor.dominio_custom ?? null,
    status: (corretor.dominio_custom_status ?? "none") as DominioCustomStatus,
    error: corretor.dominio_custom_erro ?? null,
    verified: corretor.dominio_custom_status === "active",
    misconfigured: corretor.dominio_custom_status !== "active",
    dnsRecords: corretor.dominio_custom_verificacao ?? [],
  };
}

export function SiteDominioAssistente({ corretor, automationEnabled }: SiteDominioAssistenteProps) {
  const router = useRouter();
  const [domainInput, setDomainInput] = useState(corretor.dominio_custom ?? "");
  const [status, setStatus] = useState<SiteDominioStatusPayload>(() => buildInitialStatus(corretor));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshStatus = useCallback(() => {
    startTransition(async () => {
      const result = await getSiteDominioStatus();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.status) {
        setStatus(result.status);
      }
    });
  }, []);

  useEffect(() => {
    if (status.status === "pending_dns" && automationEnabled) {
      const timer = window.setInterval(() => {
        refreshStatus();
      }, 20000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [automationEnabled, refreshStatus, status.status]);

  function handleConnect(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await connectSiteDominio(domainInput);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.status) {
        setStatus(result.status);
        setDomainInput(result.status.domain ?? domainInput);
      }
      setFeedback(result.message ?? "Domínio registrado.");
      router.refresh();
    });
  }

  function handleVerify() {
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await verifySiteDominio();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.status) {
        setStatus(result.status);
      }
      setFeedback(result.message ?? "Verificação concluída.");
      router.refresh();
    });
  }

  function handleDisconnect() {
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await disconnectSiteDominio();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.status) {
        setStatus(result.status);
        setDomainInput("");
      }
      setFeedback(result.message ?? "Domínio removido.");
      router.refresh();
    });
  }

  const hasDomain = Boolean(status.domain);
  const publicUrl = status.domain ? `https://${status.domain}` : null;

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Domínio personalizado</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Use seu domínio (ex.: imobiliaria.com.br) no site público. Configure o DNS no Registro.br ou
            no painel do seu provedor.
          </p>
        </div>
        <StatusBadge status={status.status} />
      </div>

      {!automationEnabled ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Ativação automática indisponível no momento. Entre em contato com o suporte para vincular seu
          domínio, ou use o endereço por slug abaixo.
        </p>
      ) : null}

      {hasDomain && publicUrl ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {status.status === "active" ? (
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <CircleDashed className="size-4 text-amber-600" aria-hidden="true" />
          )}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-secondary hover:underline"
          >
            {publicUrl}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : null}

      {automationEnabled ? (
        <form onSubmit={handleConnect} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dominio_custom">Seu domínio</Label>
            <Input
              id="dominio_custom"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              placeholder="imobiliaria.com.br"
              autoComplete="off"
              spellCheck={false}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isPending || !domainInput.trim()}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {hasDomain ? "Atualizar domínio" : "Conectar domínio"}
            </Button>

            {hasDomain ? (
              <>
                <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleVerify}>
                  <RefreshCw className={cn("mr-1 size-4", isPending && "animate-spin")} />
                  Verificar DNS
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={handleDisconnect}
                >
                  Remover
                </Button>
              </>
            ) : null}
          </div>
        </form>
      ) : null}

      {status.status === "pending_dns" && status.dnsRecords.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Registros DNS</p>
          <p className="text-xs text-muted-foreground">
            Adicione estes registros no painel do seu domínio. A propagação pode levar até 48 horas.
          </p>
          <DnsRecordsTable records={status.dnsRecords} />
        </div>
      ) : null}

      {status.status === "error" && status.error ? (
        <p className="text-sm text-destructive" role="alert">
          {status.error}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {feedback ? (
        <p className="text-sm text-secondary" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
