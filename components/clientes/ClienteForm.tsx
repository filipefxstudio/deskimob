"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { PessoaDuplicidadeAviso } from "@/components/pessoas/PessoaAutocomplete";
import { createCliente, updateCliente } from "@/lib/actions/clientes";
import {
  clienteFormDefaultValues,
  clienteFormSchema,
  type ClienteFormValues,
} from "@/lib/validations/cliente";
import type { Cliente } from "@/types";

interface ClienteFormProps {
  mode: "create" | "edit";
  cliente?: Cliente;
  onSuccess?: () => void;
}

function toFormValues(cliente: Cliente): ClienteFormValues {
  return {
    nome: cliente.nome,
    telefone: cliente.telefone,
    email: cliente.email ?? "",
    cpf: cliente.cpf ?? "",
    data_nascimento: cliente.data_nascimento ?? "",
    profissao: cliente.profissao ?? "",
    estado_civil: cliente.estado_civil ?? "",
    observacoes: cliente.observacoes ?? "",
    tipo: cliente.tipo,
    eh_construtor_investidor: cliente.eh_construtor_investidor,
    perfil_id: cliente.perfil_id ?? null,
  };
}

export function ClienteForm({ mode, cliente, onSuccess }: ClienteFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicidadeAtiva, setDuplicidadeAtiva] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteFormSchema) as Resolver<ClienteFormValues>,
    defaultValues: mode === "edit" && cliente ? toFormValues(cliente) : clienteFormDefaultValues,
  });

  const telefoneWatch = watch("telefone");
  const emailWatch = watch("email");

  function onSubmit(values: ClienteFormValues) {
    setError(null);

    startTransition(async () => {
      const result =
        mode === "edit" && cliente
          ? await updateCliente(cliente.id, values)
          : await createCliente(values);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (mode === "create" && result.clienteId) {
        router.push(`/dashboard/clientes/${result.clienteId}`);
        return;
      }

      onSuccess?.();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "edit" ? "Editar pessoa" : "Nova pessoa"}</CardTitle>
        <CardDescription>
          Cadastre leads, proprietários ou ambos em um único lugar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" {...register("nome")} aria-invalid={Boolean(errors.nome)} />
              {errors.nome ? (
                <p className="text-sm text-destructive">{errors.nome.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Controller
                control={control}
                name="telefone"
                render={({ field }) => (
                  <TelefoneInput
                    id="telefone"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={Boolean(errors.telefone)}
                  />
                )}
              />
              {errors.telefone ? (
                <p className="text-sm text-destructive">{errors.telefone.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" {...register("cpf")} />
            </div>
          </div>

          <PessoaDuplicidadeAviso
            telefone={telefoneWatch ?? ""}
            email={emailWatch ?? ""}
            clienteIdIgnorar={mode === "edit" ? cliente?.id : undefined}
            onDuplicidadeChange={(duplicado) => setDuplicidadeAtiva(duplicado)}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de nascimento</Label>
              <Input id="data_nascimento" type="date" {...register("data_nascimento")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profissao">Profissão</Label>
              <Input id="profissao" {...register("profissao")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado_civil">Estado civil</Label>
              <Input id="estado_civil" {...register("estado_civil")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="proprietario">Proprietário</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Controller
            control={control}
            name="eh_construtor_investidor"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="eh_construtor_investidor"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <Label htmlFor="eh_construtor_investidor" className="cursor-pointer font-normal">
                  É construtor ou investidor com múltiplos imóveis
                </Label>
              </div>
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" rows={3} {...register("observacoes")} />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

      <Button
        type="submit"
        loading={isPending}
        loadingText="Salvando..."
        disabled={duplicidadeAtiva}
      >
        {mode === "edit" ? "Salvar alterações" : "Cadastrar cliente"}
      </Button>
        </form>
      </CardContent>
    </Card>
  );
}
