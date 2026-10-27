/** Formata duração entre tentativas (ex.: "2d 4h", "5h 30min"). */
export function formatIntervaloContato(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return "—";
  }

  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (totalHours < 24) {
    return mins > 0 ? `${totalHours}h ${mins}min` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (hours > 0) {
    return `${days}d ${hours}h`;
  }

  return `${days}d`;
}
