import { z } from "zod";

function coordNumber(message = "Coordenada inválida.") {
  return z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) {
        return null;
      }
      return Number(value);
    },
    z.number({ error: message }).nullable(),
  );
}

function optionalNumber(message = "Informe um número válido.") {
  return z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) {
        return null;
      }
      return Number(value);
    },
    z
      .number({ error: message })
      .min(0, "O valor não pode ser negativo.")
      .nullable(),
  );
}

function looseNumber(defaultValue = 0, message = "Informe um número válido.") {
  return z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) {
        return defaultValue;
      }
      return Number(value);
    },
    z.number({ error: message }).min(0, "O valor não pode ser negativo."),
  );
}

function looseInteger(defaultValue = 0, message = "Informe um número válido.") {
  return z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) {
        return defaultValue;
      }
      return Number(value);
    },
    z
      .number({ error: message })
      .int("Use um número inteiro.")
      .min(0, "O valor não pode ser negativo."),
  );
}

function nullableNumber(message = "Informe um número válido.") {
  return z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) {
        return null;
      }
      return Number(value);
    },
    z
      .number({ error: message })
      .min(0, "O valor não pode ser negativo.")
      .nullable(),
  );
}

function nullableInteger(message = "Informe um número válido.") {
  return z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) {
        return null;
      }
      return Number(value);
    },
    z
      .number({ error: message })
      .int("Use um número inteiro.")
      .min(0, "O valor não pode ser negativo.")
      .nullable(),
  );
}

const TIPOS_IMOVEL_VALUES = [
  "apartamento",
  "casa",
  "terreno",
  "comercial",
  "cobertura",
  "studio",
] as const;

const FINALIDADES_IMOVEL_VALUES = ["venda", "locacao"] as const;

const DESTINACOES_IMOVEL_VALUES = ["residencial", "comercial", "rural"] as const;

const localChavesEnum = z.enum(["imobiliaria", "proprietario", "portaria", "outros"], {
  error: "Selecione o local das chaves.",
});

const proprietarioNovoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do proprietário."),
  telefone: z.string().trim().min(8, "Informe o telefone do proprietário."),
  email: z.string().trim().optional(),
  atender_como_lead: z.boolean(),
  eh_construtor_investidor: z.boolean(),
});

export const captadorFormItemSchema = z.object({
  id: z.string(),
  perfil_id: z.string().uuid().optional().nullable(),
  nome_externo: z.string().trim().optional().nullable(),
  principal: z.boolean(),
  externo: z.boolean(),
});

