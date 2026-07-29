import type { FinalidadeImovel, StatusImovelSlug, TipoImovel } from "@/types";

export const TIPOS_IMOVEL: { value: TipoImovel; label: string }[] = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "terreno", label: "Terreno" },
  { value: "comercial", label: "Comercial" },
  { value: "cobertura", label: "Cobertura" },
  { value: "studio", label: "Studio" },
];

export const FINALIDADES_IMOVEL: { value: FinalidadeImovel; label: string }[] = [
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Locação" },
];

export const STATUS_IMOVEL: { value: StatusImovelSlug; label: string }[] = [
  { value: "em_cadastro", label: "Em cadastro" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "locado", label: "Locado" },
  { value: "desativado", label: "Desativado" },
  { value: "desativado_temporariamente", label: "Desativado temporariamente" },
];

export const DIFERENCIAIS_OPCOES = [
  "Piscina",
  "Churrasqueira",
  "Portaria 24h",
  "Academia",
  "Elevador",
  "Varanda",
  "Sacada",
  "Área de lazer",
  "Playground",
  "Salão de festas",
  "Mobiliado",
  "Ar condicionado",
  "Vista para o mar",
  "Pet friendly",
  "Quintal",
  "Suíte master",
  "Closet",
  "Lavabo",
  "Depósito",
  "Vaga coberta",
] as const;

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const IMOVEL_LIMITS: Record<"basico" | "profissional" | "premium", number | null> = {
  basico: 30,
  profissional: null,
  premium: null,
};

export const STORAGE_BUCKET_IMOVEIS = "imoveis-fotos";

export const STORAGE_BUCKET_MARCA_DAGUA = "marca-dagua-logos";

export const MARCA_DAGUA_POSICOES = [
  { value: "centro", label: "Centro" },
  { value: "superior_esquerdo", label: "Superior esquerdo" },
  { value: "superior_direito", label: "Superior direito" },
  { value: "inferior_esquerdo", label: "Inferior esquerdo" },
  { value: "inferior_direito", label: "Inferior direito" },
] as const;

export const STATUS_NOME_TO_SLUG: Record<string, StatusImovelSlug> = {
  "Em cadastro": "em_cadastro",
  "Aguardando aprovação": "aguardando_aprovacao",
  Disponível: "disponivel",
  Reservado: "reservado",
  Vendido: "vendido",
  Locado: "locado",
  Desativado: "desativado",
};

export const STATUS_IMOVEL_WORKFLOW = ["Em cadastro", "Aguardando aprovação"] as const;

export const DESTINACOES_IMOVEL = [
  { value: "residencial" as const, label: "Residencial" },
  { value: "comercial" as const, label: "Comercial" },
  { value: "rural" as const, label: "Rural" },
];

export const EXIBIR_ENDERECO_OPCOES = [
  { value: "completo" as const, label: "Endereço completo" },
  { value: "apenas_bairro" as const, label: "Apenas bairro" },
  { value: "oculto" as const, label: "Oculto" },
];

export const MOTIVOS_DESATIVACAO = [
  "Proprietário desistiu da venda/locação",
  "Imóvel vendido por outra imobiliária",
  "Endereço ou dados incorretos",
  "Duplicidade de cadastro",
  "Proprietário solicitou remoção",
  "Outro",
] as const;

/** Status alterados automaticamente pelo sistema (fluxo de cadastro, proposta/negócio) */
export const STATUS_IMOVEL_SISTEMA = [
  ...STATUS_IMOVEL_WORKFLOW,
  "Reservado",
  "Vendido",
  "Locado",
] as const;

export const COMPLEMENTO_TIPOS = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "loja", label: "Loja" },
  { value: "sala", label: "Sala" },
  { value: "conjunto", label: "Conjunto" },
  { value: "galpao", label: "Galpão" },
  { value: "outro", label: "Outro" },
] as const;

/** Abreviações para exibição em cards e detalhes (cadastro mantém label completo). */
export const COMPLEMENTO_TIPO_ABREV: Record<string, string> = {
  apartamento: "Ap",
  casa: "Cs",
  loja: "Lj",
  sala: "Sl",
  conjunto: "Cj",
  galpao: "Gp",
};

export function abbreviateComplementoTipo(tipo: string): string {
  const normalized = tipo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return COMPLEMENTO_TIPO_ABREV[normalized] ?? tipo;
}

export const LOCAL_CHAVES_OPCOES = [
  { value: "imobiliaria", label: "Imobiliária" },
  { value: "proprietario", label: "Proprietário" },
  { value: "portaria", label: "Portaria" },
  { value: "outros", label: "Outros" },
] as const;

export const VAGAS_TIPO_OPCOES = [
  { value: "paralela", label: "Paralela" },
  { value: "em_linha", label: "Em linha" },
] as const;

export const VAGAS_COBERTURA_OPCOES = [
  { value: "coberta", label: "Coberta" },
  { value: "coberta_pilotis", label: "Coberta sob pilotis" },
  { value: "descoberta", label: "Descoberta" },
] as const;

export const DEFAULT_TIPOS_IMOVEL_CUSTOM = [
  "Apartamento",
  "Casa",
  "Cobertura",
  "Área privativa",
  "Studio",
  "Terreno",
  "Comercial",
  "Galpão",
] as const;

export const DEFAULT_MIDIAS_ORIGEM = [
  "Meta Ads",
  "Google Ads",
  "Grupo OLX",
  "Chaves na Mão",
  "Webimóveis",
  "Instagram orgânico",
  "Placa ou faixa",
  "Site",
  "Indicação",
  "WhatsApp direto",
] as const;

export const EQUIPE_LIMITE_USUARIOS = 5;
