import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  setOrderStatus,
  type Bucket,
  type SessionUser,
} from "../lib/account/handlers.ts"
import { RATE_LIMIT_MESSAGE } from "../lib/auth/rate-limit-message.ts"

// Order-status preference: the switch customers were missing. Honest copy —
// order-received and order-cancelled always go; the switch controls shipping
// and delivery updates only. The write surfaces failures instead of flipping
// optimistically.

const USER: SessionUser = { id: "user-1", email: "musteri@example.com", hasPassword: true }

function fakes(overrides: Record<string, unknown> = {}) {
  const calls: string[] = []
  const deps = {
    calls,
    async getUser() { calls.push("getUser"); return USER as SessionUser | null },
    async allow(bucket: Bucket, key: string) { calls.push(`allow:${bucket}:${key}`); return true },
    async setOrderStatus(granted: boolean) { calls.push(`orderStatus:${granted}`); return true },
    ...overrides,
  }
  return deps
}

describe("setOrderStatus handler", () => {
  it("accepts only true/false and reports the saved value", async () => {
    const deps = fakes()
    assert.equal((await setOrderStatus({ granted: "true" }, deps)).granted, true)
    assert.equal((await setOrderStatus({ granted: "false" }, deps)).granted, false)
    assert.deepEqual(
      deps.calls.filter((c) => c.startsWith("orderStatus")),
      ["orderStatus:true", "orderStatus:false"],
    )
    assert.equal((await setOrderStatus({ granted: "yes" }, fakes())).ok, false)
  })

  it("is rate limited and reports a failed save so the switch keeps its value", async () => {
    assert.equal(
      (await setOrderStatus({ granted: "true" }, fakes({ allow: async () => false }))).message,
      RATE_LIMIT_MESSAGE,
    )
    assert.equal(
      (await setOrderStatus({ granted: "true" }, fakes({ setOrderStatus: async () => false }))).ok,
      false,
    )
  })

  it("requires a session", async () => {
    assert.equal(
      (await setOrderStatus({ granted: "true" }, fakes({ getUser: async () => null }))).ok,
      false,
    )
  })
})

describe("notification page switch", () => {
  const src = readFileSync("app/hesabim/bildirimler/page.tsx", "utf8")

  it("offers the order-status switch with honest copy", () => {
    assert.ok(src.includes("Kargo ve teslimat bildirimleri"), "switch label missing")
    assert.ok(
      src.includes("Sipariş alındı ve iptal e-postaları her zaman gönderilir"),
      "must say received and cancelled always go",
    )
    assert.ok(
      src.includes("yalnızca kargo ve teslimat bildirimlerini kapatır"),
      "must say the switch controls shipping/delivery only",
    )
    assert.ok(
      !src.includes("henüz gönderilmiyor"),
      "stale 'not sent yet' copy must be gone",
    )
  })

  it("never flips optimistically: state changes only on success", () => {
    const changeStart = src.indexOf("const changeOrderStatus")
    assert.ok(changeStart > 0, "changeOrderStatus missing")
    const body = src.slice(changeStart, changeStart + 800)
    assert.ok(body.includes("setOrderStatusAction"), "must call the server action")
    assert.ok(
      body.includes("if (result.ok) orderStatus.setGranted(next)"),
      "switch flips only after the server confirms",
    )
    assert.ok(
      body.includes("Tercihiniz kaydedilemedi"),
      "failure must be surfaced, not swallowed",
    )
  })

  it("hook defaults missing rows to on (opt-out model)", () => {
    const hook = readFileSync("lib/notification-prefs.ts", "utf8")
    assert.ok(hook.includes("useOrderStatusConsent"), "hook missing")
    assert.ok(
      hook.includes("data?.order_status !== false"),
      "missing row must read as granted",
    )
  })
})