const imovelFieldsSchema = z.object({
  titulo: z.string().trim().optional(),
  codigo_personalizado: z.string().trim().optional(),
  tipo: z.union([z.literal(""), z.enum(TIPOS_IMOVEL_VALUES)]),
  destinacao: z.union([z.literal(""), z.enum(DESTINACOES_IMOVEL_VALUES)]),
  finalidade: z.union([z.literal(""), z.enum(FINALIDADES_IMOVEL_VALUES)]),
  status: z
    .enum(
      [
        "em_cadastro",
        "aguardando_aprovacao",
        "disponivel",
        "reservado",
        "vendido",
        "locado",
        "desativado",
        "desativado_temporariamente",
      ],
      {
        error: "Selecione o status.",
      },
    )
    .optional(),
  // Definido automaticamente no cadastro/aprovação; obrigatório só ao alterar status operacional (após aprovação).
  status_imovel_id: z.preprocess(
    (value) =>
      value === "" || value === undefined || value === null ? undefined : value,
    z.string().uuid({ error: "Selecione o status." }).optional(),
  ),
  cep: z
    .string()
    .trim()
    .min(8, "Informe um CEP válido.")
    .max(9, "CEP inválido."),
  logradouro: z.string().trim().min(1, "Informe o logradouro."),
  numero: z.string().trim().min(1, "Informe o número."),
  complemento: z.string().trim().optional(),
  complemento_tipo: z.string().trim().optional(),
  complemento_numero: z.string().trim().optional(),
  complemento_torre: z.string().trim().optional(),
  condominio_nome: z.string().trim().optional(),
  bairro: z.string().trim().min(1, "Informe o bairro."),
  cidade: z.string().trim().min(1, "Informe a cidade."),
  estado: z
    .string()
    .trim()
    .length(2, "Informe a UF com 2 letras.")
    .transform((value) => value.toUpperCase()),
  latitude: coordNumber("Latitude inválida."),
  longitude: coordNumber("Longitude inválida."),
  portal_endereco_diferente: z.boolean(),
  portal_logradouro: z.string().trim().optional(),
  portal_numero: z.string().trim().optional(),
  portal_bairro: z.string().trim().optional(),
  portal_cep: z.string().trim().optional(),
  portal_cidade: z.string().trim().optional(),
  portal_estado: z.string().trim().optional(),
  local_chaves: localChavesEnum.optional().default("imobiliaria"),
  chaves_codigo: z.string().trim().optional(),
  chaves_descricao: z.string().trim().optional(),
  exclusividade: z.boolean(),
  imovel_ocupado: z.boolean(),
  contrato_aluguel_ativo: z.boolean(),
  aceita_financiamento: z.boolean(),
  aceita_permuta: z.boolean(),
  imovel_na_planta: z.boolean(),
  area_util: nullableNumber("Área útil inválida."),
  area_total: nullableNumber("Área total inválida."),
  ano_construcao: nullableNumber("Ano de construção inválido."),
  quartos: nullableInteger(),
  suites: nullableInteger(),
  salas: nullableInteger(),
  banheiros: nullableInteger(),
  elevadores: nullableInteger(),
  vagas: nullableInteger(),
  vagas_tipo: z.string().trim().optional(),
  vagas_cobertura: z.string().trim().optional(),
  valor_venda: optionalNumber("Valor de venda/locação inválido."),
  valor_locacao: optionalNumber("Valor de venda/locação inválido."),
  valor_condominio: optionalNumber("Valor do condomínio inválido."),
  valor_iptu: optionalNumber("Valor do IPTU inválido."),
  comissao_percent: optionalNumber("Comissão inválida."),
  descricao: z.string().trim().optional(),
  diferenciais: z.array(z.string()),
  video_url: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || value.startsWith("http://") || value.startsWith("https://"),
      "Informe uma URL válida (http ou https).",
    ),
  publicado_site: z.boolean(),
  destaque_site: z.boolean(),
  publicado_portais: z.boolean(),
  exibir_endereco_site: z.enum(["completo", "apenas_bairro", "oculto"]),
  exibir_endereco_portais: z.enum(["completo", "apenas_bairro", "oculto"]),
  cliente_id: z.string().uuid().optional().nullable(),
  proprietario_ids: z.array(z.string().uuid()),
  captadores: z.array(captadorFormItemSchema).min(1, "Selecione ao menos um captador."),
  captador_id: z.string().optional(),
  proprietario_novo: proprietarioNovoSchema.optional().nullable(),
});

export function isTerrenoOuComercial(tipo: string): boolean {
  return tipo === "terreno" || tipo === "comercial";
}

export function isCasaOuTerreno(tipo: string): boolean {
  return tipo === "casa" || tipo === "terreno";
}

export function isResidencialComQuartos(tipo: string): boolean {
  return (
    tipo === "casa" ||
    tipo === "apartamento" ||
    tipo === "cobertura" ||
    tipo === "studio"
  );
}

function refineProprietarioCaptador(
  data: z.infer<typeof imovelFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (data.proprietario_ids.length === 0 && !data.proprietario_novo) {
    context.addIssue({
      code: "custom",
      message: "Vincule ou cadastre um proprietário.",
      path: ["cliente_id"],
    });
  }

  if (
    data.proprietario_novo &&
    data.proprietario_novo.eh_construtor_investidor === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "Informe se é construtor ou investidor.",
      path: ["proprietario_novo", "eh_construtor_investidor"],
    });
  }

  const principais = data.captadores.filter((item) => item.principal);
  if (data.captadores.length > 1 && principais.length !== 1) {
    context.addIssue({
      code: "custom",
      message: "Selecione o captador principal.",
      path: ["captadores"],
    });
  }

  const perfisUsados = new Set<string>();
  for (const captador of data.captadores) {
    if (captador.externo) {
      if (!captador.nome_externo?.trim()) {
        context.addIssue({
          code: "custom",
          message: "Informe o nome do corretor parceiro externo.",
          path: ["captadores"],
        });
      }
    } else if (!captador.perfil_id) {
      context.addIssue({
        code: "custom",
        message: "Selecione o captador.",
        path: ["captadores"],
      });
    } else if (perfisUsados.has(captador.perfil_id)) {
      context.addIssue({
        code: "custom",
        message: "Não é possível repetir o mesmo captador.",
        path: ["captadores"],
      });
    } else {
      perfisUsados.add(captador.perfil_id);
    }
  }
}

