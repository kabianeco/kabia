/**
 * Svix imza doğrulaması — Resend webhook'ları için, yeni bağımlılık yok.
 *
 * Resend, `svix-id` / `svix-timestamp` / `svix-signature` başlıklarıyla
 * imzalar (bkz. resend.com/docs/webhooks/verify-webhooks-requests). Doğrulama,
 * ham gövde üzerinden HMAC-SHA256 ile yapılır; bu yüzden çağıran gövdeyi
 * `req.text()` ile okumalıdır — `req.json()` sonrası stringify, imzayı bozar.
 *
 * Zaman damgası toleransı (varsayılan 5 dk) tekrar-saldırıları (replay)
 * engeller: eski bir yük, imzası geçerli olsa bile reddedilir.
 */

import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export interface SvixHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/** Webhook sırrı: `whsec_...` önekli ya da çıplak base64 olabilir. */
export function decodeWebhookSecret(secret: string): Buffer | null {
  const trimmed = secret.trim()
  if (trimmed === "") return null
  const raw = trimmed.startsWith("whsec_") ? trimmed.slice("whsec_".length) : trimmed
  try {
    const key = Buffer.from(raw, "base64")
    if (key.length === 0) return null
    return key
  } catch {
    return null
  }
}

export type SvixFailureReason =
  | "missing_secret"
  | "missing_headers"
  | "stale"
  | "invalid"

export interface SvixVerifyInput {
  secret: string | undefined | null
  headers: SvixHeaders
  /** Ham istek gövdesi — değiştirilmeden, tam aynen. */
  rawBody: string
  nowMs: number
  /** Saniye cinsinden tolerans. Svix varsayılanı 5 dakikadır. */
  toleranceSecs?: number
}

export type SvixVerifyResult = { ok: true } | { ok: false; reason: SvixFailureReason }

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function verifySvixWebhook(input: SvixVerifyInput): SvixVerifyResult {
  const toleranceSecs = input.toleranceSecs ?? 300

  const key = input.secret ? decodeWebhookSecret(input.secret) : null
  if (!key) return { ok: false, reason: "missing_secret" }

  const { id, timestamp, signature } = input.headers
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: "missing_headers" }
  if (Math.abs(input.nowMs / 1000 - ts) > toleranceSecs) {
    return { ok: false, reason: "stale" }
  }

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${input.rawBody}`, "utf8").digest("base64")

  // Başlıkta boşlukla ayrılmış birden çok `v1,...` imzası olabilir.
  const candidates = signature.split(" ")
  for (const candidate of candidates) {
    const comma = candidate.indexOf(",")
    if (comma < 0) continue
    const version = candidate.slice(0, comma)
    const value = candidate.slice(comma + 1)
    if (version !== "v1" || value === "") continue
    if (safeEqual(value, expected)) return { ok: true }
  }

  return { ok: false, reason: "invalid" }
}

/** Route handler'larda NextHeaders'tan üç Svix başlığını toplar. */
export function pickSvixHeaders(get: (name: string) => string | null): SvixHeaders {
  return {
    id: get("svix-id"),
    timestamp: get("svix-timestamp"),
    signature: get("svix-signature"),
  }
}
