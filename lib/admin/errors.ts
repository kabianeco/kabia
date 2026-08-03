/**
 * Authorization failure.
 *
 * Defined here rather than in lib/admin/auth.ts because this module is imported
 * by client components (for `ActionState` and `ACTION_IDLE`), and auth.ts is
 * `server-only` — importing it from a client bundle is a build error.
 */
export class AdminAuthError extends Error {
  readonly kind: "unauthenticated" | "forbidden"
  constructor(kind: "unauthenticated" | "forbidden") {
    super(
      kind === "unauthenticated" ? "Oturum bulunamadı." : "Bu işlem için yetkiniz yok.",
    )
    this.name = "AdminAuthError"
    this.kind = kind
  }
}

/**
 * Authorization could not be *determined* — Supabase Auth or the `user_roles`
 * read failed.
 *
 * Deliberately not an `AdminAuthError`. "You are not allowed" and "we could not
 * find out whether you are allowed" must produce different behaviour: the first
 * is a decision the operator should see and act on, the second is a temporary
 * fault that must leave the browser exactly where it is. Collapsing the two is
 * what turned brief Supabase failures into infinite admin redirect loops.
 *
 * Lives here rather than in the `server-only` auth module so client-side error
 * mapping can name it.
 */
export class AdminAuthUnavailableError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super("Yetki bilgisi şu anda doğrulanamıyor. Lütfen tekrar deneyin.")
    this.name = "AdminAuthUnavailableError"
    this.reason = reason
  }
}

/**
 * Turns anything a mutation can throw into a safe, Turkish, user-facing
 * message.
 *
 * Raw Postgres and Supabase errors never reach the browser: they leak table
 * names, column names, constraint names and sometimes row values. The original
 * is logged server-side so it is still debuggable.
 */

export interface ActionState {
  ok: boolean
  message?: string
  /** Field-level messages keyed by form field name. */
  fieldErrors?: Record<string, string>
  /** Non-fatal problems — the mutation succeeded but something adjacent did not. */
  warning?: string
}

export const ACTION_IDLE: ActionState = { ok: false }

/** Postgres SQLSTATE → what the operator should read. */
const SQLSTATE_MESSAGES: Record<string, string> = {
  "23505": "Bu kayıt zaten mevcut. Benzersiz olması gereken bir alan çakışıyor.",
  "23503": "İlişkili bir kayıt bulunamadı ya da hâlâ kullanımda.",
  "23514": "Girilen değer iş kurallarına uymuyor.",
  "23502": "Zorunlu bir alan boş bırakılamaz.",
  "42501": "Bu işlem için yetkiniz yok.",
  "28000": "Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.",
  P0002: "Kayıt bulunamadı.",
}

interface PostgrestLike {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function isPostgrestLike(value: unknown): value is PostgrestLike {
  return typeof value === "object" && value !== null && "message" in value
}

/**
 * Database functions in this project raise Turkish, operator-facing messages on
 * purpose (invalid status transition, negative stock, last super admin). Those
 * are safe to show; anything else is not.
 */
function isCuratedDatabaseMessage(message: string): boolean {
  return /^[^\x00-\x1f]*[çğıöşüÇĞİÖŞÜ]/.test(message) && !/\b(relation|column|schema|function|constraint|violates|permission denied for)\b/i.test(message)
}

export function toActionState(error: unknown, context: string): ActionState {
  if (error instanceof AdminAuthError || error instanceof AdminAuthUnavailableError) {
    return { ok: false, message: error.message }
  }

  console.error(`[admin] ${context}:`, error)

  if (isPostgrestLike(error)) {
    const raw = (error.message ?? "").replace(/^.*?:\s*/, "").trim()
    if (raw && isCuratedDatabaseMessage(raw)) {
      return { ok: false, message: raw }
    }
    if (error.code && SQLSTATE_MESSAGES[error.code]) {
      return { ok: false, message: SQLSTATE_MESSAGES[error.code] }
    }
  }

  return {
    ok: false,
    message: "İşlem tamamlanamadı. Lütfen tekrar deneyin; sorun sürerse sistem kaydını kontrol edin.",
  }
}

/** For read paths, where a failure should render an error state, not a message. */
export function logQueryError(context: string, error: unknown): void {
  if (error) console.error(`[admin] ${context}:`, error)
}
