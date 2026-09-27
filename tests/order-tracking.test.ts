import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  buildTrackingUrl,
  carrierTrackingUrl,
  formatTrackingLine,
  hasTracking,
  normalizeCarrierName,
} from "../lib/tracking.ts"

// Customer shipment visibility: the admin's tracking_carrier /
// tracking_number surface on the customer's own orders. A "track" link
// appears only for carriers whose GET deep-link format was verified on the
// carrier's own official site — none verified yet, so no link anywhere.

describe("hasTracking", () => {
  it("is true when either field is set", () => {
    assert.equal(hasTracking("Aras Kargo", "123"), true)
    assert.equal(hasTracking("Aras Kargo", null), true)
    assert.equal(hasTracking(null, "123"), true)
  })

  it("is false when neither is set (whitespace counts as unset)", () => {
    assert.equal(hasTracking(null, null), false)
    assert.equal(hasTracking("", ""), false)
    assert.equal(hasTracking("   ", "  "), false)
    assert.equal(hasTracking(undefined, undefined), false)
  })
})

describe("formatTrackingLine", () => {
  it("combines carrier and number for the list line", () => {
    assert.equal(formatTrackingLine("Aras Kargo", "123"), "Aras Kargo · Takip no: 123")
    assert.equal(formatTrackingLine("Aras Kargo", null), "Aras Kargo")
    assert.equal(formatTrackingLine(null, "123"), "Takip no: 123")
  })

  it("returns null when there is nothing to show (no placeholder)", () => {
    assert.equal(formatTrackingLine(null, null), null)
    assert.equal(formatTrackingLine("", "  "), null)
  })
})

describe("normalizeCarrierName", () => {
  it("folds the admin free text to canonical keys", () => {
    assert.equal(normalizeCarrierName("Aras Kargo"), "aras")
    assert.equal(normalizeCarrierName("  ARAS  "), "aras")
    assert.equal(normalizeCarrierName("Yurtiçi Kargo"), "yurtici")
    assert.equal(normalizeCarrierName("MNG Kargo"), "mng")
    assert.equal(normalizeCarrierName("PTT Kargo"), "ptt")
    assert.equal(normalizeCarrierName("Sürat Kargo"), "surat")
  })

  it("returns null for empty input", () => {
    assert.equal(normalizeCarrierName(null), null)
    assert.equal(normalizeCarrierName(""), null)
    assert.equal(normalizeCarrierName("   "), null)
  })
})

describe("carrierTrackingUrl: no link for unverified carriers", () => {
  it("returns null for every domestic carrier (none verified)", () => {
    for (const carrier of ["Aras Kargo", "Yurtiçi Kargo", "MNG Kargo", "PTT", "Sürat Kargo", "aras", "mng"]) {
      assert.equal(carrierTrackingUrl(carrier, "123456"), null, carrier)
    }
  })

  it("returns null for unknown carriers and missing input", () => {
    assert.equal(carrierTrackingUrl("Bilinmeyen Taşıyıcı", "123"), null)
    assert.equal(carrierTrackingUrl("Aras Kargo", null), null)
    assert.equal(carrierTrackingUrl("Aras Kargo", "  "), null)
    assert.equal(carrierTrackingUrl(null, "123"), null)
    assert.equal(carrierTrackingUrl(null, null), null)
  })
})

describe("buildTrackingUrl encoding", () => {
  it("URL-encodes the tracking number", () => {
    assert.equal(
      buildTrackingUrl("https://example.com/track?no=", "AB 123/+"),
      "https://example.com/track?no=AB%20123%2F%2B",
    )
    assert.equal(buildTrackingUrl("https://example.com/", "123456"), "https://example.com/123456")
  })
})

describe("account UI wiring", () => {
  it("detail page shows the tracking section from the order row", () => {
    const src = readFileSync("app/hesabim/siparislerim/[orderId]/detail-client.tsx", "utf8")
    assert.ok(src.includes("OrderTrackingSection"), "section missing")
    assert.ok(src.includes("order.trackingCarrier"), "carrier not passed")
    assert.ok(src.includes("order.trackingNumber"), "number not passed")
  })

  it("list page shows the short tracking line", () => {
    const src = readFileSync("app/hesabim/siparislerim/page.tsx", "utf8")
    assert.ok(src.includes("OrderTrackingLine"), "line missing")
    assert.ok(src.includes("order.trackingCarrier"), "carrier not passed")
    assert.ok(src.includes("order.trackingNumber"), "number not passed")
  })

  it("tracking component hides silently and links safely", () => {
    const src = readFileSync("components/account/order-tracking.tsx", "utf8")
    assert.ok(src.includes("if (!hasTracking(carrier, trackingNumber)) return null"), "must render nothing when unset")
    assert.ok(!src.includes("henüz yok"), "no placeholder text")
    assert.ok(src.includes('target="_blank"'), "link must open in a new tab")
    assert.ok(src.includes('rel="noopener noreferrer"'), "link must be hardened")
    assert.ok(src.includes("Kargoyu takip et"), "link label missing")
    assert.ok(src.includes("Kopyala"), "copy button missing")
    assert.ok(src.includes('aria-live="polite"'), "copy must announce to screen readers")
    assert.ok(src.includes("kopyalandı"), "copy announcement missing")
  })

  it("order context maps the admin-written columns", () => {
    const ctx = readFileSync("lib/orders-context.tsx", "utf8")
    assert.ok(ctx.includes("trackingCarrier"), "record field missing")
    assert.ok(ctx.includes("trackingNumber"), "record field missing")
    assert.ok(ctx.includes("o.tracking_carrier"), "mapper must read the column")
    assert.ok(ctx.includes("o.tracking_number"), "mapper must read the column")
    const rows = readFileSync("lib/supabase/rows.ts", "utf8")
    assert.ok(rows.includes("tracking_carrier: string | null"), "row type missing carrier")
    assert.ok(rows.includes("tracking_number: string | null"), "row type missing number")
  })

  it("shipped email shares the same verified helper (still no unverified link)", () => {
    const src = readFileSync("lib/email/order-shipped.ts", "utf8")
    assert.ok(src.includes('from "@/lib/tracking"'), "must use the shared helper")
    const index = readFileSync("lib/email/index.ts", "utf8")
    assert.ok(index.includes("carrierTrackingUrl"), "public surface kept")
  })
})
