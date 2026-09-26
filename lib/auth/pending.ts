/**
 * Browser-side memory for the e-mail confirmation steps: which address the
 * code went to, and when the next resend is allowed. Session storage only —
 * never sent anywhere — and every access tolerates storage being unavailable.
 * The server enforces its own limits; this only keeps the screen honest.
 */

export const PENDING_EMAIL_KEY = "kabia_pending_email"
export const RESEND_COOLDOWN_SECONDS = 60

const COOLDOWN_KEYS = {
  signup: "kabia_resend_until",
  recovery: "kabia_recovery_resend_until",
} as const

export type ResendKind = keyof typeof COOLDOWN_KEYS

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function readPendingEmail(): string {
  try {
    return storage()?.getItem(PENDING_EMAIL_KEY) ?? ""
  } catch {
    return ""
  }
}

export function writePendingEmail(email: string): void {
  try {
    storage()?.setItem(PENDING_EMAIL_KEY, email)
  } catch {}
}

export function clearPendingEmail(): void {
  try {
    storage()?.removeItem(PENDING_EMAIL_KEY)
  } catch {}
}

/** Starts the resend cooldown — called right after any successful send. */
export function startResendCooldown(kind: ResendKind, now = Date.now()): void {
  try {
    storage()?.setItem(COOLDOWN_KEYS[kind], String(now + RESEND_COOLDOWN_SECONDS * 1000))
  } catch {}
}

export function secondsUntilResend(kind: ResendKind, now = Date.now()): number {
  try {
    const until = Number(storage()?.getItem(COOLDOWN_KEYS[kind]))
    return remainingSeconds(until, now)
  } catch {
    return 0
  }
}

export function remainingSeconds(until: number, now: number): number {
  if (!Number.isFinite(until) || until <= now) return 0
  return Math.min(RESEND_COOLDOWN_SECONDS, Math.ceil((until - now) / 1000))
}

/** The quiet line shown in place of the resend link while it is locked. */
export function cooldownText(seconds: number): string {
  return `${seconds} sn sonra tekrar gönderebilirsiniz`
}