function refineComplementoCadastro(
  data: z.infer<typeof imovelFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (!isCasaOuTerreno(data.tipo) && !data.complemento_tipo?.trim()) {
    context.addIssue({
      code: "custom",
      message: "Selecione o tipo de complemento.",
      path: ["complemento_tipo"],
    });
  }

  if (!isCasaOuTerreno(data.tipo) && !data.complemento_numero?.trim()) {
    context.addIssue({
      code: "custom",
      message: "Informe o complemento/identificação.",
      path: ["complemento_numero"],
    });
  }
}

function refineValorFinalidade(
  data: z.infer<typeof imovelFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (data.finalidade === "venda" && (data.valor_venda === null || data.valor_venda <= 0)) {
    context.addIssue({
      code: "custom",
      message: "Informe o valor de venda/locação.",
      path: ["valor_venda"],
    });
  }

  if (data.finalidade === "locacao" && (data.valor_locacao === null || data.valor_locacao <= 0)) {
    context.addIssue({
      code: "custom",
      message: "Informe o valor de venda/locação.",
      path: ["valor_locacao"],
    });
  }
}

function refineRequiredSelects(
  data: z.infer<typeof imovelFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (data.tipo === "") {
    context.addIssue({
      code: "custom",
      message: "Selecione o tipo do imóvel.",
      path: ["tipo"],
    });
  }

  if (data.finalidade === "") {
    context.addIssue({
      code: "custom",
      message: "Selecione a finalidade.",
      path: ["finalidade"],
    });
  }

  if (data.destinacao === "") {
    context.addIssue({
      code: "custom",
      message: "Selecione a destinação.",
      path: ["destinacao"],
    });
  }
}

/** Documento I: quartos obrigatórios no cadastro inicial para todos os tipos. */
function refineQuartosCadastro(
  data: z.infer<typeof imovelFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (data.quartos === null || data.quartos < 1) {
    context.addIssue({
      code: "custom",
      message: "Informe a quantidade de quartos.",
      path: ["quartos"],
    });
  }
}

/** Documento I: vagas obrigatórias no cadastro inicial (pode ser 0). */
function refineVagasCadastro(
  data: z.infer<typeof imovelFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (data.vagas === null) {
    context.addIssue({
      code: "custom",
      message: "Informe a quantidade de vagas.",
      path: ["vagas"],
    });
  }
}

/** Validação mínima para salvar o cadastro inicial. */
export const imovelCadastroSchema = imovelFieldsSchema.superRefine((data, context) => {
  refineRequiredSelects(data, context);
  refineValorFinalidade(data, context);
  refineComplementoCadastro(data, context);
  refineQuartosCadastro(data, context);
  refineVagasCadastro(data, context);
  refineProprietarioCaptador(data, context);
});

/** @deprecated Use imovelCadastroSchema para salvar e validateImovelParaAprovacao para envio. */
export const imovelFormSchema = imovelCadastroSchema;

export type ImovelFormValues = z.infer<typeof imovelFieldsSchema>;
export type CaptadorFormItem = z.infer<typeof captadorFormItemSchema>;

export type ImovelValidationIssue = {
  path: keyof ImovelFormValues | string;
  message: string;
  label: string;
};

export type ImovelValidationResult =
  | { success: true }
  | { success: false; errors: ImovelValidationIssue[]; message: string };

