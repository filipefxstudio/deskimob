import type { StatusImovelSlug } from "@/types";

/** Vendido ou desativado permanente — permite novo cadastro no mesmo endereço (republicar). */
const STATUS_REPUBLICAVEL: readonly StatusImovelSlug[] = ["vendido", "desativado"];

export function isImovelRepublicavel(status: StatusImovelSlug | string): boolean {
  return (STATUS_REPUBLICAVEL as readonly string[]).includes(status);
}

export function isImovelDuplicavel(status: StatusImovelSlug | string): boolean {
  return !isImovelRepublicavel(status);
}

/** Imóveis encerrados (venda ou desativação definitiva) não bloqueiam novo cadastro no endereço. */
export function isImovelIgnoradoNaDuplicidadeEndereco(
  status: StatusImovelSlug | string,
): boolean {
  return (STATUS_REPUBLICAVEL as readonly string[]).includes(status);
}