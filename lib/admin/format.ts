/**
 * Formatting for the dashboard. Turkish locale, Turkish lira, and the store's
 * real timezone — a date rendered here means the same thing as a date spoken
 * about in Geyve.
 *
 * Pure functions; safe on both sides of the server/client boundary. The
 * formatters are constructed once because `Intl` construction is the expensive
 * part, and every table row calls these.
 */

export const STORE_TIMEZONE = "Europe/Istanbul"
export const STORE_LOCALE = "tr-TR"
export const STORE_CURRENCY = "TRY"

const currency = new Intl.NumberFormat(STORE_LOCALE, {
  style: "currency",
  currency: STORE_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const currencyCompact = new Intl.NumberFormat(STORE_LOCALE, {
  style: "currency",
  currency: STORE_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const integer = new Intl.NumberFormat(STORE_LOCALE, { maximumFractionDigits: 0 })

const dateOnly = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const dateTime = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const dayMonth = new Intl.DateTimeFormat(STORE_LOCALE, {
  timeZone: STORE_TIMEZONE,
  day: "numeric",
  month: "short",
})

/** PostgREST returns `numeric` columns as strings; everything goes through here. */
export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function formatCurrency(value: number | string | null | undefined): string {
  return currency.format(toNumber(value))
}

/** For headline metrics, where kuruş are noise. */
export function formatCurrencyCompact(value: number | string | null | undefined): string {
  return currencyCompact.format(toNumber(value))
}

export function formatInteger(value: number | string | null | undefined): string {
  return integer.format(toNumber(value))
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return dateOnly.format(d)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return dateTime.format(d)
}

/** Chart axis labels: "3 Ağu". */
export function formatDayMonth(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  return dayMonth.format(d)
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const diffMs = Date.now() - d.getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "az önce"
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} sa önce`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} gün önce`
  return formatDate(d)
}

/**
 * Start of a day in the store's timezone, as a UTC instant. Used to build the
 * date-range bounds handed to the aggregation RPCs, so "last 30 days" means 30
 * Turkish days rather than 30 UTC days.
 */
const zoneParts = new Intl.DateTimeFormat("en-US", {
  timeZone: STORE_TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

const zoneDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: STORE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** How far ahead of UTC the store's zone is, at a given instant. */
function storeOffsetMs(instant: Date): number {
  const parts: Record<string, string> = {}
  for (const p of zoneParts.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value
  }
  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return wallClockAsUtc - instant.getTime()
}

export function storeDayStart(date: Date): Date {
  const ymd = zoneDate.format(date) // calendar date as seen in the store's zone
  const midnightAsUtc = new Date(`${ymd}T00:00:00Z`).getTime()
  // Subtract the zone offset to get the real instant of local midnight. One
  // correction pass covers a range that straddles an offset change; Türkiye has
  // been permanently UTC+3 since 2016, so it normally settles immediately.
  let instant = new Date(midnightAsUtc - storeOffsetMs(new Date(midnightAsUtc)))
  instant = new Date(midnightAsUtc - storeOffsetMs(instant))
  return instant
}

/** `days` whole store-days ending at the end of today. */
export function storeDayRange(days: number): { from: Date; to: Date } {
  const now = new Date()
  const startOfToday = storeDayStart(now)
  const to = new Date(startOfToday.getTime() + 24 * 3_600_000)
  const from = new Date(to.getTime() - days * 24 * 3_600_000)
  return { from, to }
}
