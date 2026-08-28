export type ImoveisViewMode = "grid" | "list";

export type ImoveisSortOption =
  | "valor_desc"
  | "valor_asc"
  | "publicacao_desc"
  | "publicacao_asc"
  | "cadastro_desc"
  | "cadastro_asc"
  | "bairro_asc"
  | "captador_asc"
  | "area_desc"
  | "area_asc";

export const IMOVEIS_SORT_OPTIONS: { value: ImoveisSortOption; label: string }[] = [
  { value: "valor_desc", label: "Valor (maior)" },
  { value: "valor_asc", label: "Valor (menor)" },
  { value: "publicacao_desc", label: "Publicação (mais recente)" },
  { value: "publicacao_asc", label: "Publicação (mais antigo)" },
  { value: "cadastro_desc", label: "Cadastro (mais recente)" },
  { value: "cadastro_asc", label: "Cadastro (mais antigo)" },
  { value: "bairro_asc", label: "Bairro (A-Z)" },
  { value: "captador_asc", label: "Captador (A-Z)" },
  { value: "area_desc", label: "Área útil (maior)" },
  { value: "area_asc", label: "Área útil (menor)" },
];

export const IMOVEIS_SORT_VALUES = new Set(IMOVEIS_SORT_OPTIONS.map((item) => item.value));
