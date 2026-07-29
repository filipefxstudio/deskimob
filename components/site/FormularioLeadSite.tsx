"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { useSite } from "./SiteProvider";

type PreferenciaContato = "whatsapp" | "telefone" | "email";

interface FormularioLeadSiteProps {
  imovelId?: string;
  submitLabel?: string;
  observacoesPlaceholder?: string;
  showPreferenciaContato?: boolean;
  onSuccess?: () => void;
}

export function FormularioLeadSite({
  imovelId,
  submitLabel = "Enviar mensagem",
  observacoesPlaceholder = "Como podemos ajudar?",
  showPreferenciaContato = false,
  onSuccess,
}: FormularioLeadSiteProps) {
  const { corretor } = useSite();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [preferencia, setPreferencia] = useState<PreferenciaContato>("whatsapp");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/site/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": corretor.slug,
        },
        body: JSON.stringify({
          corretor_id: corretor.id,
          tenant_slug: corretor.slug,
          nome,
          telefone,
          email,
          observacoes,
          imovel_id: imovelId,
          preferencia_contato: showPreferenciaContato ? preferencia : undefined,
          origem: "site",
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        toast({
          variant: "destructive",
          title: "Erro",
          description: data.error ?? "Não foi possível enviar sua mensagem.",
        });
        return;
      }

      const message =
        data.message ?? "Mensagem enviada com sucesso! Entraremos em contato em breve.";
      setSuccessMessage(message);
      toast({ title: "Enviado!", description: message });
      setNome("");
      setTelefone("");
      setEmail("");
      setObservacoes("");
      onSuccess?.();
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha na conexão. Tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        {successMessage}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lead-nome">Nome *</Label>
        <Input
          id="lead-nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          required
          placeholder="Seu nome completo"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-telefone">Telefone *</Label>
        <TelefoneInput
          id="lead-telefone"
          value={telefone}
          onChange={setTelefone}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead-email">E-mail</Label>
        <Input
          id="lead-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu@email.com"
        />
      </div>

      {showPreferenciaContato ? (
        <div className="space-y-2">
          <Label>Preferência de contato</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: "whatsapp", label: "WhatsApp" },
                { value: "telefone", label: "Telefone" },
                { value: "email", label: "E-mail" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPreferencia(item.value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  preferencia === item.value
                    ? "border-transparent text-white"
                    : "border-border bg-white text-[#2D3748] hover:bg-muted",
                )}
                style={
                  preferencia === item.value
                    ? { backgroundColor: "var(--color-secondary)" }
                    : undefined
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="lead-observacoes">Observações</Label>
        <Textarea
          id="lead-observacoes"
          value={observacoes}
          onChange={(event) => setObservacoes(event.target.value)}
          placeholder={observacoesPlaceholder}
          rows={4}
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full text-white hover:opacity-90"
        style={{ backgroundColor: "var(--color-secondary)" }}
      >
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
