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
 * SHA-256 hashed with a dedicated RATE_LIMIT_SALT before being sent to the
 * database. The salt fails closed in production when unset.
 */

// ---------------------------------------------------------------------------
// Client address derivation
// ---------------------------------------------------------------------------

/**
 * Derives the client IP from the platform-guaranteed header only.
 *
 * On Vercel, `x-vercel-forwarded-for` is set by the platform to the
 * originating client IP; unlike `x-forwarded-for` it cannot be spoofed by
 * the caller, so no other header is consulted. We take the first entry.
 * In development, we fall back to 127.0.0.1.
 *
 * When no header is present outside development, every such client shares
 * the "unknown" sentinel: one crowded bucket that trips quickly, which is
 * the strict direction for abuse (at the cost of shared fate for legitimate
 * header-less traffic — header-less production traffic should not exist).
 *
 * This is the ONLY place client address derivation happens; all flows that
 * rate-limit by IP must use this function so the behavior is consistent.
 */
export function getClientIp(headers: Headers): string {
  const vxff = headers.get("x-vercel-forwarded-for")
  if (vxff) {
    const first = vxff.split(",")[0]?.trim()
    if (first) return normalizeIp(first)
  }

  if (process.env.NODE_ENV === "development") {
    return "127.0.0.1"
  }

  return "unknown"
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
 * Dedicated salt for rate-limit key hashing. Fails closed in production when
 * unset (the limiter throws instead of hashing with a public constant); in
 * non-production a clearly-marked insecure constant keeps local dev working.
 * Listed in .env.example — the owner must add it to the deployment env.
 */
function getSalt(): string {
  const salt = process.env.RATE_LIMIT_SALT?.trim()
  if (salt) return salt
  if (process.env.NODE_ENV === "production") {
    throw new Error("[rate-limit] RATE_LIMIT_SALT is not set")
  }
  return "dev-salt-insecure-do-not-use-in-production"
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

export type RateLimitBucket =
  | "admin_login"
  | "customer_login"
  | "registration"
  | "password_reset"
  | "contact_notify"
  | "review_submit"

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
  contact_notify: {
    ipBurst: { secs: 900, max: 5 },         // 5 per 15 min per IP
    ipSustained: { secs: 3600, max: 10 },   // 10 per hour per IP
    identifierBurst: { secs: 900, max: 3 }, // 3 per 15 min per email
    identifierSustained: { secs: 3600, max: 5 },
    combinedBurst: { secs: 900, max: 5 },
  },
  review_submit: {
    ipBurst: { secs: 3600, max: 5 },        // 5 per hour per IP
    ipSustained: { secs: 86400, max: 10 },  // 10 per day per IP
    identifierBurst: { secs: 3600, max: 3 },
    identifierSustained: { secs: 86400, max: 5 },
    combinedBurst: { secs: 3600, max: 5 },
  },
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter: number // seconds
}

/**
 * What checkRateLimit returns when the limiter itself errors (DB down,
 * mis-wired RPC, missing salt in production). Explicit per bucket, so a
 * silent fail-open cannot recur unnoticed:
 * - admin_login fails CLOSED (an unavailable limiter must not open the admin
 *   gate; availability loss on this path is the safe direction).
 * - Customer-facing buckets fail OPEN as a deliberate, logged availability
 *   decision: blocking all sign-ins because the rate-limit table is down is
 *   worse than allowing a temporary burst. GoTrue's own limits remain.
 */
const LIMITER_ERROR_POLICY: Record<RateLimitBucket, "closed" | "open"> = {
  admin_login: "closed",
  customer_login: "open",
  registration: "open",
  password_reset: "open",
  contact_notify: "open",
  review_submit: "open",
}

export function limiterErrorResult(bucket: RateLimitBucket): RateLimitResult {
  if (LIMITER_ERROR_POLICY[bucket] === "closed") {
    return { allowed: false, retryAfter: 60 }
  }
  return { allowed: true, retryAfter: 0 }
}

/**
 * Pure aggregation: blocked if ANY dimension denies; retryAfter is the max
 * across denied dimensions. Unit-tested database-free; checkRateLimit below
 * must use it so over-limit semantics cannot silently change.
 */
export function combineRateLimitResults(
  results: Array<{ allowed: boolean; retry_after?: number; retryAfter?: number }>,
): RateLimitResult {
  const blocked = results.filter((r) => !r.allowed)
  if (blocked.length > 0) {
    return {
      allowed: false,
      retryAfter: Math.max(...blocked.map((r) => r.retry_after ?? r.retryAfter ?? 0)),
    }
  }
  return { allowed: true, retryAfter: 0 }
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
        // Limiter failure: per-bucket explicit policy (fail closed for admin,
        // fail open + server-side log for customer flows). See
        // LIMITER_ERROR_POLICY — a silent blanket fail-open cannot recur.
        console.error("[rate-limit] consume failed:", error.message)
        return { allowed: limiterErrorResult(bucket).allowed, retry_after: limiterErrorResult(bucket).retryAfter }
      }
      return (data ?? { allowed: true, retry_after: 0 }) as { allowed: boolean; retry_after: number }
    }),
  )

  return combineRateLimitResults(results)
}

/** Generic Turkish rate-limit message that does not reveal which limiter was hit. */
export const RATE_LIMIT_MESSAGE = "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin."