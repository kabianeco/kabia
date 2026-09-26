import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Short-lived proof that a status page is being shown right after the step it
 * reports: the e-mail change link was verified, or the account was deleted.
 * Without it those pages could be opened directly and claim something that
 * did not happen. Same construction as the recovery grant: HMAC over purpose,
 * subject and expiry, kept in an httpOnly cookie scoped to the page's path.
 */
export type FlowPurpose = "email_change" | "account_deleted"

export const FLOW_COOKIES: Record<FlowPurpose, { name: string; path: string }> = {
  email_change: { name: "kabia_email_change_verified", path: "/eposta-degisikligi-onaylandi" },
  account_deleted: { name: "kabia_account_deleted", path: "/hesap-silindi" },
}

export const FLOW_MARKER_LIFETIME_MS = 10 * 60 * 1000

function secret(): string {
  const value = process.env.RATE_LIMIT_SALT?.trim()
  if (value) return value
  if (process.env.NODE_ENV === "production") throw new Error("RATE_LIMIT_SALT is required for flow markers")
  return "dev-flow-marker-secret-only"
}

function signature(purpose: FlowPurpose, subject: string, expires: number): string {
  return createHmac("sha256", secret()).update(`flow.${purpose}.${subject}.${expires}`).digest("hex")
}

export function issueFlowMarker(purpose: FlowPurpose, subject: string, now = Date.now()): string {
  const expires = now + FLOW_MARKER_LIFETIME_MS
  return `${expires}.${signature(purpose, subject, expires)}`
}

export function verifyFlowMarker(value: string | undefined, purpose: FlowPurpose, subject: string, now = Date.now()): boolean {
  if (!value) return false
  const match = /^(\d{10,15})\.([a-f0-9]{64})$/.exec(value)
  if (!match) return false
  const expires = Number(match[1])
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + FLOW_MARKER_LIFETIME_MS) return false
  const actual = Buffer.from(match[2], "hex")
  const expected = Buffer.from(signature(purpose, subject, expires), "hex")
  return timingSafeEqual(actual, expected)
}

export function flowCookieOptions(purpose: FlowPurpose) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: FLOW_COOKIES[purpose].path,
    maxAge: FLOW_MARKER_LIFETIME_MS / 1000,
  }
}
