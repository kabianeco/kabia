import { createHmac, timingSafeEqual } from "node:crypto"

export const RECOVERY_COOKIE = "kabia_recovery_verified"
const GRANT_LIFETIME_MS = 60 * 60 * 1000

function secret(): string {
  const value = process.env.RATE_LIMIT_SALT?.trim()
  if (value) return value
  if (process.env.NODE_ENV === "production") throw new Error("RATE_LIMIT_SALT is required for recovery")
  return "dev-recovery-secret-only"
}

function signature(userId: string, expires: number): string {
  return createHmac("sha256", secret()).update(`${userId}.${expires}`).digest("hex")
}

/** Bound to the verified account and short lived; stored only in an httpOnly cookie. */
export function issueRecoveryGrant(userId: string, now = Date.now()): string {
  const expires = now + GRANT_LIFETIME_MS
  return `${expires}.${signature(userId, expires)}`
}

export function verifyRecoveryGrant(value: string | undefined, userId: string, now = Date.now()): boolean {
  if (!value) return false
  const match = /^(\d{10,15})\.([a-f0-9]{64})$/.exec(value)
  if (!match) return false
  const expires = Number(match[1])
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + GRANT_LIFETIME_MS) return false
  const actual = Buffer.from(match[2], "hex")
  const expected = Buffer.from(signature(userId, expires), "hex")
  return timingSafeEqual(actual, expected)
}
