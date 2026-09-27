import { RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit-message"

/**
 * Customer login failure messages (Turkish, inline).
 *
 * Every branch of customerLoginAction maps through here so a silent reload
 * is impossible: validation, app limiter, Supabase wrong-credentials,
 * Supabase per-IP rate limit (429), unconfirmed e-mail, network/server.
 *
 * Pure and database-free for unit tests.
 */

export const LOGIN_WRONG_CREDENTIALS = "E-posta veya şifre hatalı."
export const LOGIN_NETWORK_ERROR = "Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin."
export const LOGIN_SERVER_ERROR = "Sunucu hatası. Lütfen biraz sonra tekrar deneyin."
export const LOGIN_GENERIC_ERROR = "Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin."
export const LOGIN_UNCONFIRMED_MESSAGE = "Devam etmek için e-postanızı doğrulayın."

interface SupabaseAuthErrorLike {
  code?: unknown
  status?: unknown
  message?: unknown
  name?: unknown
}

function messageText(error: SupabaseAuthErrorLike): string {
  return typeof error.message === "string" ? error.message : ""
}

function errorName(error: SupabaseAuthErrorLike): string {
  return typeof error.name === "string" ? error.name : ""
}

/** True for Supabase per-IP 429 on /token (password or refresh grant). */
export function isSupabaseRateLimit(error: SupabaseAuthErrorLike | null | undefined): boolean {
  if (!error || typeof error !== "object") return false
  const status = typeof error.status === "number" ? error.status : Number(error.status)
  if (status === 429) return true
  const code = typeof error.code === "string" ? error.code.toLowerCase() : ""
  if (code.includes("rate_limit") || code.includes("over_request") || code === "429") return true
  const msg = messageText(error).toLowerCase()
  if (msg.includes("rate limit") || msg.includes("over_request") || msg.includes("too many")) return true
  return false
}

/** True for transport failures that never reached Supabase (no verdict on credentials). */
export function isNetworkError(error: SupabaseAuthErrorLike | null | undefined): boolean {
  if (!error || typeof error !== "object") return false
  const name = errorName(error)
  if (name === "AuthRetryableFetchError" || name === "TypeError" || name === "AbortError") return true
  const status = error.status
  if (status === 0 || status === "0") return true
  const msg = messageText(error).toLowerCase()
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("fetch failed") || msg.includes("load failed")) return true
  return false
}

/** True for wrong e-mail/password (Supabase 400 invalid_credentials). */
export function isInvalidCredentials(error: SupabaseAuthErrorLike | null | undefined): boolean {
  if (!error || typeof error !== "object") return false
  const code = typeof error.code === "string" ? error.code.toLowerCase() : ""
  if (code === "invalid_credentials") return true
  const status = typeof error.status === "number" ? error.status : Number(error.status)
  const msg = messageText(error).toLowerCase()
  if (status === 400 && msg.includes("invalid login credentials")) return true
  return false
}

/**
 * Maps a Supabase signInWithPassword error to the Turkish inline message.
 * Unconfirmed e-mail is handled by the caller (needsEmailConfirm), not here.
 */
export function mapLoginError(error: SupabaseAuthErrorLike | null | undefined): string {
  if (isSupabaseRateLimit(error)) return RATE_LIMIT_MESSAGE
  if (isNetworkError(error)) return LOGIN_NETWORK_ERROR
  if (isInvalidCredentials(error)) return LOGIN_WRONG_CREDENTIALS
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status === "number" && status >= 500) return LOGIN_SERVER_ERROR
  return LOGIN_GENERIC_ERROR
}
