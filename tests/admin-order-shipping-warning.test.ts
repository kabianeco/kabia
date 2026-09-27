import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Shipping without tracking: moving an order to kargoda with no carrier or
// tracking number must warn that the one-shot shipping email goes out
// without tracking — without blocking the transition. Database-free,
// source-assertion style like the trigger-wiring suites.

const CONTROLS = "app/admin/(protected)/orders/[orderId]/order-controls.tsx"
const PAGE = "app/admin/(protected)/orders/[orderId]/page.tsx"

describe("shipping-without-tracking confirmation", () => {
  it("warns when targeting kargoda with no tracking on file", () => {
    const src = readFileSync(CONTROLS, "utf8")
    assert.ok(src.includes("hasTracking"), "controls must know the tracking state")
    assert.ok(
      src.includes('selected === "kargoda"'),
      "warning must trigger on the kargoda target",
    )
    assert.ok(
      src.includes("takipsiz"),
      "warning copy must say the email goes out without tracking",
    )
    assert.ok(src.includes('role="alert"'), "warning must be announced")
  })

  it("confirms but never blocks: submit re-enables after confirmation", () => {
    const src = readFileSync(CONTROLS, "utf8")
    assert.ok(src.includes("trackingConfirmed"), "confirmation state missing")
    assert.ok(
      src.includes("Takipsiz göndereceğimi onaylıyorum"),
      "confirmation checkbox copy missing",
    )
    // The gate is confirm-to-proceed, not a hard block: the disabled flag
    // must include the unconfirmed state, and nothing else forbids kargoda.
    assert.ok(
      src.includes("needsTrackingConfirm"),
      "submit must stay disabled only until confirmed",
    )
    assert.ok(
      !src.includes("shippingWithoutTracking && false"),
      "transition must not be unconditionally blocked",
    )
  })

  it("detail page derives tracking state from both fields", () => {
    const src = readFileSync(PAGE, "utf8")
    assert.ok(src.includes("hasTracking={"), "page must pass hasTracking")
    assert.ok(
      src.includes("order.tracking_carrier") && src.includes("order.tracking_number"),
      "both carrier and number must count as tracking",
    )
  })
})
