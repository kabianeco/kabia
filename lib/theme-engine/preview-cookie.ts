import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"

const TOKEN_VERSION = 1
const MAX_TTL_SECONDS = 600
const CLOCK_SKEW_MS = 30_000

interface PreviewPayload {
  v: number
  sub: string
  iat: number
  exp: number
  nonce: string
}

interface CreatePreviewTokenOptions {
  userId: string
  now?: number
  ttlSeconds?: number
  nonce?: string
  secret?: string
}

interface VerifyPreviewTokenOptions {
  userId: string
  now?: number
  secret?: string
}

/**
 * Derive a purpose-specific signing key from the server-only service key.
 * The service key itself is never written into the token or returned.
 */
export function getAppearancePreviewSigningSecret(): string | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  return createHash("sha256")
    .update("kabia:appearance-preview:v1\0")
    .update(serviceKey)
    .digest("base64url")
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest()
}

/** Issue a short-lived token bound to the current database-verified admin. */
export function createAppearancePreviewToken({
  userId,
  now = Date.now(),
  ttlSeconds = MAX_TTL_SECONDS,
  nonce = randomUUID(),
  secret = getAppearancePreviewSigningSecret() ?? "",
}: CreatePreviewTokenOptions): string {
  if (!secret) throw new Error("Appearance preview signing is unavailable")
  if (!userId) throw new Error("Appearance preview subject is missing")
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error("Appearance preview lifetime is invalid")
  }

  const payload: PreviewPayload = {
    v: TOKEN_VERSION,
    sub: userId,
    iat: now,
    exp: now + ttlSeconds * 1_000,
    nonce,
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  return `${encoded}.${signature(encoded, secret).toString("base64url")}`
}

/** Validate content, signature, subject, lifetime, and expiry without throwing. */
export function verifyAppearancePreviewToken(
  token: string | undefined,
  {
    userId,
    now = Date.now(),
    secret = getAppearancePreviewSigningSecret() ?? "",
  }: VerifyPreviewTokenOptions,
): boolean {
  if (!token || !secret || !userId) return false
  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false

  try {
    const supplied = Buffer.from(parts[1], "base64url")
    const expected = signature(parts[0], secret)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return false
    }

    const payload = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as Partial<PreviewPayload>
    if (
      payload.v !== TOKEN_VERSION ||
      payload.sub !== userId ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.nonce !== "string" ||
      !payload.nonce ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp)
    ) {
      return false
    }
    if (payload.iat > now + CLOCK_SKEW_MS || payload.exp <= now) return false
    if (payload.exp - payload.iat > MAX_TTL_SECONDS * 1_000) return false
    return true
  } catch {
    return false
  }
}
