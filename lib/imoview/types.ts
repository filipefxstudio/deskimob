import type { LocalChaves, StatusImovelSlug, TipoImovel } from "@/types";

/** Linha bruta do XLS Imoview (colunas relevantes) */
export type XlsRow = {
  Codigo?: string | number;
  Finalidade?: string;
  Tipo?: string;
  Situacao?: string;
  MotivoDesativacao?: string;
  Cep?: string | number;
  Endereco?: string;
  EnderecoNumero?: string | number;
  Complemento?: string;
  Bairro?: string;
  Cidade?: string;
  Estado?: string;
  Descricao?: string;
  NumeroQuarto?: string | number;
  NumeroSuite?: string | number;
  NumeroBanheiro?: string | number;
  NumeroVaga?: string | number;
  NumeroSala?: string | number;
  NumeroElevador?: string | number;
  Exclusivo?: string;
  NaPlanta?: string;
  Valor?: string | number;
  ValorCondominio?: string | number;
  ValorIptu?: string | number;
  AreaInterna?: string | number;
  AreaLote?: string | number;
  LocalChave?: string;
  IdenticadorChave?: string;
  DataCadastro?: string | number;
  DataHoraUltimaAlteracao?: string | number;
  TipoVaga?: string;
  Idade?: string;
  Destinacao?: string;
  ExibirMeuSite?: string;
  Proprietarios?: string;
  [key: string]: unknown;
};

export type ParsedProprietario = {
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
};

export type ImportOptions = {
  limit?: number;
  exportYear?: number;
  skipPhotos?: boolean;
  storageConfirmed?: boolean;
  supabasePlan?: "free" | "pro";
};

export type AnalyzeResponse = {
  spreadsheet: {
    totalRows: number;
    bySituacao: Record<string, number>;
    proprietariosSemTelefone: number;
    byTipo: Record<string, number>;
    exportYear: number;
  };
  photos: {
    eligibleCount: number;
    totalPhotoCount: number;
    sampleSize: number;
    avgBytesPerPhoto: number;
    p90BytesPerPhoto: number;
    estimatedBytes: number;
    estimatedLabel: string;
  };
  storage: {
    plan: "free" | "pro";
    limitBytes: number;
    usedBytes: number;
    projectedBytes: number;
    percentUsed: number;
    status: "green" | "yellow" | "red";
    recommendation: string;
  };
  database: {
    estimatedNewBytes: number;
    limitBytes: number;
    status: "green";
  };
};

export type MappedImovelInsert = {
  codigo: string;
  titulo: string;
  slug: string;
  tipo: TipoImovel;
  finalidade: "venda";
  status: StatusImovelSlug;
  status_imovel_id: string;
  status_aprovacao: "em_cadastro" | "aprovado";
  motivo_desativacao: string | null;
  cep: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  complemento_valor: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  descricao: string | null;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  salas: number | null;
  elevadores: number | null;
  exclusividade: boolean;
  imovel_na_planta: boolean;
  valor_venda: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  area_util: number | null;
  area_total: number | null;
  local_chaves: LocalChaves | null;
  chaves_codigo: string | null;
  chaves_descricao: string | null;
  data_ativacao: string | null;
  data_ultima_atualizacao: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  vagas_tipo: string | null;
  ano_construcao: number | null;
  destinacao: "residencial" | "comercial" | "rural" | null;
  diferenciais: string[] | null;
  destaque_site: boolean;
  visualizacoes: number;
  publicado_portais: boolean;
  publicado_site: boolean;
  exibir_endereco_site: "apenas_bairro";
  exibir_endereco_portais: "apenas_bairro";
  imovel_ocupado: null;
  contrato_aluguel_ativo: null;
  aceita_financiamento: null;
  aceita_permuta: null;
  latitude: null;
  longitude: null;
  captador_id: string;
};

export type ImportRowResult = {
  codigo: string;
  status: "ok" | "skipped" | "error";
  message?: string;
  imovelId?: string;
  clienteCreated?: boolean;
  clienteReused?: boolean;
  semTelefone?: boolean;
};

export type ImportSummary = {
  imported: number;
  skipped: number;
  errors: number;
  clientesCreated: number;
  clientesReused: number;
  semTelefone: string[];
  results: ImportRowResult[];
};

export type ImobeeMetadata = {
  titulo: string;
  latitude: number | null;
  longitude: number | null;
  aceitaFinanciamento: boolean | null;
  aceitaPermuta: boolean | null;
  fotos: { url: string; descricao: string | null }[];
};
