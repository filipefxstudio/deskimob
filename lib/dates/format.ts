const BRASILIA_TIMEZONE = "America/Sao_Paulo";

const BRASILIA_DATETIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BRASILIA_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const HAS_TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Normaliza timestamps do Postgres/Supabase para Date em UTC.
 * Colunas TIMESTAMP (sem tz) retornam "2026-07-18T13:30:00" — o JS trataria
 * isso como horário local (+3h em Brasília). Valores salvos via toISOString()
 * devem ser interpretados como UTC.
 */
export function parseDbTimestamp(date: string | Date): Date {
  if (date instanceof Date) return date;

  const trimmed = date.trim();
  if (!trimmed) return new Date(NaN);

  if (HAS_TIMEZONE_SUFFIX.test(trimmed)) {
    return new Date(trimmed);
  }

  const iso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(`${iso}Z`);
}

export function formatDateTimeBrasilia(date: string | Date): string {
  return BRASILIA_DATETIME_FORMAT.format(parseDbTimestamp(date));
}

export function getDbTimestampMs(date: string | Date): number {
  return parseDbTimestamp(date).getTime();
}

/** Converte data + hora informadas em Brasília para ISO UTC. */
export function localDateTimeToUTC(dateStr: string, timeStr: string): string {
  const date = dateStr.trim();
  const time = timeStr.trim();
  if (!date || !time) {
    throw new Error("Data e hora são obrigatórias.");
  }

  const timePart = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${timePart}-03:00`).toISOString();
}

/** Converte string de data/hora local (Brasília) ou datetime-local para ISO UTC. */
export function parseLocalDateTimeInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Data/hora inválida.");
  }

  if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString();
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/);
  if (match) {
    const timePart = match[2].length === 5 ? `${match[2]}:00` : match[2];
    return new Date(`${match[1]}T${timePart}-03:00`).toISOString();
  }

  return new Date(trimmed).toISOString();
}

function getBrasiliaParts(date: string | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BRASILIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parseDbTimestamp(date));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Formato yyyy-MM-dd para input type="date". */
export function formatLocalDateInput(date: string | Date): string {
  const { year, month, day } = getBrasiliaParts(date);
  return `${year}-${month}-${day}`;
}

/** Formato HH:mm para input type="time". */
export function formatLocalTimeInput(date: string | Date): string {
  const { hour, minute } = getBrasiliaParts(date);
  return `${hour}:${minute}`;
}

/** Formato yyyy-MM-ddTHH:mm para input type="datetime-local". */
export function formatLocalDateTimeInput(date: string | Date): string {
  return `${formatLocalDateInput(date)}T${formatLocalTimeInput(date)}`;
}

/** Compara se duas datas caem no mesmo dia civil em Brasília. */
export function isSameDayBrasilia(a: string | Date, b: string | Date): boolean {
  return formatLocalDateInput(a) === formatLocalDateInput(b);
}

/** Data de hoje (yyyy-MM-dd) no fuso de Brasília para inputs type="date". */
export function todayBrasiliaDateInput(): string {
  return formatLocalDateInput(new Date());
}
