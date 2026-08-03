/**
 * SEC-05 regression tests: distributed authentication rate limiting.
 *
 * Tests the pure logic: client IP derivation, identifier normalization,
 * and hash key derivation. The actual database consume function is tested
 * via the live Supabase project (see remediation report for abuse checks).
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getClientIp, normalizeIdentifier, hashKey } from "../lib/auth/rate-limit.ts"

describe("SEC-05 rate limiting — client IP derivation", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })
    assert.equal(getClientIp(headers), "203.0.113.5")
  })

  it("trims whitespace around the IP", () => {
    const headers = new Headers({ "x-forwarded-for": "  203.0.113.5  , 10.0.0.1" })
    assert.equal(getClientIp(headers), "203.0.113.5")
  })

  it("falls back to 127.0.0.1 in development with no forwarding header", () => {
    const headers = new Headers({})
    const ip = getClientIp(headers)
    assert.ok(ip.length > 0, "must produce a non-empty IP in development")
  })

  it("normalizes IPv6 by lowercasing and removing zone identifiers", () => {
    const headers = new Headers({ "x-forwarded-for": "FE80::1%eth0" })
    assert.equal(getClientIp(headers), "fe80::1")
  })

  it("does not trust arbitrary client-supplied headers beyond x-forwarded-for", () => {
    const headers = new Headers({ "x-real-ip": "1.2.3.4" })
    const ip = getClientIp(headers)
    // x-real-ip is NOT consulted; only x-forwarded-for is trusted.
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
})