export function parseArea(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const str = String(value)
    .trim()
    .replace(/m²|m2/gi, "")
    .trim();

  if (!str) return null;

  const normalized = str.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed)) return null;
  return parsed;
}
