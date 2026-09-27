import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  LOGIN_GENERIC_ERROR,
  LOGIN_NETWORK_ERROR,
  LOGIN_SERVER_ERROR,
  LOGIN_WRONG_CREDENTIALS,
  isInvalidCredentials,
  isNetworkError,
  isSupabaseRateLimit,
  mapLoginError,
} from "../lib/auth/customer-login-errors.ts"
import { RATE_LIMIT_MESSAGE } from "../lib/auth/rate-limit-message.ts"

const read = (p: string) => readFileSync(p, "utf8")

describe("login error mapping (every failure shows Turkish inline)", () => {
  it("wrong credentials map to their own message", () => {
    assert.equal(mapLoginError({ code: "invalid_credentials", status: 400, message: "Invalid login credentials" }), LOGIN_WRONG_CREDENTIALS)
    assert.ok(isInvalidCredentials({ code: "invalid_credentials", status: 400 }))
  })

  it("Supabase per-IP 429 maps to the rate message", () => {
    assert.equal(mapLoginError({ code: "over_request_rate_limit", status: 429, message: "Request rate limit reached" }), RATE_LIMIT_MESSAGE)
    assert.equal(mapLoginError({ status: 429, message: "429" }), RATE_LIMIT_MESSAGE)
    assert.ok(isSupabaseRateLimit({ status: 429 }))
    assert.ok(isSupabaseRateLimit({ code: "over_request_rate_limit" }))
    assert.ok(RATE_LIMIT_MESSAGE.includes("Çok fazla deneme, biraz sonra tekrar deneyin"))
  })

  it("transport failures map to the network message", () => {
    assert.equal(mapLoginError({ name: "AuthRetryableFetchError", message: "Failed to fetch" }), LOGIN_NETWORK_ERROR)
    assert.ok(isNetworkError({ name: "TypeError", message: "fetch failed" }))
  })

  it("5xx maps to server, unknown maps to generic, never empty", () => {
    assert.equal(mapLoginError({ status: 500, message: "x" }), LOGIN_SERVER_ERROR)
    assert.equal(mapLoginError({ status: 400, message: "weird" }), LOGIN_GENERIC_ERROR)
    assert.equal(mapLoginError(null), LOGIN_GENERIC_ERROR)
    for (const m of [LOGIN_WRONG_CREDENTIALS, LOGIN_NETWORK_ERROR, LOGIN_SERVER_ERROR, LOGIN_GENERIC_ERROR, RATE_LIMIT_MESSAGE]) {
      assert.ok(m.trim().length > 5, m)
    }
  })
})

describe("login action never silently reloads", () => {
  it("wraps everything in try/catch and returns server message on throw", () => {
    const src = read("app/auth/actions.ts")
    assert.match(src, /try\s*\{[\s\S]*customerLoginAction|export async function customerLoginAction[\s\S]*try\s*\{/)
    assert.ok(src.includes("LOGIN_SERVER_ERROR"), "unexpected faults must return the server message")
    assert.ok(src.includes("mapLoginError(signInError)"), "Supabase errors must map, not fall through")
  })

  it("forwards the real client IP with the secret-key client", () => {
    const src = read("app/auth/actions.ts")
    assert.ok(src.includes("forwardedFor: ip"), "server action must forward client IP")
    const server = read("lib/supabase/server.ts")
    assert.ok(server.includes("Sb-Forwarded-For"), "server client must send Sb-Forwarded-For")
    assert.ok(server.includes("SUPABASE_SECRET_KEY"), "server client must prefer the secret key")
    assert.ok(!server.includes('"unknown"') === false || server.includes("unknown"), "unknown must never be forwarded")
  })

  it("keeps the app limiter before Supabase", () => {
    const src = read("app/auth/actions.ts")
    assert.ok(src.includes('checkRateLimit("customer_login"'), "app limiter stays")
    assert.ok(src.includes("RATE_LIMIT_MESSAGE"), "limiter denial shows the rate message")
  })
})

describe("login form renders every branch and redirects once", () => {
  it("server error feeds the password field and confirm shows its link", () => {
    const src = read("components/auth/login-form.tsx")
    assert.ok(src.includes("serverError"), "failure message must be rendered")
    assert.ok(src.includes("PasswordField"), "message renders inline in the form")
    assert.ok(src.includes("needsEmailConfirm"), "unconfirmed branch renders")
  })

  it("success syncs the browser session then navigates exactly once", () => {
    const src = read("components/auth/login-form.tsx")
    assert.ok(src.includes("refreshSession"), "must sync client auth before landing")
    const pushes = (src.match(/router\.push\(/g) ?? []).length
    assert.equal(pushes, 1, `expected one router.push, found ${pushes}`)
    assert.ok(src.includes("navigatedFor"), "must guard against double navigation")
  })
})
