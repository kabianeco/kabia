/**
 * SEC-05 regression tests: distributed authentication rate limiting.
 *
 * Tests the pure logic: client IP derivation, identifier normalization,
 * and hash key derivation. The actual database consume function is tested
 * via the live Supabase project (see remediation report for abuse checks).
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import {
  combineRateLimitResults,
  getClientIp,
  hashKey,
  limiterErrorResult,
  normalizeIdentifier,
} from "../lib/auth/rate-limit.ts"

describe("SEC-05 rate limiting — client IP derivation", () => {
  it("extracts the first IP from x-vercel-forwarded-for", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.5, 10.0.0.1" })
    assert.equal(getClientIp(headers), "203.0.113.5")
  })

  it("trims whitespace around the IP", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "  203.0.113.5  , 10.0.0.1" })
    assert.equal(getClientIp(headers), "203.0.113.5")
  })

  it("ignores spoofable x-forwarded-for and x-real-ip", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" })
    const ip = getClientIp(headers)
    // Neither header is consulted; only x-vercel-forwarded-for is trusted.
    assert.ok(!["1.2.3.4", "5.6.7.8"].includes(ip))
  })

  it("uses the unknown sentinel with no platform header outside development", () => {
    const headers = new Headers({})
    const ip = getClientIp(headers)
    assert.ok(
      ip === "unknown" || (process.env.NODE_ENV === "development" && ip === "127.0.0.1"),
      `unexpected fallback IP: ${ip}`,
    )
  })

  it("normalizes IPv6 by lowercasing and removing zone identifiers", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "FE80::1%eth0" })
    assert.equal(getClientIp(headers), "fe80::1")
  })

  it("does not trust arbitrary client-supplied headers", () => {
    const headers = new Headers({ "x-real-ip": "1.2.3.4" })
    const ip = getClientIp(headers)
    // x-real-ip is NOT consulted; only x-vercel-forwarded-for is trusted.
    assert.ok(ip !== "1.2.3.4" || process.env.NODE_ENV === "development")
  })
})

describe("SEC-05 rate limiting — identifier normalization", () => {
  it("trims and lowercases email addresses", () => {
    assert.equal(normalizeIdentifier("  Foo@Bar.COM  "), "foo@bar.com")
  })

  it("prevents bypass via capitalization", () => {
    assert.equal(normalizeIdentifier("ADMIN@KABIA.LOCAL"), "admin@kabia.local")
    assert.equal(normalizeIdentifier("  Admin@Kabia.Local  "), "admin@kabia.local")
  })

  it("prevents bypass via whitespace padding", () => {
    assert.equal(normalizeIdentifier("\tadmin@kabia.local\n"), "admin@kabia.local")
  })
})

describe("SEC-05 rate limiting — hash key derivation", () => {
  it("produces a hex string ≤ 64 chars", () => {
    const h = hashKey("test-value")
    assert.match(h, /^[0-9a-f]{1,64}$/)
  })

  it("produces different hashes for different inputs", () => {
    assert.notEqual(hashKey("a"), hashKey("b"))
  })

  it("produces the same hash for the same input", () => {
    assert.equal(hashKey("same"), hashKey("same"))
  })

  it("does not leak the raw value into the hash", () => {
    const h = hashKey("SECRET-INPUT")
    assert.ok(!h.includes("SECRET"), "hash must not contain the input")
  })

  it("uses RATE_LIMIT_SALT when set", () => {
    const prev = process.env.RATE_LIMIT_SALT
    process.env.RATE_LIMIT_SALT = "unit-test-salt"
    try {
      assert.equal(hashKey("same"), hashKey("same"))
      assert.notEqual(hashKey("same"), (() => {
        delete process.env.RATE_LIMIT_SALT
        return hashKey("same")
      })())
    } finally {
      if (prev === undefined) delete process.env.RATE_LIMIT_SALT
      else process.env.RATE_LIMIT_SALT = prev
    }
  })

  it("fails closed in production when RATE_LIMIT_SALT is unset", () => {
    // NODE_ENV is read-only in-process; verify the production branch in a
    // child with NODE_ENV=production and no salt: hashKey must throw instead
    // of hashing with a public constant (fail closed).
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" }
    for (const key of Object.keys(env)) if (/SUPABASE|DATABASE_URL/.test(key)) delete env[key]
    delete env.RATE_LIMIT_SALT
    const out = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "./tests/alias-hook.mjs",
        "-e",
        "import('./lib/auth/rate-limit.ts').then((m) => { try { m.hashKey('x'); console.log('NO-THROW') } catch (e) { console.log('THREW:' + e.message) } })",
      ],
      { env, encoding: "utf8" },
    )
    assert.match(out.stdout, /THREW:.*RATE_LIMIT_SALT/)
  })
})

describe("S7 — over-limit aggregation and limiter-error policy", () => {
  it("allows when every dimension allows", () => {
    assert.deepEqual(
      combineRateLimitResults([
        { allowed: true, retry_after: 0 },
        { allowed: true, retry_after: 0 },
      ]),
      { allowed: true, retryAfter: 0 },
    )
  })

  it("denies with the max retryAfter when ANY dimension is over limit", () => {
    // This is the regression that caught the broken windows: an over-limit
    // call must return allowed: false, never a silent fail-open.
    assert.deepEqual(
      combineRateLimitResults([
        { allowed: true, retry_after: 0 },
        { allowed: false, retry_after: 300 },
        { allowed: false, retry_after: 60 },
      ]),
      { allowed: false, retryAfter: 300 },
    )
  })

  it("fails closed for admin_login on limiter error", () => {
    assert.deepEqual(limiterErrorResult("admin_login"), { allowed: false, retryAfter: 60 })
  })

  it("fails open (logged) for customer flows on limiter error", () => {
    for (const bucket of ["customer_login", "registration", "password_reset", "contact_notify", "review_submit"] as const) {
      assert.deepEqual(limiterErrorResult(bucket), { allowed: true, retryAfter: 0 }, bucket)
    }
  })

  it("defines contact and review buckets", () => {
    const src = readFileSync("lib/auth/rate-limit.ts", "utf8")
    assert.match(src, /contact_notify: \{/)
    assert.match(src, /review_submit: \{/)
  })
})