import type { StatusImovelSlug } from "@/types";

/** Conta Imobee / Filipe — única autorizada a usar a ferramenta de importação */
export const IMOVIEW_IMPORT_CORRETOR_ID = "400bbcb9-4c2d-43c2-af04-f2b7996618b2";

/** Filipe — captador principal de todos os imóveis migrados */
export const IMOVIEW_CAPTADOR_PRINCIPAL_ID = "82d8eff4-4dc3-4169-9dc1-5b12b117b0e5";

export const STORAGE_ESTIMATE_CONFIG = {
  freeLimitBytes: 1_073_741_824,
  proLimitBytes: 107_374_182_400,
  warningThreshold: 0.7,
  blockThreshold: 0.9,
  safetyMargin: 1.1,
  photoSampleSize: 20,
  dbEstimateBytes: 35 * 1024 * 1024,
} as const;

export type ImoviewSituacao =
  | "Vago/Disponível"
  | "Desativado"
  | "Em moderação"
  | "Vendido"
  | "Em reforma"
  | "Alugado";

export const SITUACAO_STATUS_MAP: Record<
  ImoviewSituacao,
  { status: StatusImovelSlug; statusImovelId: string; statusAprovacao: "em_cadastro" | "aprovado" }
> = {
  "Vago/Disponível": {
    status: "disponivel",
    statusImovelId: "886e405f-2a34-43db-917b-3afed4cfb811",
    statusAprovacao: "aprovado",
  },
  Desativado: {
    status: "desativado",
    statusImovelId: "1e1cfa9b-75bb-4765-b093-3b7d605dce09",
    statusAprovacao: "aprovado",
  },
  "Em moderação": {
    status: "em_cadastro",
    statusImovelId: "41b57bea-3b66-4ea9-b66f-903066112266",
    statusAprovacao: "em_cadastro",
  },
  Vendido: {
    status: "vendido",
    statusImovelId: "3a056eb6-9397-4255-add5-41ea35fbcf68",
    statusAprovacao: "aprovado",
  },
  "Em reforma": {
    status: "desativado_temporariamente" as StatusImovelSlug,
    statusImovelId: "dd9caa14-43e7-495e-9612-6c6a9875b530",
    statusAprovacao: "aprovado",
  },
  Alugado: {
    status: "locado",
    statusImovelId: "92042a1a-1ba2-4d82-a84a-68a9107d3411",
    statusAprovacao: "aprovado",
  },
};

export const IMOBIEE_API_URL = "https://www.imobee.net/imoveis/codigos/";

export const IMOBEE_RATE_LIMIT_MS = 200;

/** Situações excluídas da migração (Documento N) */
export const IMOVIEW_EXCLUDED_SITUACOES = ["Desativado"] as const;

export const IMOBEE_SITE_BASE = "https://www.imobee.net";
