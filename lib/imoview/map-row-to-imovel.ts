import { TIPOS_IMOVEL } from "@/lib/constants/imoveis";
import { resolveStatusFromSituacao, type StatusImovelLookup } from "@/lib/imoview/import-target";
import { extractDiferenciais } from "@/lib/imoview/diferenciais-map";
import { mapComplementoFromImoview } from "@/lib/imoview/map-complemento";
import {
  mapDestinacao,
  mapLocalChaves,
  mapTipoImoview,
  mapVagasTipo,
  parseIntField,
  parseOptionalInt,
  sanitizeCep,
} from "@/lib/imoview/normalize-enums";
import { parseArea } from "@/lib/imoview/parse-area";
import { parseDataBr } from "@/lib/imoview/parse-data-br";
import { parseIdadeToAnoConstrucao } from "@/lib/imoview/parse-idade";
import { parseMoneyBr } from "@/lib/imoview/parse-money";
import { isSim, normalizeCodigo } from "@/lib/imoview/parse-xls";
import type { MappedImovelInsert, XlsRow } from "@/lib/imoview/types";
import { generateImovelSlug } from "@/lib/utils";

export function generateAutoTitulo(row: XlsRow): string {
  const { tipo } = mapTipoImoview(row.Tipo);
  const tipoLabel = TIPOS_IMOVEL.find((t) => t.value === tipo)?.label ?? row.Tipo ?? "Imóvel";
  const bairro = String(row.Bairro ?? "").trim();
  const area = parseArea(row.AreaInterna);
  const quartos = parseIntField(row.NumeroQuarto, 0);

  const parts: string[] = [`${tipoLabel} em ${bairro || "local não informado"}`];
  if (area) parts.push(`${area}m²`);
  if (quartos > 0) parts.push(`${quartos} quartos`);

  return parts.join(", ");
}

export function mapRowToImovel(
  row: XlsRow,
  exportYear: number,
  slug: string,
  context: {
    captadorPerfilId: string;
    statusImovelLookup: StatusImovelLookup;
  },
): { mapped: MappedImovelInsert; warnings: string[] } {
  const warnings: string[] = [];
  const codigo = normalizeCodigo(row.Codigo);
  const situacaoRaw = String(row.Situacao ?? "").trim();
  const statusResolved = resolveStatusFromSituacao(situacaoRaw, context.statusImovelLookup);
  if (statusResolved.warning) warnings.push(statusResolved.warning);
  const { tipo, warning: tipoWarning } = mapTipoImoview(row.Tipo);
  if (tipoWarning) warnings.push(tipoWarning);

  const { local_chaves, chaves_descricao } = mapLocalChaves(row.LocalChave);
  const chavesCodigo =
    local_chaves === "imobiliaria" ? String(row.IdenticadorChave ?? "").trim() || null : null;

  const complementoRaw = String(row.Complemento ?? "").trim();
  const blocoCol = String(row.Bloco ?? "").trim();
  const complementoMapped = mapComplementoFromImoview(
    complementoRaw || null,
    tipo,
    blocoCol || null,
  );
  const titulo = generateAutoTitulo(row);
  const dataCadastro = parseDataBr(row.DataCadastro);
  const dataUltimaAlteracao = parseDataBr(row.DataHoraUltimaAlteracao);

  const mapped: MappedImovelInsert = {
    codigo,
    titulo,
    slug,
    tipo,
    finalidade: "venda",
    status: statusResolved.status,
    status_imovel_id: statusResolved.statusImovelId,
    status_aprovacao: statusResolved.statusAprovacao,
    motivo_desativacao: String(row.MotivoDesativacao ?? "").trim() || null,
    cep: sanitizeCep(row.Cep),
    logradouro: String(row.Endereco ?? "").trim() || "—",
    numero: String(row.EnderecoNumero ?? "").trim() || "S/N",
    complemento: complementoMapped.complemento,
    complemento_valor: complementoMapped.complemento_valor,
    complemento_tipo: complementoMapped.complemento_tipo,
    complemento_numero: complementoMapped.complemento_numero,
    complemento_torre: complementoMapped.complemento_torre,
    bairro: String(row.Bairro ?? "").trim() || "—",
    cidade: String(row.Cidade ?? "").trim() || "—",
    estado: String(row.Estado ?? "").trim().toUpperCase().slice(0, 2) || "SC",
    descricao: String(row.Descricao ?? "").trim() || null,
    quartos: parseIntField(row.NumeroQuarto, 0),
    suites: parseIntField(row.NumeroSuite, 0),
    banheiros: parseIntField(row.NumeroBanheiro, 0),
    vagas: parseIntField(row.NumeroVaga, 0),
    salas: parseOptionalInt(row.NumeroSala),
    elevadores: parseOptionalInt(row.NumeroElevador),
    exclusividade: isSim(row.Exclusivo),
    imovel_na_planta: isSim(row.NaPlanta),
    valor_venda: parseMoneyBr(row.Valor),
    valor_condominio: parseMoneyBr(row.ValorCondominio),
    valor_iptu: parseMoneyBr(row.ValorIptu),
    area_util: parseArea(row.AreaInterna),
    area_total: parseArea(row.AreaLote),
    local_chaves,
    chaves_codigo: chavesCodigo,
    chaves_descricao,
    data_ativacao: dataCadastro,
    data_ultima_atualizacao: dataUltimaAlteracao,
    criado_em: dataCadastro,
    atualizado_em: dataUltimaAlteracao ?? dataCadastro,
    vagas_tipo: mapVagasTipo(row.TipoVaga),
    ano_construcao: parseIdadeToAnoConstrucao(row.Idade, exportYear),
    destinacao: mapDestinacao(row.Destinacao),
    diferenciais: (() => {
      const d = extractDiferenciais(row);
      return d.length > 0 ? d : null;
    })(),
    destaque_site: false,
    visualizacoes: 0,
    publicado_portais: false,
    publicado_site: false,
    exibir_endereco_site: "apenas_bairro",
    exibir_endereco_portais: "apenas_bairro",
    imovel_ocupado: null,
    contrato_aluguel_ativo: null,
    aceita_financiamento: null,
    aceita_permuta: null,
    latitude: null,
    longitude: null,
    captador_id: context.captadorPerfilId,
  };

  if (!mapped.slug) {
    mapped.slug = generateImovelSlug(mapped.titulo, mapped.cidade);
  }

  return { mapped, warnings };
}
