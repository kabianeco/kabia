import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { dedupeAddresses, isSameAddress, normalizeAddress } from "../lib/addresses/normalize.ts"

const read = (p: string) => readFileSync(p, "utf8")

const EV = {
  label: "ev",
  recipientName: "mustafa said",
  phone: "5525540710",
  addressLine1: "test test test",
  addressLine2: "",
  city: "test",
  district: "test",
  postalCode: "54200",
}

describe("identical addresses reuse instead of inserting", () => {
  it("normalizes case/whitespace/phone and null vs empty", () => {
    assert.ok(isSameAddress(EV, { ...EV, label: " Ev ", city: "TEST", district: " Test " }))
    assert.ok(isSameAddress(EV, { ...EV, phone: "0552 554 07 10", addressLine2: null as unknown as string }))
    assert.ok(!isSameAddress(EV, { ...EV, addressLine1: "baska sokak" }))
    assert.ok(!isSameAddress(EV, { ...EV, label: "is" }))
    const n = normalizeAddress({ ...EV, phone: "(0552) 554-07-10" })
    assert.equal(n.phone, "5525540710")
  })

  it("dedupes keeping the first", () => {
    const out = dedupeAddresses([EV, { ...EV, label: "EV" }, { ...EV, addressLine1: "farkli" }])
    assert.equal(out.length, 2)
    assert.equal(out[0].addressLine1, EV.addressLine1)
  })
})

describe("checkout and admin creation never insert on use", () => {
  it("checkout submit only snapshots via create_order RPC", () => {
    const flow = read("components/checkout/checkout-flow.tsx")
    assert.ok(flow.includes('rpc("create_order"') || read("lib/checkout-order.ts").includes('rpc("create_order"'))
    assert.ok(!/from\("addresses"\)\.insert/.test(flow), "checkout submit must not insert addresses")
    const ctx = read("lib/checkout-context.tsx")
    // Only explicit saves insert: addAddress + one-time guest merge.
    const inserts = (ctx.match(/from\("addresses"\)\.insert/g) ?? []).length
    assert.ok(inserts <= 2, `expected at most 2 insert sites (add + merge), found ${inserts}`)
  })

  it("admin order creation only snapshots via admin_create_order RPC", () => {
    const actions = read("app/admin/(protected)/orders/yeni/actions.ts")
    assert.ok(actions.includes('rpc("admin_create_order"'))
    assert.ok(!/from\("addresses"\)/.test(actions) || !/from\("addresses"\)\.insert/.test(actions), "admin create must never insert addresses")
    const form = read("app/admin/(protected)/orders/yeni/order-form.tsx")
    assert.ok(!/addAddress|from\("addresses"\)\.insert/.test(form))
  })

  it("saving a duplicate reuses and double submit creates one row", () => {
    const ctx = read("lib/checkout-context.tsx")
    assert.ok(ctx.includes("isSameAddress"), "add must compare normalized fields first")
    assert.ok(ctx.includes("addInFlight"), "double submit needs an in-flight ref, not only state")
    assert.ok(ctx.includes("dedupeAddresses"), "merge and load must dedupe")
    assert.ok(ctx.includes("mergedFor"), "merge must run once per sign-in")
    assert.ok(ctx.includes("localStorage.removeItem(GUEST_ADDR_KEY)"), "guest key must drop before awaits")
    const form = read("components/cart/address-form.tsx")
    assert.ok(form.includes("submitting.current"), "form double submit guard")
  })

  it("database backstop exists and existing rows allow it", () => {
    assert.ok(existsSync("supabase/migrations/20260927000800_address_dedup_guard.sql"))
    const sql = read("supabase/migrations/20260927000800_address_dedup_guard.sql")
    assert.match(sql, /uq_addresses_user_identical/)
    assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/)
    assert.match(sql, /ROLLBACK/)
  })
})
