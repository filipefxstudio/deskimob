import type { Imovel, ImovelFoto, StatusImovel } from "@/types";
import {
  imovelFormDefaultValues,
  type CaptadorFormItem,
  type ImovelFormValues,
} from "@/lib/validations/imovel";
import type { FotoItem } from "@/components/imoveis/FotoUpload";

/** Converte valor do banco para o formulário; 0 legado vira vazio, exceto quando 0 é válido (vagas). */
function numericFromDb(
  value: number | null | undefined,
  options?: { allowZero?: boolean },
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!options?.allowZero && value === 0) {
    return null;
  }
  return value;
}

function buildComplementoLegacy(imovel: Imovel): string {
  if (imovel.complemento_tipo || imovel.complemento_numero) {
    const parts: string[] = [];
    if (imovel.complemento_tipo && imovel.complemento_numero) {
      parts.push(`${imovel.complemento_tipo} ${imovel.complemento_numero}`);
    } else if (imovel.complemento_numero) {
      parts.push(imovel.complemento_numero);
    } else if (imovel.complemento_tipo) {
      parts.push(imovel.complemento_tipo);
    }
    if (imovel.complemento_torre) {
      parts.push(imovel.complemento_torre);
    }
    return parts.join(", ");
  }

  if (imovel.complemento) {
    return imovel.complemento;
  }

  return "";
}

function captadoresToFormItems(imovel: Imovel): CaptadorFormItem[] {
  const captadores = imovel.captadores ?? [];

  if (captadores.length > 0) {
    return captadores.map((item) => ({
      id: item.id,
      perfil_id: item.perfil_id ?? null,
      nome_externo: item.nome_externo ?? null,
      principal: item.principal,
      externo: !item.perfil_id,
    }));
  }

  if (imovel.captador_id) {
    return [
      {
        id: crypto.randomUUID(),
        perfil_id: imovel.captador_id,
        nome_externo: null,
        principal: true,
        externo: false,
      },
    ];
  }

  return [];
}

export interface ProprietarioFormItem {
  id: string;
  nome: string;
  telefone: string;
}

function proprietarioIdsFromImovel(imovel: Imovel): string[] {
  const ids: string[] = [];

  if (imovel.cliente_id) {
    ids.push(imovel.cliente_id);
  }

  for (const item of imovel.proprietarios ?? []) {
    if (item.cliente_id && !ids.includes(item.cliente_id)) {
      ids.push(item.cliente_id);
    }
  }

  return ids;
}

export function proprietariosFromImovel(imovel: Imovel): ProprietarioFormItem[] {
  const ids = proprietarioIdsFromImovel(imovel);
  const byId = new Map<string, ProprietarioFormItem>();

  if (imovel.cliente_id && imovel.cliente) {
    byId.set(imovel.cliente_id, {
      id: imovel.cliente_id,
      nome: imovel.cliente.nome,
      telefone: imovel.cliente.telefone,
    });
  }

  for (const item of imovel.proprietarios ?? []) {
    if (item.cliente_id && item.cliente) {
      byId.set(item.cliente_id, {
        id: item.cliente_id,
        nome: item.cliente.nome,
        telefone: item.cliente.telefone,
      });
    }
  }

  return ids.map(
    (id) => byId.get(id) ?? { id, nome: "Proprietário vinculado", telefone: "" },
  );
}

export function resolveStatusEmCadastroId(statusList: StatusImovel[]): string {
  const byNome = statusList.find((status) => status.nome === "Em cadastro");
  if (byNome) {
    return byNome.id;
  }

  return statusList.find((status) => status.ordem === -2)?.id ?? "";
}

export function buildImovelFormDefaultValues(
  statusList: StatusImovel[] = [],
): ImovelFormValues {
  return {
    ...imovelFormDefaultValues,
    status_imovel_id: resolveStatusEmCadastroId(statusList),
  };
}

