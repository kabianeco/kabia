import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  hasSessionCookies,
  isPrefetchRequest,
  isStaticAssetPath,
  isTokenNearExpiry,
  sessionExpiryMs,
  shouldSkipAdminRefresh,
} from "../lib/auth/refresh-skip.ts"

const read = (p: string) => readFileSync(p, "utf8")
const H = (obj: Record<string, string>) => new Headers(obj)

describe("proxy skips refresh where it should", () => {
  it("detects prefetch requests", () => {
    assert.equal(isPrefetchRequest(H({ "Next-Router-Prefetch": "1" })), true)
    assert.equal(isPrefetchRequest(H({ "Sec-Purpose": "prefetch" })), true)
    assert.equal(isPrefetchRequest(H({})), false)
  })

  it("detects static assets", () => {
    for (const p of ["/_next/static/x.js", "/images/a.jpg", "/favicon.ico", "/robots.txt", "/foo/bar.png", "/sitemap.xml"]) {
      assert.equal(isStaticAssetPath(p), true, p)
    }
    for (const p of ["/admin", "/admin/orders", "/hesabim", "/giris", "/odeme"]) {
      assert.equal(isStaticAssetPath(p), false, p)
    }
  })

  it("needs session cookies to refresh", () => {
    assert.equal(hasSessionCookies([]), false)
    assert.equal(hasSessionCookies([{ name: "sb-xyz-auth-token" }]), true)
    assert.equal(hasSessionCookies([{ name: "other" }]), false)
  })

  it("treats far-future tokens as no-refresh, near/unknown as refresh", () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    const cookie = encodeURIComponent(JSON.stringify({ access_token: "x", expires_at: future }))
    assert.equal(isTokenNearExpiry(cookie), false)
    const soon = encodeURIComponent(JSON.stringify({ access_token: "x", expires_at: Math.floor(Date.now() / 1000) + 10 }))
    assert.equal(isTokenNearExpiry(soon), true)
    assert.equal(isTokenNearExpiry(undefined), true)
    assert.ok((sessionExpiryMs(cookie) ?? 0) > 60_000)
  })

  it("skips admin refresh for prefetch/static/anon/far-expiry", () => {
    const baseCookies = [{ name: "sb-xyz-auth-token", value: encodeURIComponent(JSON.stringify({ access_token: "x", expires_at: Math.floor(Date.now() / 1000) + 3600 })) }]
    assert.equal(shouldSkipAdminRefresh({ headers: H({ "Next-Router-Prefetch": "1" }), pathname: "/admin", cookies: baseCookies }), true)
    assert.equal(shouldSkipAdminRefresh({ headers: H({}), pathname: "/_next/static/x.js", cookies: baseCookies }), true)
    assert.equal(shouldSkipAdminRefresh({ headers: H({}), pathname: "/admin", cookies: [] }), true)
    assert.equal(shouldSkipAdminRefresh({ headers: H({}), pathname: "/admin", cookies: baseCookies }), true, "far expiry skips")
    const near = [{ name: "sb-xyz-auth-token", value: encodeURIComponent(JSON.stringify({ access_token: "x", expires_at: Math.floor(Date.now() / 1000) + 10 })) }]
    assert.equal(shouldSkipAdminRefresh({ headers: H({}), pathname: "/admin", cookies: near }), false, "near expiry refreshes")
  })

  it("proxy wires the skip before any getUser", () => {
    const src = read("proxy.ts")
    assert.ok(src.includes("shouldSkipAdminRefresh"), "proxy must consult the skip")
    const skipAt = src.indexOf("shouldSkipAdminRefresh")
    const getUserAt = src.indexOf("supabase.auth.getUser()")
    assert.ok(skipAt !== -1 && getUserAt !== -1 && skipAt < getUserAt, "skip must precede getUser")
    assert.ok(src.includes("x-kabia-admin-guard"), "guard header stays")
  })
})
