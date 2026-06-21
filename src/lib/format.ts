/**
 * Helpers de formato. El backend devuelve montos numéricos como string
 * (numeric de Postgres) y fechas en ISO 8601 — aquí se normalizan para la UI.
 */

const LOCALE = "es-BO";

/** Intl lanza RangeError si la moneda no es un ISO de 3 letras; saneamos. */
function safeCurrency(currency: string | null | undefined): string {
  return /^[A-Za-z]{3}$/.test(currency ?? "") ? (currency as string) : "USD";
}

/** Formatea un monto (string | number) como moneda. */
export function formatCurrency(
  value: string | number | null | undefined,
  currency = "USD"
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: safeCurrency(currency),
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

/** Versión compacta para KPIs grandes: $1.2M, $25K. */
export function formatCompactCurrency(
  value: string | number | null | undefined,
  currency = "USD"
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: safeCurrency(currency),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** Fecha corta: 16 jun 2026. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Fechas date-only (YYYY-MM-DD, p. ej. contractDate) se interpretan en UTC
  // para que no se corran un día en zonas horarias negativas (es-BO = UTC-4).
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly ? { timeZone: "UTC" } : {}),
  }).format(d);
}

/** Fecha + hora: 16 jun 2026, 12:00. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Tiempo relativo aproximado: "hace 5 min", "hace 2 d". */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "hace un momento";
}

export function initialsOf(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}
