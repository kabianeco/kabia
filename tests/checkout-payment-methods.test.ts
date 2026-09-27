import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

// No payment provider is integrated, so card checkout took no money while
// looking like it did. Until a provider lands, checkout offers cash on
// delivery only and create_order rejects anything else server-side.

describe("checkout offers cash on delivery only", () => {
  it("payment step has no card option and no card fields", () => {
    const src = readFileSync("components/checkout/payment-step.tsx", "utf8")
    assert.ok(!src.includes("card"), "no card references may remain")
    assert.ok(!src.includes("Kart numarası"), "card number field removed")
    assert.ok(!src.includes("CVV"), "CVV field removed")
    assert.ok(!src.includes("Son kullanma"), "expiry field removed")
    assert.ok(!src.includes("Kart üzerindeki isim"), "card name field removed")
    assert.ok(!src.includes("Kredi / banka kartı"), "card option removed")
    assert.ok(src.includes("Kapıda ödeme"), "cash on delivery stays")
    assert.ok(src.includes("isPaymentValid"), "continue gate stays")
  })

  it("payment types carry no card data", () => {
    const src = readFileSync("components/checkout/types.ts", "utf8")
    assert.ok(!src.includes("cardNumber"), "cardNumber gone from the type")
    assert.ok(!src.includes("cvv"), "cvv gone from the type")
    assert.ok(!src.includes("expiry"), "expiry gone from the type")
    assert.ok(!src.includes("cardName"), "cardName gone from the type")
    assert.match(src, /PaymentMethod = "cod"/)
    assert.match(src, /method: "cod"/)
  })

  it("card preview component is gone", () => {
    assert.equal(
      existsSync("components/checkout/card-preview.tsx"),
      false,
      "card-preview.tsx removed with the card UI",
    )
  })

  it("review step shows cash on delivery with no masked card", () => {
    const src = readFileSync("components/checkout/review-step.tsx", "utf8")
    assert.ok(src.includes("Kapıda ödeme"), "review shows cash on delivery")
    assert.ok(!src.includes("maskedCardNumber"), "no masked card rendering")
    assert.ok(!src.includes("cardNumber"), "no card number reference")
    assert.ok(!src.includes("cardName"), "no card name reference")
  })

  it("order submission sends no card parameters", () => {
    const src = readFileSync("components/checkout/checkout-flow.tsx", "utf8")
    assert.ok(!src.includes("detectNetwork"), "no card brand detection")
    assert.ok(!src.includes("cardNumber"), "no card number handling")
    assert.ok(src.includes("p_card_last4: null"), "card params stay null")
    assert.ok(src.includes("p_card_brand: null"), "card params stay null")
    assert.ok(src.includes("p_card_expiry: null"), "card params stay null")
    assert.ok(src.includes("p_card_name: null"), "card params stay null")
  })

  it("payment validation accepts only cash on delivery", () => {
    const src = readFileSync("components/checkout/validation.ts", "utf8")
    assert.ok(src.includes('data.method === "cod"'), "cod-only gate")
    assert.ok(!src.includes("cardNumber"), "no card number validation")
    assert.ok(!src.includes("cvv"), "no CVV validation")
  })
})

describe("create_order rejects non-cod server-side", () => {
  const sql = readFileSync(
    "supabase/migrations/20260927001000_create_order_cod_only.sql",
    "utf8",
  )

  it("whitelists only cod", () => {
    assert.match(sql, /if p_payment_method is distinct from 'cod' then raise exception 'Geçersiz ödeme yöntemi\.'/)
    assert.ok(
      !sql.includes("is distinct from 'card'"),
      "card must no longer be an accepted method",
    )
  })

  it("always writes the cod snapshot (no card branch)", () => {
    assert.ok(
      sql.includes("v_payment := jsonb_build_object('method','cod','label','Kapıda Ödeme');"),
      "unconditional cod snapshot",
    )
    assert.ok(!sql.includes("'method','card'"), "card snapshot branch gone")
  })

  it("keeps the 10-parameter signature for deployed clients", () => {
    assert.match(sql, /p_card_last4 text DEFAULT NULL/)
    assert.match(sql, /p_email text DEFAULT NULL/)
    assert.match(sql, /revoke all on function public\.create_order\(jsonb, text, boolean, boolean, text, text, text, text, text, text\) from public, anon/)
  })
})