export function imovelToFormValues(imovel: Imovel): ImovelFormValues {
  const proprietarioIds = proprietarioIdsFromImovel(imovel);
  const captadores = captadoresToFormItems(imovel);

  return {
    titulo: imovel.titulo ?? "",
    codigo_personalizado: imovel.codigo_personalizado ?? "",
    tipo: imovel.tipo,
    destinacao: imovel.destinacao ?? "residencial",
    finalidade: imovel.finalidade,
    status: imovel.status,
    status_imovel_id: imovel.status_imovel_id ?? "",
    cep: imovel.cep ?? "",
    logradouro: imovel.logradouro ?? "",
    numero: imovel.numero ?? "",
    complemento: buildComplementoLegacy(imovel),
    complemento_tipo: imovel.complemento_tipo ?? "",
    complemento_numero: imovel.complemento_numero ?? "",
    complemento_torre: imovel.complemento_torre ?? "",
    condominio_nome: imovel.condominio_nome ?? "",
    bairro: imovel.bairro ?? "",
    cidade: imovel.cidade ?? "",
    estado: imovel.estado ?? "",
    latitude: imovel.latitude ?? null,
    longitude: imovel.longitude ?? null,
    portal_endereco_diferente: imovel.portal_endereco_diferente ?? false,
    portal_logradouro: imovel.portal_logradouro ?? "",
    portal_numero: imovel.portal_numero ?? "",
    portal_bairro: imovel.portal_bairro ?? "",
    portal_cep: imovel.portal_cep ?? "",
    portal_cidade: imovel.portal_cidade ?? "",
    portal_estado: imovel.portal_estado ?? "",
    local_chaves: imovel.local_chaves ?? "imobiliaria",
    chaves_codigo: imovel.chaves_codigo ?? "",
    chaves_descricao: imovel.chaves_descricao ?? "",
    exclusividade: imovel.exclusividade ?? false,
    imovel_ocupado: imovel.imovel_ocupado ?? false,
    contrato_aluguel_ativo: imovel.contrato_aluguel_ativo ?? false,
    aceita_financiamento: imovel.aceita_financiamento ?? false,
    aceita_permuta: imovel.aceita_permuta ?? false,
    imovel_na_planta: imovel.imovel_na_planta ?? false,
    area_util: numericFromDb(imovel.area_util),
    area_total: numericFromDb(imovel.area_total),
    ano_construcao: numericFromDb(imovel.ano_construcao),
    quartos: numericFromDb(imovel.quartos),
    suites: numericFromDb(imovel.suites),
    salas: numericFromDb(imovel.salas),
    banheiros: numericFromDb(imovel.banheiros),
    elevadores: numericFromDb(imovel.elevadores),
    vagas: numericFromDb(imovel.vagas, { allowZero: true }),
    vagas_tipo: imovel.vagas_tipo ?? "",
    vagas_cobertura: imovel.vagas_cobertura ?? "",
    valor_venda: imovel.valor_venda ?? null,
    valor_locacao: imovel.valor_locacao ?? null,
    valor_condominio: numericFromDb(imovel.valor_condominio),
    valor_iptu: numericFromDb(imovel.valor_iptu),
    comissao_percent: numericFromDb(imovel.comissao_percent),
    descricao: imovel.descricao ?? "",
    diferenciais: imovel.diferenciais ?? [],
    video_url: imovel.video_url ?? "",
    publicado_site: imovel.publicado_site,
    destaque_site: imovel.destaque_site ?? false,
    publicado_portais: imovel.publicado_portais ?? false,
    exibir_endereco_site: imovel.exibir_endereco_site ?? "apenas_bairro",
    exibir_endereco_portais: imovel.exibir_endereco_portais ?? "apenas_bairro",
    cliente_id: proprietarioIds[0] ?? imovel.cliente_id ?? null,
    proprietario_ids: proprietarioIds,
    captadores,
    captador_id: imovel.captador_id ?? "",
    proprietario_novo: null,
  };
}

export function fotosToFotoItems(fotos: ImovelFoto[]): FotoItem[] {
  return [...fotos]
    .sort((a, b) => a.ordem - b.ordem)
    .map((foto, index) => ({
      id: foto.id,
      existingId: foto.id,
      previewUrl: foto.url,
      legenda: foto.legenda ?? "",
      ordem: index,
    }));
}

export function buildComplementoString(values: ImovelFormValues): string {
  const parts: string[] = [];
  if (values.complemento_tipo && values.complemento_numero) {
    parts.push(`${values.complemento_tipo} ${values.complemento_numero}`);
  }
  if (values.complemento_torre) {
    parts.push(values.complemento_torre);
  }
  if (values.condominio_nome) {
    parts.push(values.condominio_nome);
  }
  return parts.join(" — ") || values.complemento?.trim() || "";
}

export function getCaptadorPrincipalId(captadores: CaptadorFormItem[]): string | null {
  const principal = captadores.find((item) => item.principal) ?? captadores[0];
  return principal?.externo ? null : principal?.perfil_id ?? null;
}
