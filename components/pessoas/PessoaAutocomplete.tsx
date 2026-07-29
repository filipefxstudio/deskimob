"use client";

import Link from "next/link";
import { Loader2, Mail, Phone, Search, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { AtendimentoAnteriorModal } from "@/components/atendimentos/AtendimentoAnteriorModal";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import {
  avaliarSelecaoPessoaAtendimento,
  avaliarSelecaoPessoaProprietario,
  buscarPessoasAutocomplete,
} from "@/lib/actions/clientes";
import { formatTelefoneBr } from "@/lib/imoveis/telefone";
import { MIN_TELEFONE_BUSCA_AUTOCOMPLETE, contatoInalterado, sanitizeTelefone } from "@/lib/pessoas/duplicate";
import { mensagemPessoaDescartada } from "@/lib/pessoas/messages";
import type { LeadAtivoInfo, PessoaAutocompleteItem } from "@/lib/pessoas/types";
import { cn } from "@/lib/utils";

export type PessoaAutocompleteContext = "atendimento" | "proprietario" | "cliente";

export interface PessoaAutocompleteValues {
  nome: string;
  telefone: string;
  email: string;
  clienteId?: string;
  observacoesExtra?: string;
}

interface PessoaAutocompleteProps {
  context: PessoaAutocompleteContext;
  nome: string;
  telefone: string;
  email: string;
  onNomeChange: (value: string) => void;
  onTelefoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onClienteSelecionado?: (clienteId: string) => void;
  onObservacoesExtra?: (value: string) => void;
  perfilAtualId?: string | null;
  disabled?: boolean;
  telefoneRequired?: boolean;
  nomeRequired?: boolean;
}

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PessoaAutocomplete({
  context,
  nome,
  telefone,
  email,
  onNomeChange,
  onTelefoneChange,
  onEmailChange,
  onClienteSelecionado,
  onObservacoesExtra,
  perfilAtualId,
  disabled,
  telefoneRequired = true,
  nomeRequired = true,
}: PessoaAutocompleteProps) {
  const [resultados, setResultados] = useState<PessoaAutocompleteItem[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [leadIdBloqueio, setLeadIdBloqueio] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isSelecting, startSelect] = useTransition();

  const [modalDescartadoOpen, setModalDescartadoOpen] = useState(false);
  const [pessoaDescartada, setPessoaDescartada] = useState<PessoaAutocompleteItem | null>(null);
  const [atendimentoAnterior, setAtendimentoAnterior] = useState<LeadAtivoInfo | null>(null);

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
    const timer = setTimeout(() => runSearch(telefone, email), 400);
    return () => clearTimeout(timer);
  }, [telefone, email, runSearch]);

  function preencherPessoa(pessoa: PessoaAutocompleteItem, observacao?: string) {
    onNomeChange(pessoa.nome);
    onTelefoneChange(formatTelefoneBr(pessoa.telefone));
    onEmailChange(pessoa.email ?? "");
    onClienteSelecionado?.(pessoa.id);
    if (observacao) {
      onObservacoesExtra?.(observacao);
    }
    setResultados([]);
    setAviso(null);
    setBloqueio(null);
    setLeadIdBloqueio(null);
  }

  function handleSelect(pessoa: PessoaAutocompleteItem) {
    setAviso(null);
    setBloqueio(null);
    setLeadIdBloqueio(null);

    startSelect(async () => {
      if (context === "proprietario") {
        const result = await avaliarSelecaoPessoaProprietario(pessoa.id);
        if (result.tipo === "bloqueado") {
          setBloqueio(result.mensagem ?? "Não foi possível vincular esta pessoa.");
          return;
        }
        preencherPessoa(pessoa);
        return;
      }

      if (context === "cliente") {
        preencherPessoa(pessoa);
        setAviso("Cadastro existente selecionado. Revise os dados antes de salvar.");
        return;
      }

      const result = await avaliarSelecaoPessoaAtendimento(pessoa, perfilAtualId);

      if (result.tipo === "bloqueado") {
        setBloqueio(result.mensagem ?? "Não foi possível usar este cadastro.");
        setLeadIdBloqueio(result.leadId ?? null);
        return;
      }

      if (result.tipo === "descartado" && result.atendimentoAnterior) {
        setPessoaDescartada(pessoa);
        setAtendimentoAnterior(result.atendimentoAnterior);
        setModalDescartadoOpen(true);
        return;
      }

      preencherPessoa(pessoa);
      setAviso("Dados preenchidos a partir do cadastro existente.");
    });
  }

  function confirmarNovoAtendimentoDescartado() {
    if (!pessoaDescartada || !atendimentoAnterior) {
      return;
    }

    const dataDescarte = atendimentoAnterior.descartado_em
      ? new Date(atendimentoAnterior.descartado_em).toLocaleDateString("pt-BR")
      : "data não informada";

    preencherPessoa(
      pessoaDescartada,
      `Atendimento anterior descartado em ${dataDescarte}.`,
    );
    setAviso(mensagemPessoaDescartada());
    setModalDescartadoOpen(false);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pessoa-nome">Nome {nomeRequired ? "*" : ""}</Label>
          <Input
            id="pessoa-nome"
            value={nome}
            onChange={(event) => onNomeChange(event.target.value)}
            required={nomeRequired}
            disabled={disabled}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pessoa-telefone">Telefone {telefoneRequired ? "*" : ""}</Label>
            <TelefoneInput
              id="pessoa-telefone"
              value={telefone}
              onChange={onTelefoneChange}
              required={telefoneRequired}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pessoa-email">E-mail</Label>
            <Input
              id="pessoa-email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        {(isSearching || resultados.length > 0) && !disabled ? (
          <div className="rounded-lg border border-border bg-background shadow-sm">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium text-muted-foreground">
              <Search className="size-4" />
              Resultados encontrados
              {isSearching ? <Loader2 className="size-4 animate-spin" /> : null}
            </div>
            <ul className="divide-y">
              {resultados.map((pessoa) => (
                <li key={pessoa.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                    onClick={() => handleSelect(pessoa)}
                    disabled={isSelecting}
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
              >
                Acessar atendimento existente
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <AtendimentoAnteriorModal
        open={modalDescartadoOpen}
        onOpenChange={setModalDescartadoOpen}
        pessoa={pessoaDescartada}
        atendimentoAnterior={atendimentoAnterior}
        onConfirm={confirmarNovoAtendimentoDescartado}
      />
    </>
  );
}

interface PessoaDuplicidadeAvisoProps {
  telefone: string;
  email: string;
  clienteIdIgnorar?: string;
  leadIdIgnorar?: string;
  originalTelefone?: string;
  originalEmail?: string;
  onDuplicidadeChange?: (duplicado: boolean, mensagem?: string) => void;
  className?: string;
}

export function PessoaDuplicidadeAviso({
  telefone,
  email,
  clienteIdIgnorar,
  leadIdIgnorar,
  originalTelefone,
  originalEmail,
  onDuplicidadeChange,
  className,
}: PessoaDuplicidadeAvisoProps) {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [isChecking, startCheck] = useTransition();
  const onChangeRef = useRef(onDuplicidadeChange);
  onChangeRef.current = onDuplicidadeChange;

  useEffect(() => {
    let cancelled = false;

    if (
      (originalTelefone !== undefined || originalEmail !== undefined) &&
      contatoInalterado(telefone, email, originalTelefone, originalEmail)
    ) {
      setMensagem(null);
      onChangeRef.current?.(false);
      return;
    }

    const timer = setTimeout(() => {
      startCheck(async () => {
        if (
          (originalTelefone !== undefined || originalEmail !== undefined) &&
          contatoInalterado(telefone, email, originalTelefone, originalEmail)
        ) {
          if (!cancelled) {
            setMensagem(null);
            onChangeRef.current?.(false);
          }
          return;
        }

        const { verificarDuplicidadeContatoForm } = await import("@/lib/actions/clientes");
        const result = await verificarDuplicidadeContatoForm({
          telefone,
          email,
          clienteIdIgnorar,
          leadIdIgnorar,
        });

        if (cancelled) {
          return;
        }

        if (result.duplicado) {
          setMensagem(result.mensagem ?? "Contato duplicado.");
          onChangeRef.current?.(true, result.mensagem);
          return;
        }

        setMensagem(null);
        onChangeRef.current?.(false);
      });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [telefone, email, clienteIdIgnorar, leadIdIgnorar, originalTelefone, originalEmail]);

  if (!mensagem && !isChecking) {
    return null;
  }

  return (
    <p className={cn("text-sm text-destructive", className)} role="alert">
      {isChecking ? "Verificando duplicidade..." : mensagem}
    </p>
  );
}
