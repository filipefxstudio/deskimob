import { DIFERENCIAIS_OPCOES } from "@/lib/constants/imoveis";
import { isSim } from "@/lib/imoview/parse-xls";
import type { XlsRow } from "@/lib/imoview/types";

/** Coluna XLS → rótulo no array diferenciais */
export const DIFERENCIAIS_XLS_MAP: Record<string, string> = {
  ArCondicionado: "Ar condicionado",
  AreaServico: "Área de serviço",
  AreaPrivativa: "Área privativa",
  ArmarioBanheiro: "Armário no banheiro",
  ArmarioCozinha: "Armário na cozinha",
  ArmarioQuarto: "Armário embutido no quarto",
  Closet: "Closet",
  Despensa: "Despensa",
  Escritorio: "Escritório",
  Lavabo: "Lavabo",
  Mobiliado: "Mobiliado",
  Rouparia: "Rouparia",
  SolManha: "Sol da manhã",
  VistaMar: "Vista para o mar",
  AguaIndividual: "Água individual",
  Alarme: "Alarme",
  AquecimentoEletrico: "Aquecimento elétrico",
  AquecimentoGas: "Aquecimento a gás",
  AquecimentoSolar: "Aquecimento solar",
  CercaEletrica: "Cerca elétrica",
  CircuitoTv: "Circuito de TV",
  GasCanalizado: "Gás canalizado",
  Interfone: "Interfone",
  Jardim: "Jardim",
  Lavanderia: "Lavanderia",
  PortaoEletronico: "Portão eletrônico",
  Portaria24H: "Portaria 24h",
  Academia: "Academia",
  Churrasqueira: "Churrasqueira",
  Hidromassagem: "Hidromassagem",
  HomeCinanema: "Home cinema",
  Piscina: "Piscina",
  Playground: "Playground",
  QuadraPoliesportiva: "Quadra poliesportiva",
  QuadraTenis: "Quadra de tênis",
  SalaMassagem: "Sala de massagem",
  SalaoFestas: "Salão de festas",
  SalaoJogos: "Salão de jogos",
  Sauna: "Sauna",
  Wifi: "Wi-Fi",
};

const KNOWN_LABELS = new Set<string>(DIFERENCIAIS_OPCOES);

export function extractDiferenciais(row: XlsRow): string[] {
  const result: string[] = [];

  for (const [column, label] of Object.entries(DIFERENCIAIS_XLS_MAP)) {
    if (isSim(row[column])) {
      result.push(label);
    }
  }

  return result;
}

export function validateDiferenciaisLabels(labels: string[]): string[] {
  const unknown: string[] = [];
  for (const label of labels) {
    if (!KNOWN_LABELS.has(label)) {
      unknown.push(label);
    }
  }
  return unknown;
}