const FIELD_LABELS: Partial<Record<keyof ImovelFormValues, string>> = {
  tipo: "Tipo",
  finalidade: "Finalidade",
  destinacao: "Destinação",
  status_imovel_id: "Status",
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  complemento_tipo: "Tipo de complemento",
  complemento_numero: "Complemento/Identificação",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado (UF)",
  cliente_id: "Proprietário",
  captadores: "Captador",
  quartos: "Quartos",
  vagas: "Vagas",
  valor_venda: "Valor de venda/locação",
  valor_locacao: "Valor de venda/locação",
  local_chaves: "Local das chaves",
  chaves_codigo: "Código/número da chave",
  chaves_descricao: "Descrição do local das chaves",
  area_util: "Área útil",
  area_total: "Área total/Área do terreno",
  ano_construcao: "Ano de construção",
  banheiros: "Banheiros",
  vagas_tipo: "Tipo de vaga",
  vagas_cobertura: "Cobertura da vaga",
  valor_condominio: "Condomínio",
  valor_iptu: "IPTU",
  comissao_percent: "Comissão",
  titulo: "Título",
  descricao: "Descrição",
  exibir_endereco_site: "Exibir endereço (site)",
  exibir_endereco_portais: "Exibir endereço (portais)",
  portal_cep: "CEP para portais",
  portal_logradouro: "Logradouro para portais",
  portal_numero: "Número para portais",
  portal_bairro: "Bairro para portais",
  portal_cidade: "Cidade para portais",
  portal_estado: "Estado para portais",
};

function buildValidationMessage(errors: ImovelValidationIssue[]): string {
  const labels = [...new Set(errors.map((item) => item.label))];
  return `Preencha os campos obrigatórios: ${labels.join(", ")}.`;
}

function issue(
  path: keyof ImovelFormValues | string,
  message: string,
  label?: string,
): ImovelValidationIssue {
  const resolvedLabel =
    label ??
    FIELD_LABELS[path as keyof ImovelFormValues] ??
    String(path);
  return { path, message, label: resolvedLabel };
}

function refinePortalEnderecoAprovacao(
  data: ImovelFormValues,
  errors: ImovelValidationIssue[],
) {
  if (!data.portal_endereco_diferente) {
    return;
  }

  if (!data.portal_cep?.trim() || data.portal_cep.replace(/\D/g, "").length < 8) {
    errors.push(issue("portal_cep", "Informe o CEP para portais."));
  }
  if (!data.portal_logradouro?.trim()) {
    errors.push(issue("portal_logradouro", "Informe o logradouro para portais."));
  }
  if (!data.portal_numero?.trim()) {
    errors.push(issue("portal_numero", "Informe o número para portais."));
  }
  if (!data.portal_bairro?.trim()) {
    errors.push(issue("portal_bairro", "Informe o bairro para portais."));
  }
  if (!data.portal_cidade?.trim()) {
    errors.push(issue("portal_cidade", "Informe a cidade para portais."));
  }
  if (!data.portal_estado?.trim() || data.portal_estado.length !== 2) {
    errors.push(issue("portal_estado", "Informe a UF para portais."));
  }
}

