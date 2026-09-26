import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { destinationFor, parseConfirmation, validateSignupCode } from "../lib/auth/customer-confirm.ts"
import { confirmLink } from "../lib/auth/customer-confirm.ts"
import { issueRecoveryGrant, verifyRecoveryGrant } from "../lib/auth/recovery-grant.ts"

describe("customer email link destinations", () => {
  it("accepts only the destination assigned to each Supabase OTP type", () => {
    assert.equal(destinationFor("email", "/eposta-onaylandi"), "/eposta-onaylandi")
    assert.equal(destinationFor("recovery", "/sifre-yenile"), "/sifre-yenile")
    assert.equal(destinationFor("email_change", "/eposta-degisikligi-onaylandi"), "/eposta-degisikligi-onaylandi")
    assert.equal(destinationFor("email", "/sifre-yenile"), null)
    assert.equal(destinationFor("recovery", "/eposta-onaylandi"), null)
    assert.equal(destinationFor("email_change", "/sifre-yenile"), null)
  })

  it("rejects hosts, schemes, protocol-relative paths, backslashes and encoded bypasses", () => {
    for (const next of [
      "https://evil.example/eposta-onaylandi", "//evil.example", "/\\evil.example",
      "\\evil.example", "javascript:alert(1)", "/%2f%2fevil.example",
      "/eposta-onaylandi\\evil.example", "/eposta-onaylandi?next=//evil.example",
      "/eposta-onaylandi#evil", "/eposta-onaylandi/../sifre-yenile",
    ]) {
      assert.equal(destinationFor("email", next), null, next)
    }
    assert.equal(destinationFor("signup", "/eposta-onaylandi"), null)
  })

  it("rejects missing or duplicated query parameters before verification", () => {
    assert.equal(parseConfirmation(new URL("https://kabia.test/auth/confirm?type=email&next=/eposta-onaylandi")), null)
    assert.equal(parseConfirmation(new URL("https://kabia.test/auth/confirm?token_hash=abc&type=email&next=/eposta-onaylandi&next=/sifre-yenile")), null)
    assert.equal(parseConfirmation(new URL("https://kabia.test/auth/confirm?token_hash=abc&type=email&next=/%5cevil.example")), null)
  })
})

describe("confirmation route behavior with mocked Supabase client", () => {
  const url = new URL("https://kabia.test/auth/confirm?token_hash=abc&type=email&next=/eposta-onaylandi")

  it("verifies the token hash with the correct type and returns the allowed success path", async () => {
    const calls: unknown[] = []
    const client = { auth: { verifyOtp: async (value: unknown) => { calls.push(value); return { error: null } } } }
    assert.equal(await confirmLink(url, client), "/eposta-onaylandi")
    assert.deepEqual(calls, [{ token_hash: "abc", type: "email" }])
  })

  it("sends failed, malformed and hostile links to the error page without leaking the token", async () => {
    let calls = 0
    const client = { auth: { verifyOtp: async () => { calls++; return { error: { message: "private failure" } } } } }
    assert.equal(await confirmLink(url, client), "/baglanti-gecersiz?flow=signup")
    assert.equal(await confirmLink(new URL("https://kabia.test/auth/confirm?token_hash=abc&type=email&next=//evil.example"), client), "/baglanti-gecersiz?flow=signup")
    assert.equal(calls, 1)
  })
})

describe("signup code validation", () => {
  it("accepts exactly six ASCII digits and a valid email", () => {
    assert.deepEqual(validateSignupCode(" User@Example.com ", "012345"), { email: "user@example.com", token: "012345" })
    for (const token of ["12345", "1234567", "12345a", "１２３４５６", " 123456 "]) {
      assert.equal(validateSignupCode("user@example.com", token), null, token)
    }
    assert.equal(validateSignupCode("invalid", "123456"), null)
  })
})

describe("recovery session marker", () => {
  it("accepts only a current marker tied to the authenticated user", () => {
    const now = 1_700_000_000_000
    const marker = issueRecoveryGrant("user-a", now)
    assert.equal(verifyRecoveryGrant(marker, "user-a", now + 1), true)
    assert.equal(verifyRecoveryGrant(marker, "user-b", now + 1), false)
    assert.equal(verifyRecoveryGrant(marker, "user-a", now + 3_700_001), false)
    assert.equal(verifyRecoveryGrant(marker + "tampered", "user-a", now + 1), false)
    assert.equal(verifyRecoveryGrant(undefined, "user-a", now + 1), false)
  })
})
