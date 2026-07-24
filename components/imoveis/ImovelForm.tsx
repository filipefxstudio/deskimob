"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm, type FieldErrors, type Resolver } from "react-hook-form";

import { CepInput } from "@/components/imoveis/CepInput";
import { CaptadorSection } from "@/components/imoveis/CaptadorSection";
import { FotoUpload, type FotoItem } from "@/components/imoveis/FotoUpload";
import { ProprietarioSection } from "@/components/imoveis/ProprietarioSection";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  aprovarImovel,
  checkImovelDuplicado,
  createImovel,
  enviarImovelParaAprovacao,
  getProximoCodigoPreview,
  reprovarImovel,
  updateImovel,
} from "@/lib/actions/imoveis";
import {
  podeAprovarImovel,
  podeMostrarEnviarAprovacaoNoFormulario,
} from "@/lib/imoveis/aprovacao";
import { CARACTERISTICAS_CHECKLIST } from "@/lib/constants/caracteristicas-checklist";
import {
  COMPLEMENTO_TIPOS,
  DESTINACOES_IMOVEL,
  ESTADOS_BR,
  EXIBIR_ENDERECO_OPCOES,
  FINALIDADES_IMOVEL,
  LOCAL_CHAVES_OPCOES,
  STATUS_IMOVEL_SISTEMA,
  TIPOS_IMOVEL,
  VAGAS_COBERTURA_OPCOES,
  VAGAS_TIPO_OPCOES,
} from "@/lib/constants/imoveis";
import { geocodeAddress } from "@/lib/imoveis/geocode";
import {
  buildComplementoString,
  buildImovelFormDefaultValues,
  fotosToFotoItems,
  imovelToFormValues,
  proprietariosFromImovel,
  resolveStatusEmCadastroId,
} from "@/lib/imoveis/form";
import { generateImovelSlug, cn } from "@/lib/utils";
import {
  imovelCadastroSchema,
  imovelFormDefaultValues,
  validateImovelParaAprovacao,
  type CaptadorFormItem,
  type ImovelFormValues,
} from "@/lib/validations/imovel";
import type { Imovel, Perfil, StatusImovel } from "@/types";

interface ImovelFormProps {
  mode?: "create" | "edit";
  imovel?: Imovel;
  statusList?: StatusImovel[];
  perfis?: Perfil[];
  perfilAtualId?: string | null;
  perfil?: Perfil | null;
}

const SELECT_PLACEHOLDER = "__selecione__";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function IntegerField({
  id,
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        value={value === null || value === undefined ? "" : value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? null : Number(next));
        }}
        onBlur={() => {
          onBlur?.();
        }}
        aria-invalid={Boolean(error)}
        disabled={disabled}
      />
      <FieldError message={error} />
    </div>
  );
}

