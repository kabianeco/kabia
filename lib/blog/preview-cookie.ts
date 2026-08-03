import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"

/**
 * Signed, short-lived draft-preview token — the same architecture as
 * lib/theme-engine/preview-cookie.ts (HMAC over a JSON payload, subject-bound,
 * bounded TTL, constant-time comparison), deliberately re-implemented rather
 * than shared so a blog preview token and an appearance preview token can
 * never be replayed against each other: the signing secret is derived with a
 * different domain-separation string, and the cookie name differs too.
 */

const TOKEN_VERSION = 1
const MAX_TTL_SECONDS = 600
const CLOCK_SKEW_MS = 30_000

export const BLOG_PREVIEW_COOKIE = "kabia_blog_preview"

interface PreviewPayload {
  v: number
  sub: string
  postId: string
  iat: number
  exp: number
  nonce: string
}

interface CreateOptions {
  userId: string
  postId: string
  now?: number
  ttlSeconds?: number
  nonce?: string
  secret?: string
}

interface VerifyOptions {
  userId: string
  postId: string
  now?: number
  secret?: string
}

export function getBlogPreviewSigningSecret(): string | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  return createHash("sha256")
    .update("kabia:blog-preview:v1\0")
    .update(serviceKey)
    .digest("base64url")
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest()
}

/** Issue a short-lived token bound to one administrator and one post. */
export function createBlogPreviewToken({
  userId,
  postId,
  now = Date.now(),
  ttlSeconds = MAX_TTL_SECONDS,
  nonce = randomUUID(),
  secret = getBlogPreviewSigningSecret() ?? "",
}: CreateOptions): string {
  if (!secret) throw new Error("Blog preview signing is unavailable")
  if (!userId || !postId) throw new Error("Blog preview subject is missing")
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error("Blog preview lifetime is invalid")
  }

  const payload: PreviewPayload = { v: TOKEN_VERSION, sub: userId, postId, iat: now, exp: now + ttlSeconds * 1_000, nonce }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  return `${encoded}.${signature(encoded, secret).toString("base64url")}`
}

/** Validate content, signature, subject, post binding, lifetime, and expiry — never throws. */
export function verifyBlogPreviewToken(
  token: string | undefined,
  { userId, postId, now = Date.now(), secret = getBlogPreviewSigningSecret() ?? "" }: VerifyOptions,
): boolean {
  if (!token || !secret || !userId || !postId) return false
  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false

  try {
    const supplied = Buffer.from(parts[1], "base64url")
    const expected = signature(parts[0], secret)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false

    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as Partial<PreviewPayload>
    if (
      payload.v !== TOKEN_VERSION ||
      payload.sub !== userId ||
      payload.postId !== postId ||
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
