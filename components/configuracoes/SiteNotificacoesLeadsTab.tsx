"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  getSiteLeadsNotificacoesConfig,
  saveSiteLeadsNotificacoes,
  testSiteLeadsNotificacaoEmail,
  type SiteLeadsNotificacoesConfig,
} from "@/lib/actions/site-config";
import { API_KEY_MASK } from "@/lib/constants/agente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Corretor } from "@/types";

function FeedbackMessage({ error, message }: { error: string | null; message: string | null }) {
  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  if (message) {
    return (
      <p className="text-sm text-green-600" role="status">
        {message}
      </p>
    );
  }

  return null;
}

function providerLabel(provider: SiteLeadsNotificacoesConfig["provider"]): string {
  switch (provider) {
    case "tenant":
      return "Sua conta Resend";
    case "platform":
      return "Deskimob (plataforma)";
    default:
      return "Não configurado";
  }
}

interface SiteNotificacoesLeadsTabProps {
  corretor: Corretor;
}

export function SiteNotificacoesLeadsTab({ corretor }: SiteNotificacoesLeadsTabProps) {
  const [config, setConfig] = useState<SiteLeadsNotificacoesConfig | null>(null);
  const [leadsEmail, setLeadsEmail] = useState(
    corretor.site_leads_email ??
      corretor.site_email ??
      corretor.contato_email ??
      corretor.email ??
      "",
  );
  const [leadsEmailAtivo, setLeadsEmailAtivo] = useState(corretor.site_leads_email_ativo !== false);
  const [resendFromEmail, setResendFromEmail] = useState(corretor.resend_from_email ?? "");
  const [resendApiKey, setResendApiKey] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTestPending, startTestTransition] = useTransition();

  useEffect(() => {
    void getSiteLeadsNotificacoesConfig().then((result) => {
      if ("error" in result) {
        return;
      }

      setConfig(result);
      setLeadsEmail(result.leadsEmail);
      setLeadsEmailAtivo(result.leadsEmailAtivo);
      setResendFromEmail(result.resendFromEmail);
    });
  }, []);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await saveSiteLeadsNotificacoes({
        site_leads_email: leadsEmail,
        site_leads_email_ativo: leadsEmailAtivo,
        resend_from_email: resendFromEmail,
        resend_api_key: resendApiKey || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setFeedback(result.message ?? "Configurações salvas.");
      setResendApiKey("");

      const updated = await getSiteLeadsNotificacoesConfig();
      if (!("error" in updated)) {
        setConfig(updated);
      }
    });
  }

  function handleTestEmail() {
    setTestFeedback(null);
    setTestError(null);

    startTestTransition(async () => {
      const result = await testSiteLeadsNotificacaoEmail();

      if (result.error) {
        setTestError(result.error);
        return;
      }

      setTestFeedback(result.message ?? "E-mail de teste enviado.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Quando alguém enviar um formulário no site (contato ou interesse em imóvel), o lead entra
          no CRM e, se configurado abaixo, você recebe um e-mail de aviso.
        </p>
        {config ? (
          <p className="mt-2">
            Status do envio:{" "}
            <span className="font-medium text-foreground">{providerLabel(config.provider)}</span>
            {config.canSend ? " — pronto para enviar" : " — complete a configuração abaixo"}
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex items-start gap-3">
          <input
            id="leads-email-ativo"
            type="checkbox"
            checked={leadsEmailAtivo}
            onChange={(event) => setLeadsEmailAtivo(event.target.checked)}
            className="mt-1"
          />
          <div className="space-y-1">
            <Label htmlFor="leads-email-ativo">Receber notificações por e-mail</Label>
            <p className="text-xs text-muted-foreground">
              Desmarque se preferir acompanhar apenas pelo CRM (Atendimentos).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="leads-email">E-mail para receber os leads</Label>
          <Input
            id="leads-email"
            type="email"
            value={leadsEmail}
            onChange={(event) => setLeadsEmail(event.target.value)}
            placeholder="comercial@suaimobiliaria.com.br"
            disabled={!leadsEmailAtivo}
          />
          <p className="text-xs text-muted-foreground">
            Pode ser diferente do e-mail exibido na página Contato do site.
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
          <div>
            <p className="text-sm font-medium">Envio de e-mails (Resend) — opcional</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Para receber avisos sem depender do suporte Deskimob, crie uma conta gratuita em{" "}
              <a
                href="https://resend.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                resend.com
              </a>
              , verifique seu domínio e cole a chave de API abaixo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend-from">E-mail remetente (verificado no Resend)</Label>
            <Input
              id="resend-from"
              type="text"
              value={resendFromEmail}
              onChange={(event) => setResendFromEmail(event.target.value)}
              placeholder="Imobiliária <noreply@seudominio.com.br>"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="resend-key">Chave de API do Resend</Label>
            <Input
              id="resend-key"
              type="password"
              value={resendApiKey}
              onChange={(event) => setResendApiKey(event.target.value)}
              placeholder={config?.hasResendApiKey ? API_KEY_MASK : "re_..."}
              autoComplete="off"
            />
            {config?.hasResendApiKey ? (
              <p className="text-xs text-muted-foreground">
                Já existe uma chave salva. Deixe em branco para mantê-la ou digite uma nova para
                substituir.
              </p>
            ) : null}
          </div>
        </div>

        <FeedbackMessage error={error} message={feedback} />

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Salvar notificações
          </Button>
          <Button type="button" variant="outline" disabled={isTestPending} onClick={handleTestEmail}>
            {isTestPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Enviar e-mail de teste
          </Button>
        </div>
      </form>

      <FeedbackMessage error={testError} message={testFeedback} />
    </div>
  );
}