function getFirstFormErrorMessage(errors: FieldErrors<ImovelFormValues>): string | null {
  for (const value of Object.values(errors)) {
    if (!value) {
      continue;
    }

    if ("message" in value && typeof value.message === "string") {
      return value.message;
    }

    if (typeof value === "object") {
      const nested = getFirstFormErrorMessage(value as FieldErrors<ImovelFormValues>);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function ImovelForm({
  mode = "create",
  imovel,
  statusList = [],
  perfis = [],
  perfilAtualId = null,
  perfil = null,
}: ImovelFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && imovel;

  const [fotos, setFotos] = useState<FotoItem[]>(() =>
    isEdit ? fotosToFotoItems(imovel.fotos ?? []) : [],
  );
  const [avisoDuplicidade, setAvisoDuplicidade] = useState<{
    imovelId: string;
    codigo?: string;
    bairro?: string;
    titulo?: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [proximoCodigo, setProximoCodigo] = useState<string | null>(
    isEdit ? (imovel.codigo ?? null) : null,
  );
  const [isPending, startTransition] = useTransition();

  const initialFormValues = useMemo(
    () =>
      isEdit && imovel
        ? imovelToFormValues(imovel)
        : buildImovelFormDefaultValues(statusList),
    [isEdit, imovel, statusList],
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<ImovelFormValues>({
    resolver: zodResolver(imovelCadastroSchema) as Resolver<ImovelFormValues>,
    defaultValues: initialFormValues,
  });

  const finalidade = watch("finalidade");
  const tipo = watch("tipo");
  const titulo = watch("titulo");
  const cidade = watch("cidade");
  const cep = watch("cep");
  const numero = watch("numero");
  const complementoTipo = watch("complemento_tipo");
  const complementoNumero = watch("complemento_numero");
  const complementoTorre = watch("complemento_torre");
  const condominioNome = watch("condominio_nome");
  const portalDiferente = watch("portal_endereco_diferente");
  const portalCep = watch("portal_cep");
  const portalLogradouro = watch("portal_logradouro");
  const portalNumero = watch("portal_numero");
  const portalBairro = watch("portal_bairro");
  const portalCidade = watch("portal_cidade");
  const portalEstado = watch("portal_estado");
  const logradouro = watch("logradouro");
  const bairro = watch("bairro");
  const estado = watch("estado");
  const localChaves = watch("local_chaves");
  const proprietarioIds = watch("proprietario_ids");
  const proprietariosIniciais = useMemo(
    () => (isEdit && imovel ? proprietariosFromImovel(imovel) : []),
    [isEdit, imovel],
  );
  const captadores = watch("captadores");
  const publicadoSite = watch("publicado_site");
  const publicadoPortais = watch("publicado_portais");
  const destaqueSite = watch("destaque_site");
  const statusImovelId = watch("status_imovel_id");

  const statusLocked =
    !isEdit || (imovel.status_aprovacao !== "aprovado" && Boolean(imovel.status_aprovacao));

  const selectableStatusList = useMemo(
    () =>
      statusList.filter(
        (status) => !(STATUS_IMOVEL_SISTEMA as readonly string[]).includes(status.nome),
      ),
    [statusList],
  );

  const exigeComplementoTipo = tipo !== "casa" && tipo !== "terreno";
  const podeEnviarAprovacao = podeMostrarEnviarAprovacaoNoFormulario(
    isEdit ? imovel : null,
  );
  const podeAprovarReprovar =
    isEdit &&
    imovel &&
    podeAprovarImovel(perfil) &&
    imovel.status_aprovacao === "aguardando_aprovacao";
  const statusOperacionalLabel = useMemo(() => {
    const selected = statusList.find((status) => status.id === statusImovelId);
    if (selected) {
      return selected.nome;
    }
    if (isEdit && imovel?.status_imovel?.nome) {
      return imovel.status_imovel.nome;
    }
    return "Em cadastro";
  }, [statusList, statusImovelId, isEdit, imovel?.status_imovel?.nome]);

  const slugPreview = useMemo(
    () => generateImovelSlug(titulo ?? "", cidade ?? ""),
    [titulo, cidade],
  );

  useEffect(() => {
    if (!isEdit && perfilAtualId && captadores.length === 0) {
      const initialCaptador: CaptadorFormItem = {
        id: crypto.randomUUID(),
        perfil_id: perfilAtualId,
        nome_externo: null,
        principal: true,
        externo: false,
      };
      setValue("captadores", [initialCaptador], { shouldValidate: true });
      setValue("captador_id", perfilAtualId);
    }
  }, [isEdit, perfilAtualId, captadores.length, setValue]);

  useEffect(() => {
    if (!isEdit) {
      getProximoCodigoPreview().then(setProximoCodigo);
    }
  }, [isEdit]);

  useEffect(() => {
    if (!publicadoSite && destaqueSite) {
      setValue("destaque_site", false);
    }
  }, [publicadoSite, destaqueSite, setValue]);

  function applyValidationErrors(
    validationErrors: { path: string; message: string }[],
  ) {
    clearErrors();
    for (const item of validationErrors) {
      if (item.path === "fotos") {
        continue;
      }
      setError(item.path as keyof ImovelFormValues, { message: item.message });
    }
  }

  function buildFotoMetadata() {
    return fotos.map((foto) => ({
      existingId: foto.existingId,
      legenda: foto.legenda,
      ordem: foto.ordem,
    }));
  }

  function formatServerActionError(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      const message = error.message;
      if (
        message.includes("Unexpected end of form") ||
        message.toLowerCase().includes("body exceeded")
      ) {
        return "O envio excedeu o limite de tamanho (muitas fotos de uma vez). Salve o imóvel com menos fotos por vez e tente novamente.";
      }
      return message || fallback;
    }
    return fallback;
  }

  async function uploadNewFotos(imovelId: string): Promise<{ error?: string }> {
    const newFotos = fotos.filter(
      (foto): foto is FotoItem & { file: File } => Boolean(foto.file),
    );

    if (newFotos.length === 0) {
      return {};
    }

    const BATCH_SIZE = 8;

    for (let offset = 0; offset < newFotos.length; offset += BATCH_SIZE) {
      const batch = newFotos.slice(offset, offset + BATCH_SIZE);
      const formData = new FormData();
      formData.set(
        "metadata",
        JSON.stringify(
          batch.map((foto) => ({
            tempId: foto.id,
            legenda: foto.legenda,
            ordem: foto.ordem,
          })),
        ),
      );

      for (const foto of batch) {
        formData.append(`file:${foto.id}`, foto.file);
      }

      const response = await fetch(`/api/imoveis/${imovelId}/fotos`, {
        method: "POST",
        body: formData,
      });

      let result: { error?: string; success?: boolean; imovelId?: string };

      try {
        result = (await response.json()) as typeof result;
      } catch {
        return { error: "Resposta inválida ao enviar fotos." };
      }

      if (!response.ok || result.error) {
        return { error: result.error ?? "Não foi possível enviar as fotos." };
      }
    }

    return {};
  }

  async function persistImovel(
    values: ImovelFormValues,
  ): Promise<{ error?: string; imovelId?: string }> {
    const fotoMetadata = buildFotoMetadata();

    if (isEdit) {
      const result = await updateImovel(imovel.id, values, fotoMetadata);

      if (result?.error) {
        return { error: result.error };
      }

      const uploadResult = await uploadNewFotos(imovel.id);
      if (uploadResult.error) {
        return { error: uploadResult.error };
      }

      return { imovelId: imovel.id };
    }

    const result = await createImovel(values);

    if (result?.error || !result.imovelId) {
      return { error: result?.error ?? "Não foi possível cadastrar o imóvel." };
    }

    const uploadResult = await uploadNewFotos(result.imovelId);
    if (uploadResult.error) {
      return { error: uploadResult.error };
    }

    return { error: result?.error, imovelId: result.imovelId };
  }

  function handleEnviarAprovacao() {
    const values = getValues();
    const validation = validateImovelParaAprovacao(values, { fotosCount: fotos.length });

    if (!validation.success) {
      applyValidationErrors(validation.errors);
      setSubmitError(validation.message);
      toast({
        variant: "destructive",
        title: "Não foi possível enviar para aprovação",
        description: validation.message,
      });
      return;
    }

    setSubmitError(null);
    clearErrors();

    startTransition(async () => {
      try {
        const saveResult = await persistImovel(values);
        if (saveResult.error) {
          setSubmitError(saveResult.error);
          toast({ variant: "destructive", title: "Erro ao salvar", description: saveResult.error });
          return;
        }

        const imovelId = saveResult.imovelId;
        if (!imovelId) {
          const message = "Não foi possível identificar o imóvel após salvar.";
          setSubmitError(message);
          toast({
            variant: "destructive",
            title: "Não foi possível enviar para aprovação",
            description: message,
          });
          return;
        }

        const result = await enviarImovelParaAprovacao(imovelId);
        if (result.error) {
          setSubmitError(result.error);
          toast({
            variant: "destructive",
            title: "Não foi possível enviar para aprovação",
            description: result.error,
          });
          return;
        }

        toast({ title: "Imóvel enviado para aprovação." });
        router.push(`/dashboard/imoveis/${imovelId}`);
        router.refresh();
      } catch (error) {
        const message = formatServerActionError(
          error,
          "Não foi possível enviar o imóvel para aprovação. Tente novamente.",
        );
        setSubmitError(message);
        toast({
          variant: "destructive",
          title: "Não foi possível enviar para aprovação",
          description: message,
        });
      }
    });
  }

  function handleAprovar() {
    if (!isEdit) {
      return;
    }

    startTransition(async () => {
      const result = await aprovarImovel(imovel.id);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: "Imóvel aprovado." });
      router.push(`/dashboard/imoveis/${imovel.id}`);
      router.refresh();
    });
  }

  function handleReprovar() {
    if (!isEdit) {
      return;
    }

    startTransition(async () => {
      const result = await reprovarImovel(imovel.id);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: "Imóvel reprovado. Retornou para cadastro." });
      router.refresh();
    });
  }

  useEffect(() => {
    if (statusLocked && statusList.length > 0 && !statusImovelId) {
      const emCadastroId = resolveStatusEmCadastroId(statusList);
      if (emCadastroId) {
        setValue("status_imovel_id", emCadastroId, { shouldValidate: true });
      }
    }
  }, [statusLocked, statusList, statusImovelId, setValue]);

  useEffect(() => {
    const address = portalDiferente
      ? {
          logradouro: portalLogradouro ?? "",
          numero: portalNumero ?? "",
          bairro: portalBairro ?? "",
          cidade: portalCidade ?? "",
          estado: portalEstado ?? "",
          cep: portalCep,
        }
      : {
          logradouro: logradouro ?? "",
          numero: numero ?? "",
          bairro: bairro ?? "",
          cidade: cidade ?? "",
          estado: estado ?? "",
          cep,
        };

    if (!address.logradouro || !address.cidade) {
      return;
    }

    const timer = setTimeout(async () => {
      const result = await geocodeAddress(address);
      if (result) {
        setValue("latitude", result.latitude, { shouldValidate: true });
        setValue("longitude", result.longitude, { shouldValidate: true });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    cep,
    numero,
    logradouro,
    bairro,
    estado,
    cidade,
    portalDiferente,
    portalCep,
    portalLogradouro,
    portalNumero,
    portalBairro,
    portalCidade,
    portalEstado,
    setValue,
  ]);

  useEffect(() => {
    if (!cep || !numero || !logradouro) {
      setAvisoDuplicidade(null);
      return;
    }

    const complemento = buildComplementoString({
      ...imovelFormDefaultValues,
      cep,
      numero,
      logradouro,
      complemento_tipo: complementoTipo,
      complemento_numero: complementoNumero,
      complemento_torre: complementoTorre,
      condominio_nome: condominioNome,
    });

    const timer = setTimeout(async () => {
      const result = await checkImovelDuplicado(
        cep,
        numero,
        complemento,
        logradouro,
        isEdit ? imovel.id : undefined,
      );

      if (result.duplicado && result.imovelId) {
        setAvisoDuplicidade({
          imovelId: result.imovelId,
          codigo: result.codigo,
          bairro: result.bairro,
          titulo: result.titulo,
        });
      } else {
        setAvisoDuplicidade(null);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    cep,
    numero,
    logradouro,
    complementoTipo,
    complementoNumero,
    complementoTorre,
    condominioNome,
    isEdit,
    imovel?.id,
  ]);

  function toggleDiferencial(
    current: string[],
    item: string,
    checked: boolean,
  ): string[] {
    if (checked) {
      return current.includes(item) ? current : [...current, item];
    }
    return current.filter((value) => value !== item);
  }

  function onInvalid(formErrors: FieldErrors<ImovelFormValues>) {
    const message =
      getFirstFormErrorMessage(formErrors) ??
      "Revise os campos obrigatórios antes de salvar.";

    setSubmitError(message);
    toast({
      variant: "destructive",
      title: "Não foi possível salvar",
      description: message,
    });
  }

  function onSubmit(values: ImovelFormValues) {
    setSubmitError(null);
    clearErrors();

    startTransition(async () => {
      try {
        const result = await persistImovel(values);

        if (result.error) {
          setSubmitError(result.error);
          toast({ variant: "destructive", title: "Erro ao salvar", description: result.error });
          return;
        }

        toast({
          title: isEdit ? "Imóvel atualizado com sucesso." : "Imóvel cadastrado com sucesso.",
        });
        router.push(
          result.imovelId ? `/dashboard/imoveis/${result.imovelId}` : "/dashboard/imoveis",
        );
        router.refresh();
      } catch (error) {
        const message = formatServerActionError(
          error,
          "Não foi possível salvar o imóvel. Tente novamente.",
        );
        setSubmitError(message);
        toast({ variant: "destructive", title: "Erro ao salvar", description: message });
      }
    });
  }

  const checkboxFields = [
    { name: "exclusividade" as const, label: "Exclusividade" },
    { name: "imovel_ocupado" as const, label: "Imóvel ocupado" },
    { name: "contrato_aluguel_ativo" as const, label: "Contrato de aluguel ativo" },
    { name: "aceita_financiamento" as const, label: "Aceita financiamento" },
    { name: "aceita_permuta" as const, label: "Aceita permuta" },
    { name: "imovel_na_planta" as const, label: "Imóvel na planta" },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Código do imóvel</CardTitle>
          <CardDescription>
            Código sequencial automático e código personalizado opcional.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              value={proximoCodigo ?? "—"}
              readOnly
              className="bg-muted font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigo_personalizado">
              Código personalizado{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="codigo_personalizado"
              placeholder="Ex.: APT-102"
              {...register("codigo_personalizado")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Informações básicas</CardTitle>
          <CardDescription>
            Dados principais do imóvel exibidos no CRM e no site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {slugPreview ? (
            <p className="text-sm text-muted-foreground">
              Slug: <span className="font-mono text-foreground">{slugPreview}</span>
            </p>
          ) : null}

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Select
                    value={field.value === "" ? SELECT_PLACEHOLDER : field.value}
                    onValueChange={(value) => {
                      field.onChange(value === SELECT_PLACEHOLDER ? "" : value);
                    }}
                  >
                    <SelectTrigger aria-invalid={Boolean(errors.tipo)}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_PLACEHOLDER} disabled>
                        Selecione
                      </SelectItem>
                      {TIPOS_IMOVEL.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.tipo?.message} />
            </div>

            <div className="space-y-2">
              <Label>Finalidade *</Label>
              <Controller
                control={control}
                name="finalidade"
                render={({ field }) => (
                  <Select
                    value={field.value === "" ? SELECT_PLACEHOLDER : field.value}
                    onValueChange={(value) => {
                      field.onChange(value === SELECT_PLACEHOLDER ? "" : value);
                    }}
                  >
                    <SelectTrigger aria-invalid={Boolean(errors.finalidade)}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_PLACEHOLDER} disabled>
                        Selecione
                      </SelectItem>
                      {FINALIDADES_IMOVEL.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.finalidade?.message} />
            </div>

            <div className="space-y-2">
              <Label>Destinação *</Label>
              <Controller
                control={control}
                name="destinacao"
                render={({ field }) => (
                  <Select
                    value={field.value === "" ? SELECT_PLACEHOLDER : field.value}
                    onValueChange={(value) => {
                      field.onChange(value === SELECT_PLACEHOLDER ? "" : value);
                    }}
                  >
                    <SelectTrigger aria-invalid={Boolean(errors.destinacao)}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_PLACEHOLDER} disabled>
                        Selecione
                      </SelectItem>
                      {DESTINACOES_IMOVEL.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.destinacao?.message} />
            </div>

            <div className="space-y-2">
              <Label>Status{statusLocked ? "" : " *"}</Label>
              {statusLocked ? (
                <>
                  <Input
                    value={statusOperacionalLabel}
                    readOnly
                    className="bg-muted"
                    aria-readonly
                  />
                  <p className="text-xs text-muted-foreground">
                    O status operacional é definido automaticamente pelo fluxo de cadastro e
                    aprovação.
                  </p>
                </>
              ) : (
                <>
                  <Controller
                    control={control}
                    name="status_imovel_id"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-invalid={Boolean(errors.status_imovel_id)}>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableStatusList.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={errors.status_imovel_id?.message} />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Localização</CardTitle>
          <CardDescription>
            Endereço completo. O CEP preenche logradouro, bairro, cidade e UF automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-12">
            <div className="col-span-12 sm:col-span-2">
              <Controller
                control={control}
                name="cep"
                render={({ field }) => (
                  <CepInput
                    value={field.value}
                    onChange={field.onChange}
                    onAddressFound={(address) => {
                      setValue("logradouro", address.logradouro, { shouldValidate: true });
                      setValue("bairro", address.bairro, { shouldValidate: true });
                      setValue("cidade", address.cidade, { shouldValidate: true });
                      setValue("estado", address.estado, { shouldValidate: true });
                    }}
                    error={errors.cep?.message}
                    disabled={isPending}
                  />
                )}
              />
            </div>
            <div className="col-span-12 space-y-2 sm:col-span-7">
              <Label htmlFor="logradouro">Logradouro *</Label>
              <Input id="logradouro" aria-invalid={Boolean(errors.logradouro)} {...register("logradouro")} />
              <FieldError message={errors.logradouro?.message} />
            </div>
            <div className="col-span-6 space-y-2 sm:col-span-3">
              <Label htmlFor="numero">Número *</Label>
              <Input id="numero" aria-invalid={Boolean(errors.numero)} {...register("numero")} />
              <FieldError message={errors.numero?.message} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de complemento{exigeComplementoTipo ? " *" : ""}</Label>
              <Controller
                control={control}
                name="complemento_tipo"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.complemento_tipo)}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPLEMENTO_TIPOS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.complemento_tipo?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complemento_numero">
                Complemento/Identificação{exigeComplementoTipo ? " *" : ""}
              </Label>
              <Input
                id="complemento_numero"
                placeholder="Ex: 102, A, Loja 3"
                aria-invalid={Boolean(errors.complemento_numero)}
                {...register("complemento_numero")}
              />
              <FieldError message={errors.complemento_numero?.message} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="complemento_torre">Torre / Bloco</Label>
              <Input id="complemento_torre" {...register("complemento_torre")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="condominio_nome">Nome do condomínio</Label>
              <Input id="condominio_nome" {...register("condominio_nome")} />
            </div>
          </div>

          {avisoDuplicidade ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">⚠️ Atenção: Já existe um imóvel cadastrado neste endereço.</p>
              <p className="mt-1">
                Imóvel #{avisoDuplicidade.codigo ?? "—"} — {avisoDuplicidade.bairro ?? avisoDuplicidade.titulo ?? "Endereço existente"}
              </p>
              <p className="mt-1 text-amber-800">
                Verifique se não é um cadastro duplicado antes de continuar.
              </p>
              <Link
                href={`/dashboard/imoveis/${avisoDuplicidade.imovelId}`}
                className="mt-2 inline-block font-medium text-primary underline"
              >
                Ver imóvel existente
              </Link>
            </div>
          ) : null}

          <div className="grid gap-4 grid-cols-12">
            <div className="col-span-12 space-y-2 sm:col-span-4">
              <Label htmlFor="bairro">Bairro *</Label>
              <Input id="bairro" aria-invalid={Boolean(errors.bairro)} {...register("bairro")} />
              <FieldError message={errors.bairro?.message} />
            </div>
            <div className="col-span-12 space-y-2 sm:col-span-6">
              <Label htmlFor="cidade">Cidade *</Label>
              <Input id="cidade" aria-invalid={Boolean(errors.cidade)} {...register("cidade")} />
              <FieldError message={errors.cidade?.message} />
            </div>
            <div className="col-span-12 space-y-2 sm:col-span-2">
              <Label>Estado (UF) *</Label>
              <Controller
                control={control}
                name="estado"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.estado)}>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.estado?.message} />
            </div>
          </div>

          <Controller
            control={control}
            name="portal_endereco_diferente"
            render={({ field }) => (
              <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="portal_endereco_diferente"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                  <div>
                    <Label htmlFor="portal_endereco_diferente" className="cursor-pointer">
                      Usar endereço diferente para publicação nos portais
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      O endereço real ficará apenas no sistema interno.
                    </p>
                  </div>
                </div>

                {portalDiferente ? (
                  <div className="space-y-4">
                    <Controller
                      control={control}
                      name="portal_cep"
                      render={({ field }) => (
                        <CepInput
                          id="portal_cep"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onAddressFound={(address) => {
                            setValue("portal_logradouro", address.logradouro, { shouldValidate: true });
                            setValue("portal_bairro", address.bairro, { shouldValidate: true });
                            setValue("portal_cidade", address.cidade, { shouldValidate: true });
                            setValue("portal_estado", address.estado, { shouldValidate: true });
                          }}
                          error={errors.portal_cep?.message}
                          disabled={isPending}
                        />
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="portal_logradouro">Logradouro para portais *</Label>
                        <Input id="portal_logradouro" {...register("portal_logradouro")} />
                        <FieldError message={errors.portal_logradouro?.message} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="portal_numero">Número *</Label>
                        <Input id="portal_numero" {...register("portal_numero")} />
                        <FieldError message={errors.portal_numero?.message} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="portal_bairro">Bairro *</Label>
                        <Input id="portal_bairro" {...register("portal_bairro")} />
                        <FieldError message={errors.portal_bairro?.message} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="portal_cidade">Cidade *</Label>
                        <Input id="portal_cidade" {...register("portal_cidade")} />
                        <FieldError message={errors.portal_cidade?.message} />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado *</Label>
                        <Controller
                          control={control}
                          name="portal_estado"
                          render={({ field }) => (
                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="UF" />
                              </SelectTrigger>
                              <SelectContent>
                                {ESTADOS_BR.map((uf) => (
                                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FieldError message={errors.portal_estado?.message} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input id="latitude" type="number" step="any" readOnly className="bg-muted" {...register("latitude")} />
              <p className="text-xs text-muted-foreground">Preenchida automaticamente pelo endereço</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input id="longitude" type="number" step="any" readOnly className="bg-muted" {...register("longitude")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Proprietário e captador</CardTitle>
          <CardDescription>
            Vincule o proprietário e o captador responsável pelo imóvel.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <ProprietarioSection
            control={control}
            setValue={setValue}
            proprietarioIds={proprietarioIds}
            proprietariosIniciais={proprietariosIniciais}
            disabled={isPending}
            error={errors.cliente_id?.message}
          />
          <CaptadorSection
            control={control}
            setValue={setValue}
            captadores={captadores}
            perfis={perfis}
            disabled={isPending}
            error={errors.captadores?.message}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Chaves e opções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Local das chaves</Label>
              <Controller
                control={control}
                name="local_chaves"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.local_chaves)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCAL_CHAVES_OPCOES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.local_chaves?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chaves_codigo">Código/número da chave</Label>
              <Input
                id="chaves_codigo"
                placeholder="Ex.: 102, gaveta 3"
                disabled={localChaves !== "imobiliaria" || isPending}
                {...register("chaves_codigo")}
              />
              <FieldError message={errors.chaves_codigo?.message} />
            </div>

            {localChaves === "outros" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="chaves_descricao">Descrição do local *</Label>
                <Textarea id="chaves_descricao" rows={2} {...register("chaves_descricao")} />
                <FieldError message={errors.chaves_descricao?.message} />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {checkboxFields.map(({ name, label }) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={name}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    <Label htmlFor={name} className="cursor-pointer font-normal">{label}</Label>
                  </div>
                )}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Características e diferenciais</CardTitle>
          <CardDescription>Áreas, composição e checklists do imóvel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="area_util">Área útil (m²)</Label>
              <Input
                id="area_util"
                type="number"
                min={0}
                step="0.01"
                aria-invalid={Boolean(errors.area_util)}
                {...register("area_util", {
                  setValueAs: (value) => (value === "" ? null : Number(value)),
                })}
              />
              <FieldError message={errors.area_util?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area_total">Área total/Área do terreno (m²)</Label>
              <Input
                id="area_total"
                type="number"
                min={0}
                step="0.01"
                aria-invalid={Boolean(errors.area_total)}
                {...register("area_total", {
                  setValueAs: (value) => (value === "" ? null : Number(value)),
                })}
              />
              <FieldError message={errors.area_total?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ano_construcao">Ano de construção</Label>
              <Input
                id="ano_construcao"
                type="number"
                min={1800}
                step={1}
                aria-invalid={Boolean(errors.ano_construcao)}
                {...register("ano_construcao", {
                  setValueAs: (value) => (value === "" ? null : Number(value)),
                })}
              />
              <FieldError message={errors.ano_construcao?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="elevadores">Elevadores</Label>
              <Controller
                control={control}
                name="elevadores"
                render={({ field }) => (
                  <IntegerField
                    id="elevadores"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isPending}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
            {(
              [
                ["quartos", "Quartos *"],
                ["suites", "Suítes"],
                ["banheiros", "Banheiros"],
                ["salas", "Salas"],
                ["vagas", "Vagas *"],
              ] as const
            ).map(([name, label]) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>{label}</Label>
                <Controller
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <IntegerField
                      id={name}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors[name]?.message}
                      disabled={isPending}
                    />
                  )}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de vaga</Label>
              <Controller
                control={control}
                name="vagas_tipo"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.vagas_tipo)}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {VAGAS_TIPO_OPCOES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.vagas_tipo?.message} />
            </div>
            <div className="space-y-2">
              <Label>Cobertura da vaga</Label>
              <Controller
                control={control}
                name="vagas_cobertura"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.vagas_cobertura)}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {VAGAS_COBERTURA_OPCOES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.vagas_cobertura?.message} />
            </div>
          </div>

          {CARACTERISTICAS_CHECKLIST.map((categoria) => (
            <div key={categoria.id} className="space-y-2">
              <Label>{categoria.titulo}</Label>
              <Controller
                control={control}
                name="diferenciais"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {categoria.itens.map((item) => {
                      const selected = field.value.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            field.onChange(toggleDiferencial(field.value, item, !selected))
                          }
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:bg-muted",
                          )}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Valores e comissão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {finalidade === "venda" ? (
            <div className="grid gap-4 grid-cols-12">
              <div className="col-span-12 space-y-2 sm:col-span-5">
                <Label htmlFor="valor_venda">Valor de venda/locação (R$) *</Label>
                <Controller
                  control={control}
                  name="valor_venda"
                  render={({ field }) => (
                    <CurrencyInput
                      id="valor_venda"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.valor_venda)}
                      disabled={isPending}
                    />
                  )}
                />
                <FieldError message={errors.valor_venda?.message} />
              </div>
              <div className="col-span-6 space-y-2 sm:col-span-4">
                <Label htmlFor="valor_condominio">Condomínio (R$)</Label>
                <Controller
                  control={control}
                  name="valor_condominio"
                  render={({ field }) => (
                    <CurrencyInput
                      id="valor_condominio"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.valor_condominio)}
                      disabled={isPending}
                    />
                  )}
                />
                <FieldError message={errors.valor_condominio?.message} />
              </div>
              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="valor_iptu">IPTU (R$)</Label>
                <Controller
                  control={control}
                  name="valor_iptu"
                  render={({ field }) => (
                    <CurrencyInput
                      id="valor_iptu"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.valor_iptu)}
                      disabled={isPending}
                    />
                  )}
                />
                <FieldError message={errors.valor_iptu?.message} />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-12">
              <div className="col-span-12 space-y-2 sm:col-span-5">
                <Label htmlFor="valor_locacao">Valor de venda/locação (R$) *</Label>
                <Controller
                  control={control}
                  name="valor_locacao"
                  render={({ field }) => (
                    <CurrencyInput
                      id="valor_locacao"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.valor_locacao)}
                      disabled={isPending}
                    />
                  )}
                />
                <FieldError message={errors.valor_locacao?.message} />
              </div>
              <div className="col-span-6 space-y-2 sm:col-span-4">
                <Label htmlFor="valor_condominio">Condomínio (R$)</Label>
                <Controller
                  control={control}
                  name="valor_condominio"
                  render={({ field }) => (
                    <CurrencyInput
                      id="valor_condominio"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.valor_condominio)}
                      disabled={isPending}
                    />
                  )}
                />
                <FieldError message={errors.valor_condominio?.message} />
              </div>
              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="valor_iptu">IPTU (R$)</Label>
                <Controller
                  control={control}
                  name="valor_iptu"
                  render={({ field }) => (
                    <CurrencyInput
                      id="valor_iptu"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={Boolean(errors.valor_iptu)}
                      disabled={isPending}
                    />
                  )}
                />
                <FieldError message={errors.valor_iptu?.message} />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comissao_percent">Comissão (%)</Label>
              <Input
                id="comissao_percent"
                type="number"
                min={0}
                max={100}
                step="0.01"
                aria-invalid={Boolean(errors.comissao_percent)}
                {...register("comissao_percent", {
                  setValueAs: (value) => (value === "" ? null : Number(value)),
                })}
              />
              <FieldError message={errors.comissao_percent?.message} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>7. Título e descrição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              placeholder="Ex.: Apartamento 3 quartos com vista"
              aria-invalid={Boolean(errors.titulo)}
              {...register("titulo")}
            />
            <FieldError message={errors.titulo?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" rows={5} aria-invalid={Boolean(errors.descricao)} {...register("descricao")} />
            <FieldError message={errors.descricao?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>8. Publicação</CardTitle>
          <CardDescription>
            Controle onde o imóvel será exibido e qual endereço mostrar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4 lg:flex-row lg:items-end lg:gap-6">
            <div className="flex flex-1 items-center justify-between gap-3 lg:justify-start">
              <Controller
                control={control}
                name="publicado_site"
                render={({ field }) => (
                  <>
                    <Label htmlFor="publicado_site" className="cursor-pointer">
                      Publicar no site
                    </Label>
                    <Switch
                      id="publicado_site"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                  </>
                )}
              />
            </div>
            <div className="flex flex-1 items-center justify-between gap-3 lg:justify-start">
              <Controller
                control={control}
                name="destaque_site"
                render={({ field }) => (
                  <>
                    <Label
                      htmlFor="destaque_site"
                      className={publicadoSite ? "cursor-pointer" : "text-muted-foreground"}
                    >
                      Destaque
                    </Label>
                    <Switch
                      id="destaque_site"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!publicadoSite || isPending}
                    />
                  </>
                )}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Label>Exibir endereço{publicadoSite ? " *" : ""}</Label>
              <Controller
                control={control}
                name="exibir_endereco_site"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!publicadoSite || isPending}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXIBIR_ENDERECO_OPCOES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between lg:max-w-xl">
            <Controller
              control={control}
              name="publicado_portais"
              render={({ field }) => (
                <>
                  <Label htmlFor="publicado_portais" className="cursor-pointer">
                    Publicar nos portais
                  </Label>
                  <Switch
                    id="publicado_portais"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                </>
              )}
            />
            <div className="min-w-0 flex-1 space-y-2 sm:max-w-xs">
              <Label>Exibir endereço{publicadoPortais ? " *" : ""}</Label>
              <Controller
                control={control}
                name="exibir_endereco_portais"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!publicadoPortais || isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXIBIR_ENDERECO_OPCOES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>9. Fotos</CardTitle>
        </CardHeader>
        <CardContent>
          <FotoUpload fotos={fotos} onChange={setFotos} disabled={isPending} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>10. Vídeo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="video_url">URL do vídeo</Label>
            <Input id="video_url" type="url" {...register("video_url")} />
            <FieldError message={errors.video_url?.message} />
          </div>
        </CardContent>
      </Card>

      {submitError ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {submitError}
        </p>
      ) : null}

      {podeEnviarAprovacao ? (
        <p className="text-sm text-muted-foreground">
          {podeAprovarImovel(perfil)
            ? "Como gestor, você pode enviar para aprovação ou aprovar diretamente após o envio."
            : "Envie para aprovação quando todos os campos obrigatórios estiverem preenchidos."}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        {podeAprovarReprovar ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={handleReprovar}
              className="min-w-36"
            >
              Reprovar
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleAprovar}
              className="min-w-36"
            >
              Aprovar
            </Button>
          </>
        ) : null}
        {podeEnviarAprovacao ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={handleEnviarAprovacao}
            className="min-w-36"
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" data-icon="inline-start" />
                Enviando...
              </>
            ) : (
              "Enviar para aprovação"
            )}
          </Button>
        ) : null}
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href={isEdit ? `/dashboard/imoveis/${imovel.id}` : "/dashboard/imoveis"}>
            Cancelar
          </Link>
        </Button>
        <Button type="submit" disabled={isPending} className="min-w-36">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Salvando...
            </>
          ) : isEdit ? (
            "Salvar"
          ) : (
            "Cadastrar imóvel"
          )}
        </Button>
      </div>
    </form>
  );
}
