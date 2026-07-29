"use client";

import { Loader2, Plus, Search, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  avaliarSelecaoPessoaProprietario,
  buscarPessoasAutocomplete,
  searchClientes,
  type ClienteSearchResult,
} from "@/lib/actions/clientes";
import { mensagemProprietarioIndisponivel } from "@/lib/pessoas/messages";
import { formatTelefoneBr } from "@/lib/imoveis/telefone";
import { cn } from "@/lib/utils";
import type { ProprietarioFormItem } from "@/lib/imoveis/form";
import type { ImovelFormValues } from "@/lib/validations/imovel";

interface ProprietarioConfirmado extends ProprietarioFormItem {
  pendente?: boolean;
}

interface ProprietarioSectionProps {
  control: Control<ImovelFormValues>;
  setValue: UseFormSetValue<ImovelFormValues>;
  proprietarioIds: string[];
  proprietariosIniciais?: ProprietarioFormItem[];
  disabled?: boolean;
  error?: string;
}

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProprietarioSection({
  control,
  setValue,
  proprietarioIds,
  proprietariosIniciais = [],
  disabled,
  error,
}: ProprietarioSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ClienteSearchResult[]>([]);
  const [confirmados, setConfirmados] = useState<ProprietarioConfirmado[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [addingAnother, setAddingAnother] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [autocompleteNovos, setAutocompleteNovos] = useState<ClienteSearchResult[]>([]);
  const [bloqueioNovo, setBloqueioNovo] = useState<string | null>(null);

  const runSearch = useCallback((query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    startSearch(async () => {
      const found = await searchClientes(query);
      setResults(found);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, runSearch]);

  useEffect(() => {
    if (!showForm) {
      setAutocompleteNovos([]);
      return;
    }

    const digits = novoTelefone.replace(/\D/g, "");
    const hasEmail = novoEmail.includes("@");
    if (digits.length < 8 && !hasEmail) {
      setAutocompleteNovos([]);
      return;
    }

    const timer = setTimeout(async () => {
      const found = await buscarPessoasAutocomplete(novoTelefone, novoEmail);
      setAutocompleteNovos(
        found.map((pessoa) => ({
          id: pessoa.id,
          nome: pessoa.nome,
          telefone: pessoa.telefone,
          email: pessoa.email,
          tipo: "proprietario" as const,
          eh_construtor_investidor: pessoa.eh_construtor_investidor,
          corretor_id: "",
          pode_vincular: true,
        })),
      );
    }, 400);

    return () => clearTimeout(timer);
  }, [showForm, novoTelefone, novoEmail]);

  useEffect(() => {
    if (confirmados.length === 0 && proprietarioIds.length > 0) {
      setConfirmados(
        proprietarioIds.map((id) => {
          const found = proprietariosIniciais.find((item) => item.id === id);
          return found ?? { id, nome: "Proprietário vinculado", telefone: "" };
        }),
      );
    }
  }, [confirmados.length, proprietarioIds, proprietariosIniciais]);

  function syncProprietarios(next: ProprietarioConfirmado[]) {
    setConfirmados(next);
    const ids = next
      .map((item) => item.id)
      .filter((id) => id !== "pendente-novo");
    setValue("proprietario_ids", ids, { shouldValidate: true });
    setValue("cliente_id", ids[0] ?? null, { shouldValidate: true });
  }

  function confirmCliente(cliente: ClienteSearchResult) {
    if (!cliente.pode_vincular) {
      return;
    }

    if (confirmados.some((item) => item.id === cliente.id)) {
      return;
    }

    syncProprietarios([
      ...confirmados,
      { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone },
    ]);
    setValue("proprietario_novo", null);
    setShowForm(false);
    setAddingAnother(false);
    setResults([]);
    setSearchQuery("");
  }

  function removeProprietario(id: string) {
    if (id === "pendente-novo") {
      setValue("proprietario_novo", null);
    }
    syncProprietarios(confirmados.filter((item) => item.id !== id));
  }

  function openNewForm() {
    setShowForm(true);
    setAddingAnother(false);
    setBloqueioNovo(null);
    setNovoTelefone("");
    setNovoEmail("");
    setValue("proprietario_novo", {
      nome: "",
      telefone: "",
      email: "",
      atender_como_lead: false,
      eh_construtor_investidor: false,
    });
  }

  function cancelNewForm() {
    setShowForm(false);
    setValue("proprietario_novo", null);
    setBloqueioNovo(null);
    setAutocompleteNovos([]);
  }

  async function vincularProprietarioExistente(clienteId: string) {
    const result = await avaliarSelecaoPessoaProprietario(clienteId);
    if (result.tipo === "bloqueado") {
      setBloqueioNovo(result.mensagem ?? mensagemProprietarioIndisponivel());
      return;
    }
    if (!result.cliente) {
      return;
    }

    if (confirmados.some((item) => item.id === result.cliente!.id)) {
      return;
    }

    syncProprietarios([
      ...confirmados,
      {
        id: result.cliente.id,
        nome: result.cliente.nome,
        telefone: result.cliente.telefone,
      },
    ]);
    setValue("proprietario_novo", null);
    setShowForm(false);
    setAddingAnother(false);
    setAutocompleteNovos([]);
    setBloqueioNovo(null);
  }

  function confirmNewProprietario(values: NonNullable<ImovelFormValues["proprietario_novo"]>) {
    setConfirmados((current) => [
      ...current.filter((item) => item.id !== "pendente-novo"),
      {
        id: "pendente-novo",
        nome: values.nome,
        telefone: values.telefone,
        pendente: true,
      },
    ]);
    setValue("proprietario_novo", values, { shouldValidate: true });
    setShowForm(false);
  }

  const showSearchUi =
    showForm || addingAnother || (confirmados.length === 0 && !disabled);

  return (
    <div className="space-y-2">
      <Label>Proprietário *</Label>
      <div className="space-y-4">
        {confirmados.length > 0 ? (
          <ul className="space-y-2">
            {confirmados.map((proprietario) => (
              <li
                key={proprietario.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {getInitials(proprietario.nome)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{proprietario.nome}</p>
                    {proprietario.telefone ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {formatTelefoneBr(proprietario.telefone)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProprietario(proprietario.id)}
                  disabled={disabled}
                  aria-label="Remover proprietário"
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {confirmados.length > 0 && !showForm ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAddingAnother(true)}
            disabled={disabled}
          >
            <Plus className="size-4" data-icon="inline-start" />
            Proprietário
          </Button>
        ) : null}

        {showSearchUi && !showForm ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar proprietário por nome ou telefone..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
                disabled={disabled}
              />
              {isSearching ? (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
            </div>

            {results.length > 0 ? (
              <ul className="divide-y rounded-lg border border-border">
                {results.map((cliente) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      disabled={!cliente.pode_vincular || disabled}
                      onClick={() => confirmCliente(cliente)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors",
                        cliente.pode_vincular
                          ? "hover:bg-muted"
                          : "cursor-not-allowed opacity-60",
                      )}
                    >
                      <p className="font-medium">{cliente.nome}</p>
                      <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
                      {cliente.aviso ? (
                        <p className="mt-1 text-xs text-amber-600">{cliente.aviso}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <Button
              type="button"
              variant="outline"
              onClick={openNewForm}
              disabled={disabled}
              className="w-full sm:w-auto"
            >
              <UserPlus className="size-4" data-icon="inline-start" />
              Cadastrar novo proprietário
            </Button>
          </>
        ) : null}

        {showForm ? (
          <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
            <Controller
              control={control}
              name="proprietario_novo.nome"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Nome completo"
                    disabled={disabled}
                  />
                </div>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="proprietario_novo.telefone"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <TelefoneInput
                      value={field.value ?? ""}
                      onChange={(formatted) => {
                        field.onChange(formatted);
                        setNovoTelefone(formatted);
                        setBloqueioNovo(null);
                      }}
                      disabled={disabled}
                    />
                  </div>
                )}
              />

              <Controller
                control={control}
                name="proprietario_novo.email"
                render={({ field }) => (
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={field.value ?? ""}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        setNovoEmail(event.target.value);
                        setBloqueioNovo(null);
                      }}
                      placeholder="email@exemplo.com"
                      disabled={disabled}
                    />
                  </div>
                )}
              />
            </div>

            {autocompleteNovos.length > 0 ? (
              <ul className="divide-y rounded-lg border border-border">
                {autocompleteNovos.map((cliente) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm hover:bg-muted"
                      onClick={() => vincularProprietarioExistente(cliente.id)}
                    >
                      <p className="font-medium">{cliente.nome}</p>
                      <p className="text-muted-foreground">{cliente.telefone}</p>
                      <p className="text-xs text-primary">→ Selecionar esta pessoa</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {bloqueioNovo ? (
              <p className="text-sm text-destructive">{bloqueioNovo}</p>
            ) : null}

            <Controller
              control={control}
              name="proprietario_novo.atender_como_lead"
              render={({ field }) => (
                <div className="space-y-1">
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <Label htmlFor="atender_como_lead" className="cursor-pointer">
                        Atender também como lead interessado
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Aparecerá também na página de Atendimentos
                      </p>
                    </div>
                    <Switch
                      id="atender_como_lead"
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                    />
                  </div>
                </div>
              )}
            />

            <Controller
              control={control}
              name="proprietario_novo.eh_construtor_investidor"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>É construtor ou investidor? *</Label>
                  <Select
                    value={
                      field.value === true ? "sim" : field.value === false ? "nao" : undefined
                    }
                    onValueChange={(value) => field.onChange(value === "sim")}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Controller
                control={control}
                name="proprietario_novo"
                render={({ field }) => (
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={disabled || !field.value?.nome?.trim() || !field.value?.telefone?.trim()}
                    onClick={() => {
                      if (field.value) {
                        confirmNewProprietario(field.value);
                      }
                    }}
                  >
                    Confirmar
                  </Button>
                )}
              />
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={cancelNewForm}
                disabled={disabled}
              >
                Cancelar cadastro
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