/** Validação completa para enviar o imóvel para aprovação. */
export function validateImovelParaAprovacao(
  data: ImovelFormValues,
  options?: { fotosCount?: number },
): ImovelValidationResult {
  const cadastro = imovelCadastroSchema.safeParse(data);
  const errors: ImovelValidationIssue[] = [];

  if (!cadastro.success) {
    for (const item of cadastro.error.issues) {
      const path = String(item.path[0] ?? "form");
      errors.push(
        issue(
          path,
          item.message,
          FIELD_LABELS[path as keyof ImovelFormValues],
        ),
      );
    }
  }

  if (!data.titulo?.trim() || data.titulo.trim().length < 3) {
    errors.push(issue("titulo", "Informe o título (mínimo 3 caracteres)."));
  }

  if (!data.descricao?.trim()) {
    errors.push(issue("descricao", "Informe a descrição."));
  }

  if (!data.local_chaves) {
    errors.push(issue("local_chaves", "Selecione o local das chaves."));
  }

  if (data.local_chaves === "imobiliaria" && !data.chaves_codigo?.trim()) {
    errors.push(issue("chaves_codigo", "Informe o código/número da chave."));
  }

  if (data.local_chaves === "outros" && !data.chaves_descricao?.trim()) {
    errors.push(issue("chaves_descricao", "Informe a descrição do local das chaves."));
  }

  if (data.tipo !== "terreno" && (data.area_util === null || data.area_util <= 0)) {
    errors.push(issue("area_util", "Informe a área útil."));
  }

  if (data.area_total === null || data.area_total <= 0) {
    errors.push(issue("area_total", "Informe a área total/Área do terreno."));
  }

  if (data.ano_construcao === null || data.ano_construcao <= 0) {
    errors.push(issue("ano_construcao", "Informe o ano de construção."));
  }

  if (isResidencialComQuartos(data.tipo) && (data.banheiros === null || data.banheiros < 1)) {
    errors.push(issue("banheiros", "Informe a quantidade de banheiros."));
  }

  if (data.vagas === null) {
    errors.push(issue("vagas", "Informe a quantidade de vagas."));
  }

  if (!data.vagas_tipo?.trim()) {
    errors.push(issue("vagas_tipo", "Selecione o tipo de vaga."));
  }

  if (!data.vagas_cobertura?.trim()) {
    errors.push(issue("vagas_cobertura", "Selecione a cobertura da vaga."));
  }

  if (!isCasaOuTerreno(data.tipo) && data.valor_condominio === null) {
    errors.push(issue("valor_condominio", "Informe o valor do condomínio."));
  }

  if (data.valor_iptu === null || data.valor_iptu <= 0) {
    errors.push(issue("valor_iptu", "Informe o valor do IPTU."));
  }

  if (data.comissao_percent === null || data.comissao_percent <= 0) {
    errors.push(issue("comissao_percent", "Informe a comissão."));
  }

  if (data.publicado_site && !data.exibir_endereco_site) {
    errors.push(issue("exibir_endereco_site", "Selecione como exibir o endereço no site."));
  }

  if (data.publicado_portais && !data.exibir_endereco_portais) {
    errors.push(issue("exibir_endereco_portais", "Selecione como exibir o endereço nos portais."));
  }

  refinePortalEnderecoAprovacao(data, errors);

  const fotosCount = options?.fotosCount ?? 0;
  if (fotosCount < 1) {
    errors.push(
      issue("fotos", "Adicione ao menos uma foto.", "Fotos"),
    );
  }

  if (errors.length === 0) {
    return { success: true };
  }

  const uniqueErrors = errors.filter(
    (item, index, list) =>
      list.findIndex(
        (other) => other.path === item.path && other.message === item.message,
      ) === index,
  );

  return {
    success: false,
    errors: uniqueErrors,
    message: buildValidationMessage(uniqueErrors),
  };
}

export const imovelFormDefaultValues: ImovelFormValues = {
  titulo: "",
  codigo_personalizado: "",
  tipo: "",
  destinacao: "",
  finalidade: "",
  status: "em_cadastro",
  status_imovel_id: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  complemento_tipo: "",
  complemento_numero: "",
  complemento_torre: "",
  condominio_nome: "",
  bairro: "",
  cidade: "",
  estado: "",
  latitude: null,
  longitude: null,
  portal_endereco_diferente: false,
  portal_logradouro: "",
  portal_numero: "",
  portal_bairro: "",
  portal_cep: "",
  portal_cidade: "",
  portal_estado: "",
  local_chaves: "imobiliaria",
  chaves_codigo: "",
  chaves_descricao: "",
  exclusividade: false,
  imovel_ocupado: false,
  contrato_aluguel_ativo: false,
  aceita_financiamento: false,
  aceita_permuta: false,
  imovel_na_planta: false,
  area_util: null,
  area_total: null,
  ano_construcao: null,
  quartos: null,
  suites: null,
  salas: null,
  banheiros: null,
  elevadores: null,
  vagas: null,
  vagas_tipo: "",
  vagas_cobertura: "",
  valor_venda: null,
  valor_locacao: null,
  valor_condominio: null,
  valor_iptu: null,
  comissao_percent: null,
  descricao: "",
  diferenciais: [],
  video_url: "",
  publicado_site: true,
  destaque_site: false,
  publicado_portais: false,
  exibir_endereco_site: "apenas_bairro",
  exibir_endereco_portais: "apenas_bairro",
  cliente_id: null,
  proprietario_ids: [],
  captadores: [],
  captador_id: "",
  proprietario_novo: null,
};
