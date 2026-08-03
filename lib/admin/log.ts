/**
 * Structured, log-forgery-resistant admin logging.
 *
 * Replaces the previous `console.error(`[admin] ${context}:`, error)` pattern,
 * which used caller-supplied `context` as part of the format string. A caller
 * controlling `context` could inject `%s`, `%j`, `\n`, `\r`, or terminal escape
 * sequences, forge extra log lines, or leak misleading framing into server
 * logs. None of the current callers are attacker-controlled, but the Semgrep
 * finding is correct in pattern: any future caller that passes request-derived
 * data as `context` would inherit the risk.
 *
 * The contract here is:
 *   - The log *message* is a constant. Caller data is never the format string.
 *   - `context` is sanitized (CR/LF/control chars stripped, length bounded),
 *     then serialized as a string field, not interpolated into the message.
 *   - Errors are serialized to a safe, bounded shape: name, message (also
 *     sanitized), `code` if present, `stack` truncated. We do not forward raw
 *     Error objects to util.format, which would otherwise treat `%s`/`%j`
 *     placeholders against their `.message`.
 *   - The structured payload is emitted as a single JSON line so it cannot be
 *     split into forged extra lines even if a future field contained a newline
 *     (defence in depth — the sanitizer already strips them).
 *   - No token, cookie, SQL payload, or customer PII is added by this module.
 *     The caller is responsible for not passing them; the bounded context
 *     length prevents accidental bulk leakage even if a caller tried.
 *
 * Note: this module is deliberately **not** marked `server-only`. Client
 * components import `ACTION_IDLE` / `ActionState` from `lib/admin/errors`,
 * which in turn imports this function. The logger has no server-only
 * dependencies and is safe to import from a client bundle; its body is just
 * `console.error` (a no-op-text transformation) so tree-shaking removes it at
 * build time when an action's `toActionState` path survives into a client.
 */

const MAX_CONTEXT_CHARS = 200
const MAX_MESSAGE_CHARS = 500
const MAX_STACK_CHARS = 1000

/** Characters normalized to a single underscore before a field is logged. */
const FORGERY_CHARS = /[\x00-\x1f\x7f]/g

function sanitizeField(input: string, max: number): string {
  // Strip CRLF/NUL and other C0/DEL control chars outright. These are the log
  // forgery vector. We deliberately DO NOT strip or escape `%`: caller data
  // never reaches `util.format`. The logger calls `console.error` with exactly
  // two args — a CONSTANT message string and a JSON stringified payload — so
  // `%s`/`%j` in any field is data, not a printf placeholder.
  const cleaned = input.replace(FORGERY_CHARS, "")
  if (cleaned.length > max) {
    return cleaned.slice(0, max) + "…"
  }
  return cleaned
}

/** Trims but keeps internal whitespace; the forgery vector is CRLF, not spaces. */
function trimAndBound(input: string, max: number): string {
  const trimmed = input.trim()
  if (trimmed.length > max) {
    return trimmed.slice(0, max) + "…"
  }
  return trimmed
}

/**
 * Serializes a thrown value into a shape safe to embed in a log line. Never
 * passes the raw object to util.format, so error `.message` strings containing
 * `%s` / `%j` cannot become format-string attackers if this payload were ever
 * re-formatted by a downstream transport.
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (error === null || error === undefined) {
    return { value: String(error) }
  }

  if (error instanceof Error) {
    const out: Record<string, unknown> = {
      name: sanitizeField(error.name || "Error", 120),
      message: sanitizeField(error.message || "", MAX_MESSAGE_CHARS),
    }
    // Postgres/PostgREST-specific fields, surfaced for diagnosis only — these
    // are codes (e.g. "23505") or short hint strings, never raw SQL payloads
    // because the Supabase client never puts them there. Still sanitize.
    const anyErr = error as unknown as Record<string, unknown>
    if (typeof anyErr.code === "string") {
      out.code = sanitizeField(anyErr.code, 20)
    }
    if (typeof anyErr.details === "string") {
      out.details = sanitizeField(anyErr.details, 300)
    }
    if (typeof anyErr.hint === "string") {
      out.hint = sanitizeField(anyErr.hint, 300)
    }
    if (process.env.NODE_ENV !== "production" && error.stack) {
      // Stack traces are noisy in prod logs; emitted only in non-production.
      out.stack = trimAndBound(error.stack, MAX_STACK_CHARS)
    }
    return out
  }

  // Primitives and unknown objects. Stringify with a hard length cap so even
  // a thrown object containing a ToString-symbol cannot blow the log line.
  let repr: string
  try {
    repr = typeof error === "string" ? error : JSON.stringify(error)
  } catch {
    repr = "[unserializable]"
  }
  return { value: sanitizeField(repr || "[unserializable]", MAX_MESSAGE_CHARS) }
}

export interface SecureLogEntry {
  /** Constant string identifying the operation. */
  context: string
  /** The thrown value, serialized safely via `serializeError`. */
  error?: unknown
  /** Optional structured metadata. Values are individually sanitized. */
  meta?: Record<string, unknown>
}

/**
 * Emits a single structured log line. The literal string "admin.error" is the
 * constant log message; everything else is data inside a JSON payload.
 */
export function logAdminError(entry: SecureLogEntry): void {
  const context = sanitizeField(String(entry.context), MAX_CONTEXT_CHARS)
  const payload: Record<string, unknown> = { context }
  if (entry.error !== undefined) payload.error = serializeError(entry.error)
  if (entry.meta) {
    for (const [key, value] of Object.entries(entry.meta)) {
      const safeKey = sanitizeField(key, 60)
      if (!safeKey) continue
      if (value === null || value === undefined) {
        payload[safeKey] = value
      } else if (typeof value === "string") {
        payload[safeKey] = sanitizeField(value, 300)
      } else if (typeof value === "number" || typeof value === "boolean") {
        payload[safeKey] = value
      } else {
        try {
          payload[safeKey] = sanitizeField(JSON.stringify(value), 500)
        } catch {
          payload[safeKey] = "[unserializable]"
        }
      }
    }
  }
  // `JSON.stringify` itself escapes control chars; the sanitizer above is a
  // second layer of defence. This is one atomic line: no embedded newlines.
  const line = JSON.stringify(payload)
  // Use a literal constant prefix; never the payload as the format string.
  console.error("admin.error", line)
}