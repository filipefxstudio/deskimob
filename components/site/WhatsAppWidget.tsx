"use client";

import { Loader2, Send, X } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useSite } from "./SiteProvider";

export function WhatsAppWidget() {
  const { corretor, whatsappChatEnabled } = useSite();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/webhook/chat-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          mensagem: mensagem.trim(),
          corretor_slug: corretor.slug,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        setError(data.error ?? "Não foi possível enviar sua mensagem.");
        return;
      }

      setFeedback(data.message ?? "Mensagem enviada! Retornaremos em breve.");
      setNome("");
      setMensagem("");
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="mb-3 w-[min(100vw-2.5rem,320px)] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-[#25D366] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <WhatsAppIcon className="size-5" />
              <span className="text-sm font-semibold">Chat com o corretor</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setFeedback(null);
              }}
              className="rounded-md p-1 hover:bg-white/15"
              aria-label="Fechar chat"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            {!whatsappChatEnabled ? (
              <p className="text-sm text-muted-foreground">
                Configure o WhatsApp nas configurações.
              </p>
            ) : feedback ? (
              <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                {feedback}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="chat-nome">Seu nome *</Label>
                  <Input
                    id="chat-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    placeholder="Como podemos te chamar?"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="chat-mensagem">Mensagem *</Label>
                  <Textarea
                    id="chat-mensagem"
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    required
                    rows={3}
                    placeholder="Em que posso ajudar?"
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#25D366] text-white hover:bg-[#1da851]"
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Enviar
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Fechar chat" : "Abrir chat"}
        className={cn(
          "inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#1da851]",
        )}
      >
        <WhatsAppIcon className="size-7" />
      </button>
    </div>
  );
}
