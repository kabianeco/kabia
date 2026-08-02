import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  shopBannerVisible,
  isPlausibleBannerImageUrl,
  type ShopBannerSettings,
} from "../lib/shop-banner.ts"

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

  it("is hidden when the image URL is a non-allowlisted host, even with enabled and a headline", () => {
    assert.equal(
      shopBannerVisible({ ...base(), imageUrl: "https://i.imgur.com/x.jpg" }),
      false,
    )
  })
})

describe("isPlausibleBannerImageUrl", () => {
  it("accepts a root-relative path", () => {
    assert.equal(isPlausibleBannerImageUrl("/images/x.jpg"), true)
  })

  it("rejects a protocol-relative path", () => {
    assert.equal(isPlausibleBannerImageUrl("//evil.example.com/x.jpg"), false)
  })

  it("accepts an allowlisted https host", () => {
    assert.equal(isPlausibleBannerImageUrl("https://picsum.photos/200"), true)
  })

  it("rejects a non-allowlisted host", () => {
    assert.equal(isPlausibleBannerImageUrl("https://i.imgur.com/x.jpg"), false)
  })

  it("rejects a non-https URL", () => {
    assert.equal(isPlausibleBannerImageUrl("http://picsum.photos/x.jpg"), false)
  })

  it("rejects a whitespace-only string", () => {
    assert.equal(isPlausibleBannerImageUrl("   "), false)
  })
})
