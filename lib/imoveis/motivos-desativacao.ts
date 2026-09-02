import { MOTIVOS_DESATIVACAO } from "@/lib/constants/imoveis";
import type { MotivoDesativacao } from "@/types";

export function resolveMotivosDesativacaoAtivos(
  items: MotivoDesativacao[],
): MotivoDesativacao[] {
  const ativos = items.filter((item) => item.ativo);
  if (ativos.length > 0) {
    return ativos;
  }

  return MOTIVOS_DESATIVACAO.map((nome, index) => ({
    id: `default-${index}`,
    corretor_id: "",
    nome,
    ativo: true,
    ordem: index,
  }));
}
