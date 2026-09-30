"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";

import { testarAgente } from "@/lib/actions/agente-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatTesteAgenteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatTesteAgente({ open, onOpenChange }: ChatTesteAgenteProps) {
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, isPending]);

  useEffect(() => {
    if (!open) {
      setMensagens([]);
      setInput("");
      setError(null);
    }
  }, [open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const texto = input.trim();

    if (!texto || isPending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: texto,
    };

    setMensagens((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);

    startTransition(async () => {
      const result = await testarAgente(texto);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (!result.resposta) {
        setError("O agente não retornou uma resposta.");
        return;
      }

      const resposta = result.resposta;

      setMensagens((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: resposta.texto,
        },
      ]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Testar agente</DialogTitle>
          <DialogDescription>
            Simule uma conversa com o agente usando sua configuração salva.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex min-h-[280px] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        >
          {mensagens.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Envie uma mensagem para testar como o agente responderia a um lead.
            </p>
          ) : null}

          {mensagens.map((mensagem) => (
            <div
              key={mensagem.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                mensagem.role === "user"
                  ? "ml-auto bg-brand text-brand-foreground"
                  : "mr-auto border border-border bg-muted text-foreground",
              )}
            >
              {mensagem.content}
            </div>
          ))}

          {isPending ? (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Agente digitando...
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="px-4 pb-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-border px-4 py-4"
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Digite uma mensagem de teste..."
            disabled={isPending}
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={isPending || !input.trim()}>
            <Send className="size-4" />
            <span className="sr-only">Enviar</span>
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
