export function parseIdadeToAnoConstrucao(
  idade: unknown,
  exportYear: number,
): number | null {
  if (idade === null || idade === undefined || idade === "") return null;

  const str = String(idade).trim();
  if (!str) return null;

  const match = str.match(/(\d+)/);
  if (!match) return null;

  const anos = Number.parseInt(match[1], 10);
  if (Number.isNaN(anos)) return null;

  if (anos > 150) return null;

  return exportYear - anos;
}
