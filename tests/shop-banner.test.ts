import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { shopBannerVisible, type ShopBannerSettings } from "../lib/shop-banner.ts"

const base = (): ShopBannerSettings => ({
  enabled: true,
  headline: "Hasat başladı",
  subtext: "Bu haftanın taze bademi",
  imageUrl: "/images/almonds-drying.jpg",
  ctaLabel: "Şimdi incele",
  ctaHref: "/shop?kategori=cig-badem",
})

describe("shopBannerVisible", () => {
  it("is visible when enabled with a headline and an image", () => {
    assert.equal(shopBannerVisible(base()), true)
  })

  it("is hidden when disabled, even with full content", () => {
    assert.equal(shopBannerVisible({ ...base(), enabled: false }), false)
  })

  it("is hidden when the headline is empty", () => {
    assert.equal(shopBannerVisible({ ...base(), headline: "" }), false)
  })

  it("is hidden when the headline is only whitespace", () => {
    assert.equal(shopBannerVisible({ ...base(), headline: "   " }), false)
  })

  it("is hidden when the image URL is empty", () => {
    assert.equal(shopBannerVisible({ ...base(), imageUrl: "" }), false)
  })

  it("stays visible without a CTA — the button is optional", () => {
    assert.equal(
      shopBannerVisible({ ...base(), ctaLabel: "", ctaHref: "" }),
      true,
    )
  })
})
