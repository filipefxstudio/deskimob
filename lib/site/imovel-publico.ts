import { getImovelFotoPublicUrl } from "@/lib/imoveis/foto-url";
import type {
  ExibirEnderecoModo,
  FinalidadeImovel,
  ImovelFoto,
  StatusImovelSlug,
  TipoImovel,
} from "@/types";

/** Imóvel exposto no site público — sem endereço completo (logradouro/número). */
export type ImovelPublico = {
  id: string;
  corretor_id: string;
  codigo?: string | null;
  codigo_personalizado?: string | null;
  titulo?: string | null;
  slug?: string | null;
  tipo: TipoImovel;
  finalidade: FinalidadeImovel;
  status: StatusImovelSlug;
  exibir_endereco_site?: ExibirEnderecoModo;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  area_util?: number | null;
  area_total?: number | null;
  quartos: number;
  suites: number;
  salas?: number | null;
  banheiros: number;
  elevadores?: number | null;
  vagas: number;
  vagas_tipo?: string | null;
  vagas_cobertura?: string | null;
  valor_venda?: number | null;
  valor_locacao?: number | null;
  valor_condominio?: number | null;
  valor_iptu?: number | null;
  descricao?: string | null;
  diferenciais?: string[] | null;
  video_url?: string | null;
  publicado_site: boolean;
  destaque_site?: boolean;
  fotos?: ImovelFoto[];
  visualizacoes: number;
  criado_em: string;
  atualizado_em: string;
};

export const PUBLIC_IMOVEL_FOTO_SELECT = "id, imovel_id, url, ordem, legenda";

export const PUBLIC_IMOVEL_SELECT = [
  "id",
  "corretor_id",
  "codigo",
  "codigo_personalizado",
  "titulo",
  "slug",
  "tipo",
  "finalidade",
  "status",
  "exibir_endereco_site",
  "bairro",
  "cidade",
  "estado",
  "latitude",
  "longitude",
  "area_util",
  "area_total",
  "quartos",
  "suites",
  "salas",
  "banheiros",
  "elevadores",
  "vagas",
  "vagas_tipo",
  "vagas_cobertura",
  "valor_venda",
  "valor_locacao",
  "valor_condominio",
  "valor_iptu",
  "descricao",
  "diferenciais",
  "video_url",
  "publicado_site",
  "destaque_site",
  "visualizacoes",
  "criado_em",
  "atualizado_em",
  `imovel_fotos(${PUBLIC_IMOVEL_FOTO_SELECT})`,
].join(", ");

type ImovelPublicoRow = ImovelPublico & {
  imovel_fotos: ImovelFoto[] | null;
};

const JITTER_MIN_METERS = 150;
const JITTER_MAX_METERS = 300;

function createSeededRandom(seed: string): () => number {
  let state = 0;

  for (let index = 0; index < seed.length; index += 1) {
    state = (Math.imul(31, state) + seed.charCodeAt(index)) | 0;
  }

  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
}

/** Desloca coordenadas ~150–300 m de forma determinística por imóvel (região aproximada). */
export function jitterCoordinatesForPublicMap(
  imovelId: string,
  latitude: number,
  longitude: number,
): { latitude: number; longitude: number } {
  const random = createSeededRandom(imovelId);
  const distanceMeters = JITTER_MIN_METERS + random() * (JITTER_MAX_METERS - JITTER_MIN_METERS);
  const bearing = random() * 2 * Math.PI;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos((latitude * Math.PI) / 180);

  return {
    latitude: latitude + (distanceMeters * Math.cos(bearing)) / metersPerDegreeLat,
    longitude: longitude + (distanceMeters * Math.sin(bearing)) / metersPerDegreeLng,
  };
}

export function mapImovelPublicoRow(row: ImovelPublicoRow): ImovelPublico {
  const { imovel_fotos, latitude, longitude, ...rest } = row;
  const fotos = imovel_fotos ?? [];

  let publicLatitude = latitude ?? null;
  let publicLongitude = longitude ?? null;

  if (publicLatitude != null && publicLongitude != null) {
    const jittered = jitterCoordinatesForPublicMap(rest.id, publicLatitude, publicLongitude);
    publicLatitude = jittered.latitude;
    publicLongitude = jittered.longitude;
  }

  return {
    ...rest,
    latitude: publicLatitude,
    longitude: publicLongitude,
    fotos: [...fotos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((foto) => ({
        ...foto,
        url: getImovelFotoPublicUrl(foto.url),
      })),
  };
}
