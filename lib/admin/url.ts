/**
 * Helpers for list screens whose state lives in the URL.
 *
 * `searchParams` values are attacker-controlled, so nothing here trusts them:
 * `pickEnum` falls back to a default unless the value is in an explicit
 * allow-list, and `pickPage` clamps to a sane range. That keeps a hand-edited
 * `?sirala=;drop` out of an ORDER BY and a `?sayfa=999999999` out of a range
 * query.
 */

export type SearchParamsInput = Record<string, string | string[] | undefined>

export function pickString(
  params: SearchParamsInput,
  key: string,
  maxLength = 120,
): string | undefined {
  const raw = params[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed.slice(0, maxLength)
}

export function pickEnum<T extends string>(
  params: SearchParamsInput,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T
export function pickEnum<T extends string>(
  params: SearchParamsInput,
  key: string,
  allowed: readonly T[],
  fallback?: undefined,
): T | undefined
export function pickEnum<T extends string>(
  params: SearchParamsInput,
  key: string,
  allowed: readonly T[],
  fallback?: T,
): T | undefined {
  const value = pickString(params, key)
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export function pickPage(params: SearchParamsInput, key = "sayfa"): number {
  const value = Number(pickString(params, key))
  if (!Number.isInteger(value) || value < 1) return 1
  return Math.min(value, 10_000)
}

/** Preserves the current query while overriding a few keys. */
export function buildQuery(
  params: SearchParamsInput,
  overrides: Record<string, string | number | null | undefined>,
): string {
  const search = new URLSearchParams()

  for (const [key, raw] of Object.entries(params)) {
    const value = Array.isArray(raw) ? raw[0] : raw
    if (typeof value === "string" && value !== "") search.set(key, value)
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === "") search.delete(key)
    else search.set(key, String(value))
  }

  const query = search.toString()
  return query ? `?${query}` : ""
}

export function hrefBuilder(pathname: string, params: SearchParamsInput) {
  return (overrides: Record<string, string | number | null | undefined>) =>
    `${pathname}${buildQuery(params, overrides)}`
}
