import "server-only"
import { createHash } from "crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * SEC-05: Distributed authentication rate limiting.
 *
 * Uses a Supabase/Postgres-backed rate limiter in the private schema, suitable
 * for Vercel serverless deployments. All rate-limit checks go through the
 * service-role client, which is server-only (import "server-only" above).
 *
 * Identifiers (email) and IP addresses are NEVER stored raw. They are
 * SHA-256 hashed with a server-side salt before being sent to the database.
 *
 * The salt is derived from SUPABASE_SERVICE_ROLE_KEY (which is already
 * server-only and never exposed to the browser) so no additional secret
 * management is required.
 */

// ---------------------------------------------------------------------------
// Client address derivation
// ---------------------------------------------------------------------------

/**
 * Derives the client IP from trusted Vercel forwarding headers.
 *
 * Vercel sets `x-forwarded-for` to the originating client IP followed by
 * intermediary proxies. We take the first entry (the original client).
 * In development, we fall back to 127.0.0.1.
 *
 * This is the ONLY place client address derivation happens; all auth flows
 * must use this function so the behavior is consistent.
 */
export function getClientIp(headers: Headers): string {
  // In production, Vercel guarantees x-forwarded-for is the originating client.
  // We take the first IP only; we do NOT trust any other header.
  const xff = headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return normalizeIp(first)
  }

  // In local development or non-Vercel hosting, fall back.
  if (process.env.NODE_ENV === "development") {
    return "127.0.0.1"
  }

  return "0.0.0.0"
}

/** Normalizes an IP address for consistent hashing. */
function normalizeIp(ip: string): string {
  // Trim whitespace and remove zone identifiers from IPv6 (e.g. fe80::1%eth0)
  return ip.trim().replace(/%[^\s]*/, "").toLowerCase()
}

// ---------------------------------------------------------------------------
// Identifier normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes an identifier (email) before hashing.
 * Trim + lowercase prevents bypass via capitalization or whitespace.
 */
export function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Derives the salt from the service role key. This is already server-only and
 * never exposed to the browser. Using it as the salt means the rate-limit
 * hashes are useless without the key, which is already a secret.
 */
function getSalt(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-salt-fallback"
}

/**
 * Hashes a value with the server-side salt. Returns a hex string.
 * The raw value is never sent to or stored in the database.
 */
export function hashKey(value: string): string {
  return createHash("sha256")
    .update(value + "\0" + getSalt())
    .digest("hex")
    .slice(0, 64)
}

// ---------------------------------------------------------------------------
// Rate-limit policies
// ---------------------------------------------------------------------------

export type RateLimitBucket = "admin_login" | "customer_login" | "registration" | "password_reset"

interface WindowPolicy {
  secs: number
  max: number
}

interface BucketPolicy {
  ipBurst: WindowPolicy
  ipSustained: WindowPolicy
  identifierBurst: WindowPolicy
  identifierSustained: WindowPolicy
  combinedBurst: WindowPolicy
}

const POLICIES: Record<RateLimitBucket, BucketPolicy> = {
  admin_login: {
    ipBurst: { secs: 300, max: 8 },         // 8 per 5 min per IP
    ipSustained: { secs: 3600, max: 20 },   // 20 per hour per IP
    identifierBurst: { secs: 300, max: 5 }, // 5 per 5 min per identifier
    identifierSustained: { secs: 3600, max: 15 }, // 15 per hour per identifier
    combinedBurst: { secs: 300, max: 10 },  // 10 per 5 min per IP+identifier
  },
  customer_login: {
    ipBurst: { secs: 300, max: 10 },
    ipSustained: { secs: 3600, max: 30 },
    identifierBurst: { secs: 300, max: 5 },
    identifierSustained: { secs: 3600, max: 20 },
    combinedBurst: { secs: 300, max: 15 },
  },
  registration: {
    ipBurst: { secs: 900, max: 3 },         // 3 per 15 min per IP
    ipSustained: { secs: 3600, max: 5 },    // 5 per hour per IP
    identifierBurst: { secs: 900, max: 2 },
    identifierSustained: { secs: 3600, max: 3 },
    combinedBurst: { secs: 900, max: 5 },
  },
  password_reset: {
    ipBurst: { secs: 3600, max: 3 },
    ipSustained: { secs: 86400, max: 5 },   // 5 per day per IP
    identifierBurst: { secs: 3600, max: 3 },
    identifierSustained: { secs: 86400, max: 3 },
    combinedBurst: { secs: 3600, max: 3 },
  },
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter: number // seconds
}

/**
 * Checks all rate-limit dimensions for a given bucket. Returns allowed=false
 * if ANY dimension is exceeded. The retryAfter is the max across all
 * exceeded dimensions.
 *
 * This function is atomic per-dimension (the Postgres function uses ON
 * CONFLICT row locking). Under concurrent requests, each dimension is
 * checked independently; the most restrictive dimension governs.
 */
export async function checkRateLimit(
  bucket: RateLimitBucket,
  ip: string,
  identifier: string | null,
): Promise<RateLimitResult> {
  const policy = POLICIES[bucket]
  const supabase = createSupabaseAdminClient()

  const ipHash = hashKey(normalizeIp(ip))
  const idHash = identifier ? hashKey(normalizeIdentifier(identifier)) : null
  const combinedHash = identifier ? hashKey(normalizeIp(ip) + "\0" + normalizeIdentifier(identifier)) : null

  const checks: Array<{ dimension: string; windowKind: string; policy: WindowPolicy; keyHash: string }> = [
    { dimension: "ip", windowKind: "burst", policy: policy.ipBurst, keyHash: ipHash },
    { dimension: "ip", windowKind: "sustained", policy: policy.ipSustained, keyHash: ipHash },
  ]

  if (idHash) {
    checks.push(
      { dimension: "identifier", windowKind: "burst", policy: policy.identifierBurst, keyHash: idHash },
      { dimension: "identifier", windowKind: "sustained", policy: policy.identifierSustained, keyHash: idHash },
    )
  }

  if (combinedHash) {
    checks.push(
      { dimension: "ip_identifier", windowKind: "burst", policy: policy.combinedBurst, keyHash: combinedHash },
    )
  }

  // Run all checks concurrently for speed. Each is atomic in Postgres.
  const results = await Promise.all(
    checks.map(async (check) => {
      const { data, error } = await supabase.rpc("consume_auth_rate_limit", {
        p_bucket_kind: bucket,
        p_dimension: check.dimension,
        p_window_kind: check.windowKind,
        p_key_hash: check.keyHash,
        p_window_secs: check.policy.secs,
        p_max_count: check.policy.max,
      })
      if (error) {
        // If the limiter itself fails, we must fail-OPEN for availability:
        // blocking all auth because the rate-limit DB is down is worse than
        // allowing a temporary burst. Log the error server-side.
        console.error("[rate-limit] consume failed:", error.message)
        return { allowed: true, retryAfter: 0 }
      }
      return (data ?? { allowed: true, retry_after: 0 }) as { allowed: boolean; retry_after: number }
    }),
  )

  // If any dimension is blocked, the request is blocked.
  const blocked = results.filter((r) => !r.allowed)
  if (blocked.length > 0) {
    return {
      allowed: false,
      retryAfter: Math.max(...blocked.map((r) => (r as { retry_after: number }).retry_after ?? 0)),
    }
  }

  return { allowed: true, retryAfter: 0 }
}

/** Generic Turkish rate-limit message that does not reveal which limiter was hit. */
export const RATE_LIMIT_MESSAGE = "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin."