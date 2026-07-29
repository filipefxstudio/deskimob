"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Mail, Phone, Search, User } from "lucide-react";

import { AtendimentoAnteriorModal } from "@/components/atendimentos/AtendimentoAnteriorModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import {
  avaliarSelecaoPessoaAtendimento,
  buscarPessoasAutocomplete,
  verificarContatoNovoAtendimento,
} from "@/lib/actions/clientes";
import { buildNovoAtendimentoUrl } from "@/lib/atendimentos/novo-prefill";
import { formatTelefoneBr } from "@/lib/imoveis/telefone";
import { MIN_TELEFONE_BUSCA_AUTOCOMPLETE, sanitizeTelefone } from "@/lib/pessoas/duplicate";
import { mensagemSelecionarCadastroExistente } from "@/lib/pessoas/messages";
import type { LeadAtivoInfo, PessoaAutocompleteItem } from "@/lib/pessoas/types";
import { cn } from "@/lib/utils";

interface NovoAtendimentoPreCheckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function NovoAtendimentoPreCheckModal({
  open,
  onOpenChange,
}: NovoAtendimentoPreCheckModalProps) {
  const router = useRouter();
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [resultados, setResultados] = useState<PessoaAutocompleteItem[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaAutocompleteItem | null>(null);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [leadIdBloqueio, setLeadIdBloqueio] = useState<string | null>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isPending, startPending] = useTransition();

  const [modalDescartadoOpen, setModalDescartadoOpen] = useState(false);
  const [pessoaDescartada, setPessoaDescartada] = useState<PessoaAutocompleteItem | null>(null);
  const [atendimentoAnterior, setAtendimentoAnterior] = useState<LeadAtivoInfo | null>(null);
  const [prefillPendente, setPrefillPendente] = useState<{
    telefone: string;
    email?: string;
    clienteId?: string;
    nome?: string;
  } | null>(null);

  const resetState = useCallback(() => {
    setTelefone("");
    setEmail("");
    setResultados([]);
    setPessoaSelecionada(null);
    setBloqueio(null);
    setLeadIdBloqueio(null);
    setErroValidacao(null);
    setAviso(null);
    setModalDescartadoOpen(false);
    setPessoaDescartada(null);
    setAtendimentoAnterior(null);
    setPrefillPendente(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const runSearch = useCallback((tel: string, em: string) => {
    const digits = sanitizeTelefone(tel);
    const hasEmail = em.includes("@");

    if (digits.length < MIN_TELEFONE_BUSCA_AUTOCOMPLETE && !hasEmail) {
      setResultados([]);
      return;
    }

    startSearch(async () => {
      const found = await buscarPessoasAutocomplete(tel, em);
      setResultados(found);
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => runSearch(telefone, email), 400);
    return () => clearTimeout(timer);
  }, [telefone, email, runSearch, open]);

  function handleTelefoneChange(value: string) {
    setTelefone(formatTelefoneBr(value));
    setPessoaSelecionada(null);
    setBloqueio(null);
    setLeadIdBloqueio(null);
    setErroValidacao(null);
    setAviso(null);
    setPrefillPendente(null);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    setPessoaSelecionada(null);
    setBloqueio(null);
    setLeadIdBloqueio(null);
    setErroValidacao(null);
    setAviso(null);
    setPrefillPendente(null);
  }

  function navegarComPrefill(prefill: {
    telefone: string;
    email?: string;
    clienteId?: string;
    nome?: string;
  }) {
    onOpenChange(false);
    router.push(buildNovoAtendimentoUrl(prefill));
  }

  function aplicarSelecaoPermitida(pessoa: PessoaAutocompleteItem) {
    setPessoaSelecionada(pessoa);
    setPrefillPendente({
      telefone: formatTelefoneBr(pessoa.telefone),
      email: pessoa.email ?? (email.trim() || undefined),
      clienteId: pessoa.id || undefined,
      nome: pessoa.nome,
    });
    setAviso("Cadastro existente selecionado. Clique em Continuar para preencher o formulário.");
    setResultados([]);
  }

  function processarAvaliacao(
    pessoa: PessoaAutocompleteItem,
    result: Awaited<ReturnType<typeof avaliarSelecaoPessoaAtendimento>>,
  ) {
    if (result.tipo === "bloqueado") {
      setBloqueio(result.mensagem ?? "Não foi possível usar este cadastro.");
      setLeadIdBloqueio(result.leadId ?? null);
      setPessoaSelecionada(null);
      setPrefillPendente(null);
      return;
    }

    if (result.tipo === "descartado" && result.atendimentoAnterior) {
      setPessoaDescartada(pessoa);
      setAtendimentoAnterior(result.atendimentoAnterior);
      setModalDescartadoOpen(true);
      return;
    }

    aplicarSelecaoPermitida(pessoa);
  }

  function handleSelect(pessoa: PessoaAutocompleteItem) {
    setBloqueio(null);
    setLeadIdBloqueio(null);
    setErroValidacao(null);
    setAviso(null);

    startPending(async () => {
      const result = await avaliarSelecaoPessoaAtendimento(pessoa);
      processarAvaliacao(pessoa, result);
    });
  }

  function confirmarNovoAtendimentoDescartado() {
    if (!pessoaDescartada) {
      return;
    }

    setModalDescartadoOpen(false);
    navegarComPrefill({
      telefone: formatTelefoneBr(pessoaDescartada.telefone),
      email: pessoaDescartada.email ?? (email.trim() || undefined),
      clienteId: pessoaDescartada.id || undefined,
      nome: pessoaDescartada.nome,
    });
  }

  function handleContinuar() {
    setErroValidacao(null);

    const telefoneDigits = sanitizeTelefone(telefone);
    if (telefoneDigits.length < 10) {
      setErroValidacao("Informe um telefone válido para continuar.");
      return;
    }

    if (bloqueio) {
      return;
    }

    if (prefillPendente) {
      navegarComPrefill(prefillPendente);
      return;
    }

    if (resultados.length > 0 && !pessoaSelecionada) {
      setErroValidacao(mensagemSelecionarCadastroExistente());
      return;
    }

    startPending(async () => {
      const { sessaoExpirada, pessoa } = await verificarContatoNovoAtendimento(
        telefone,
        email || undefined,
      );

      if (sessaoExpirada) {
        setErroValidacao("Sessão expirada. Faça login novamente.");
        return;
      }

      if (pessoa) {
        setErroValidacao(mensagemSelecionarCadastroExistente());
        const found = await buscarPessoasAutocomplete(telefone, email);
        setResultados(found);
        return;
      }

      navegarComPrefill({
        telefone: formatTelefoneBr(telefone),
        email: email.trim() || undefined,
      });
    });
  }

  const telefoneDigits = sanitizeTelefone(telefone);
  const telefoneInvalido = telefoneDigits.length < 10;
  const precisaSelecionarCadastro =
    resultados.length > 0 && !pessoaSelecionada && !prefillPendente;
  const continuarDisabled =
    isPending || Boolean(bloqueio) || telefoneInvalido || precisaSelecionarCadastro;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo atendimento</DialogTitle>
            <DialogDescription>
              Informe telefone ou e-mail para localizar um cadastro existente ou iniciar um novo atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="precheck-telefone">Telefone *</Label>
              <TelefoneInput
                id="precheck-telefone"
                value={telefone}
                onChange={handleTelefoneChange}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="precheck-email">E-mail</Label>
              <Input
                id="precheck-email"
                type="email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            {(isSearching || resultados.length > 0) && !pessoaSelecionada ? (
              <div className="rounded-lg border border-border bg-background shadow-sm">
                <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium text-muted-foreground">
                  <Search className="size-4" />
                  Resultados encontrados
                  {isSearching ? <Loader2 className="size-4 animate-spin" /> : null}
                </div>
                <ul className="max-h-56 divide-y overflow-y-auto">
                  {resultados.map((pessoa) => (
                    <li key={pessoa.leadId ?? pessoa.id ?? pessoa.telefone}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                        onClick={() => handleSelect(pessoa)}
                        disabled={isPending}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {getInitials(pessoa.nome)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <User className="size-3.5 text-muted-foreground" />
                            {pessoa.nome}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="size-3.5" />
                            {formatTelefoneBr(pessoa.telefone)}
                          </span>
                          {pessoa.email ? (
                            <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Mail className="size-3.5" />
                              {pessoa.email}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-xs font-medium text-primary">
                            → Selecionar esta pessoa
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pessoaSelecionada ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-primary">Cadastro selecionado</p>
                <p className="mt-1 font-medium">{pessoaSelecionada.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTelefoneBr(pessoaSelecionada.telefone)}
                  {pessoaSelecionada.email ? ` · ${pessoaSelecionada.email}` : ""}
                </p>
              </div>
            ) : null}

            {aviso ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {aviso}
              </p>
            ) : null}

            {bloqueio ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <p>{bloqueio}</p>
                {leadIdBloqueio ? (
                  <Link
                    href={`/dashboard/atendimentos/${leadIdBloqueio}`}
                    className="mt-1 inline-block font-medium underline"
                    onClick={() => onOpenChange(false)}
                  >
                    Acessar atendimento existente
                  </Link>
                ) : null}
              </div>
            ) : null}

            {erroValidacao ? (
              <p className="text-sm text-destructive" role="alert">
                {erroValidacao}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleContinuar}
              disabled={continuarDisabled}
              className={cn(isPending && "pointer-events-none")}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AtendimentoAnteriorModal
        open={modalDescartadoOpen}
        onOpenChange={setModalDescartadoOpen}
        pessoa={pessoaDescartada}
        atendimentoAnterior={atendimentoAnterior}
        onConfirm={confirmarNovoAtendimentoDescartado}
        isPending={isPending}
      />
    </>
  );
}
