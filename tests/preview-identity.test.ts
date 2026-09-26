import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  isPreviewItem,
  hasPreviewItems,
  PREVIEW_MESSAGE,
  PREVIEW_GUEST_MESSAGE,
  type PreviewIdentity,
} from "../lib/preview-identity.ts"

// The recognizer outlives the preview data. Once the fixtures in
// content/preview-products.ts are deleted, a guest cart persisted in an older
// browser can still hold reserved identities, and those must never reach an
// order. So this module is tested directly rather than only through the order
// boundary, and it must not consult KABIA_BRAND_PREVIEW.

const FIELDS = ["id", "slug", "productId", "variantId"] as const
const RESERVED = ["onizleme-badem", "kabia-preview:badem"]

describe("isPreviewItem", () => {
  it("recognizes both reserved prefixes on every identity field", () => {
    for (const field of FIELDS) {
      for (const value of RESERVED) {
        assert.equal(isPreviewItem({ [field]: value }), true, `${field}=${value}`)
      }
    }
  })

  it("leaves ordinary catalog identities alone", () => {
    const real: PreviewIdentity = {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "kabuklu-badem",
      productId: "11111111-1111-4111-8111-111111111111",
      variantId: "22222222-2222-4222-8222-222222222222",
    }
    assert.equal(isPreviewItem(real), false)
  })

  it("requires the reserved token to be a prefix, not a substring", () => {
    assert.equal(isPreviewItem({ slug: "badem-onizleme-500g" }), false)
    assert.equal(isPreviewItem({ id: "urun:kabia-preview:badem" }), false)
  })

  it("treats an item with no identity fields as ordinary", () => {
    assert.equal(isPreviewItem({}), false)
    assert.equal(isPreviewItem({ slug: undefined }), false)
  })

  it("flags an item when only one of several fields is reserved", () => {
    assert.equal(
      isPreviewItem({ slug: "kabuklu-badem", variantId: "kabia-preview:badem:500g" }),
      true,
    )
  })

  it("does not throw on non-string field values from stale local storage", () => {
    const malformed = { slug: 42, id: null, productId: {}, variantId: [] } as unknown as PreviewIdentity
    assert.equal(isPreviewItem(malformed), false)
  })

  it("answers the same with the preview switch off as on", () => {
    const previous = process.env.KABIA_BRAND_PREVIEW
    try {
      const item = { slug: "onizleme-badem" }
      process.env.KABIA_BRAND_PREVIEW = "0"
      assert.equal(isPreviewItem(item), true)
      delete process.env.KABIA_BRAND_PREVIEW
      assert.equal(isPreviewItem(item), true)
      process.env.KABIA_BRAND_PREVIEW = "1"
      assert.equal(isPreviewItem(item), true)
    } finally {
      if (previous === undefined) delete process.env.KABIA_BRAND_PREVIEW
      else process.env.KABIA_BRAND_PREVIEW = previous
    }
  })
})

describe("hasPreviewItems", () => {
  it("is false for an empty cart", () => {
    assert.equal(hasPreviewItems([]), false)
  })

  it("is false for a cart of ordinary products", () => {
    assert.equal(hasPreviewItems([{ slug: "kabuklu-badem" }, { slug: "tarhana" }]), false)
  })

  it("is true for a mixed cart, whichever position the preview item holds", () => {
    assert.equal(hasPreviewItems([{ slug: "onizleme-badem" }, { slug: "tarhana" }]), true)
    assert.equal(hasPreviewItems([{ slug: "tarhana" }, { slug: "onizleme-badem" }]), true)
  })

  it("is true for a cart holding only preview items", () => {
    assert.equal(hasPreviewItems([{ id: "kabia-preview:badem" }]), true)
  })
})

describe("explanatory messages", () => {
  it("supplies distinct non-empty Turkish copy for the cart and guest cases", () => {
    assert.ok(PREVIEW_MESSAGE.length > 0)
    assert.ok(PREVIEW_GUEST_MESSAGE.length > 0)
    assert.notEqual(PREVIEW_MESSAGE, PREVIEW_GUEST_MESSAGE)
  })
})

describe("S23 — normalized recognition", () => {
  it("still recognizes every real preview identity shape", () => {
    for (const value of ["onizleme-badem", "onizleme-badem-500g", "kabia-preview:badem", "kabia-preview:badem:500g"]) {
      assert.equal(isPreviewItem({ slug: value }), true, value)
    }
  })

  it("rejects the bare prefixes with no token", () => {
    assert.equal(isPreviewItem({ slug: "onizleme-" }), false)
    assert.equal(isPreviewItem({ id: "kabia-preview:" }), false)
    assert.equal(isPreviewItem({ slug: "" }), false)
  })

  it("normalizes padding, case and zero-width characters", () => {
    assert.equal(isPreviewItem({ slug: "  onizleme-badem  " }), true)
    assert.equal(isPreviewItem({ slug: "ONIZLEME-Badem" }), true)
    assert.equal(isPreviewItem({ slug: "onizleme-\u200Bbadem" }), true)
    assert.equal(isPreviewItem({ id: "KABIA-PREVIEW:Badem" }), true)
  })

  it("keeps anchored shapes (no substring or suffix games)", () => {
    assert.equal(isPreviewItem({ slug: "xonizleme-badem" }), false)
    assert.equal(isPreviewItem({ slug: "onizleme-badem!" }), false)
    assert.equal(isPreviewItem({ slug: "onizleme--badem" }), false)
  })
})
