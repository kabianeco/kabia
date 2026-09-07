import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { productSchema } from "../lib/admin/schemas.ts"

/**
 * The save action parses through `productSchema` before writing. A taxonomy
 * field that the schema drops never reaches the payload, however carefully the
 * form renders it — so the schema is one of the four places a field has to
 * appear, alongside the form, the write payload and the detail select.
 */

const base = {
  name: "Kabuklu Ceviz",
  slug: "kabuklu-ceviz",
  category_id: "11111111-1111-4111-8111-111111111111",
  short_description: "Kısa açıklama",
  description: "Uzun açıklama",
  base_price: "590",
  original_price: "",
  main_image_url: "/images/kabuklu-ceviz.jpeg",
  origin: null,
  production_method: null,
  shelf_life: null,
  storage_conditions: null,
  certifications: null,
  is_active: true,
  is_featured: false,
  low_stock_threshold: "5",
  display_order: "0",
  seo_title: null,
  seo_description: null,
  source: "secki",
  certification: "kabia_secki",
  producer_id: "22222222-2222-4222-8222-222222222222",
  harvest_year: "2025",
  lot_code: "KC-2025-01",
  variety: "Chandler",
  rootstock: "",
  processing: "",
  allergens: "",
  net_weight: "500 g",
  variants: [{ label: "500 g", price: 590, stock_quantity: 3 }],
}

describe("product schema — taxonomy fields", () => {
  it("keeps every taxonomy field through parsing", () => {
    const parsed = productSchema.safeParse(base)
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues))
    assert.equal(parsed.data.source, "secki")
    assert.equal(parsed.data.certification, "kabia_secki")
    assert.equal(parsed.data.producer_id, "22222222-2222-4222-8222-222222222222")
    assert.equal(parsed.data.harvest_year, 2025)
    assert.equal(parsed.data.lot_code, "KC-2025-01")
    assert.equal(parsed.data.variety, "Chandler")
    assert.equal(parsed.data.net_weight, "500 g")
  })

  it("turns the optional taxonomy blanks into null rather than empty strings", () => {
    const parsed = productSchema.safeParse(base)
    assert.ok(parsed.success)
    assert.equal(parsed.data.rootstock, null)
    assert.equal(parsed.data.processing, null)
    assert.equal(parsed.data.allergens, null)
  })

  it("accepts a product with no producer", () => {
    const parsed = productSchema.safeParse({ ...base, producer_id: "", harvest_year: "" })
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues))
    assert.equal(parsed.data.producer_id, null)
    assert.equal(parsed.data.harvest_year, null)
  })

  it("refuses a source or certification outside the database enums", () => {
    assert.equal(productSchema.safeParse({ ...base, source: "bahce" }).success, false)
    assert.equal(productSchema.safeParse({ ...base, certification: "organik" }).success, false)
    assert.equal(productSchema.safeParse({ ...base, certification: "" }).success, false)
  })

  it("requires a certification rather than defaulting to one", () => {
    const withoutCertification: Record<string, unknown> = { ...base }
    delete withoutCertification.certification
    assert.equal(productSchema.safeParse(withoutCertification).success, false)
  })

  it("never lets a missing or malformed value become an organic claim", () => {
    for (const certification of [undefined, "", "organik", "ORGANIK_SERTIFIKALI", null]) {
      const parsed = productSchema.safeParse({ ...base, certification })
      assert.equal(
        parsed.success && parsed.data.certification === "organik_sertifikali",
        false,
        `${String(certification)} must not resolve to an organic claim`,
      )
    }
  })

  it("refuses a producer reference that is not a real record id", () => {
    assert.equal(productSchema.safeParse({ ...base, producer_id: "ege-ceviz" }).success, false)
  })

  it("bounds the harvest year to plausible seasons", () => {
    assert.equal(productSchema.safeParse({ ...base, harvest_year: "1899" }).success, false)
    assert.equal(productSchema.safeParse({ ...base, harvest_year: "2100" }).success, false)
    assert.equal(productSchema.safeParse({ ...base, harvest_year: "2019" }).success, true)
  })
})
