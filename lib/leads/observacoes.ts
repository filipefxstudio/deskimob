const FX_META_START = "<!--fx-meta";
const FX_META_END = "-->";

export interface PerfilFinanceiroLead {
  renda_mensal?: string;
  valor_entrada?: string;
  financiamento_aprovado?: boolean;
  possui_imovel_venda?: boolean;
  observacoes?: string;
}

export interface LeadObservacoesMeta {
  perfil_id?: string | null;
  perfil_financeiro?: PerfilFinanceiroLead;
  imoveis_indicados?: string[];
  qualificado?: boolean;
  midia_nome?: string | null;
}

export function parseLeadObservacoes(observacoes: string | null | undefined): {
  meta: LeadObservacoesMeta;
  texto: string;
} {
  if (!observacoes?.trim()) {
    return { meta: {}, texto: "" };
  }

  const startIndex = observacoes.indexOf(FX_META_START);
  if (startIndex === -1) {
    return { meta: {}, texto: observacoes.trim() };
  }

  const endIndex = observacoes.indexOf(FX_META_END, startIndex);
  if (endIndex === -1) {
    return { meta: {}, texto: observacoes.trim() };
  }

  const jsonBlock = observacoes
    .slice(startIndex + FX_META_START.length, endIndex)
    .trim();

  let meta: LeadObservacoesMeta = {};

  try {
    meta = JSON.parse(jsonBlock) as LeadObservacoesMeta;
  } catch {
    meta = {};
  }

  const texto = observacoes.slice(endIndex + FX_META_END.length).trim();
  return { meta, texto };
}

export function serializeLeadObservacoes(
  meta: LeadObservacoesMeta,
  texto: string,
): string | null {
  const hasMeta =
    Boolean(meta.perfil_id) ||
    Boolean(meta.perfil_financeiro && Object.keys(meta.perfil_financeiro).length > 0) ||
    Boolean(meta.imoveis_indicados && meta.imoveis_indicados.length > 0) ||
    meta.qualificado === true ||
    Boolean(meta.midia_nome?.trim());

  const trimmedTexto = texto.trim();

  if (!hasMeta && !trimmedTexto) {
    return null;
  }

  if (!hasMeta) {
    return trimmedTexto;
  }

  const metaBlock = `${FX_META_START}\n${JSON.stringify(meta)}\n${FX_META_END}`;
  return trimmedTexto ? `${metaBlock}\n${trimmedTexto}` : metaBlock;
}

export function mergeLeadObservacoesMeta(
  observacoes: string | null | undefined,
  patch: Partial<LeadObservacoesMeta>,
): string | null {
  const { meta, texto } = parseLeadObservacoes(observacoes);
  return serializeLeadObservacoes({ ...meta, ...patch }, texto);
}
