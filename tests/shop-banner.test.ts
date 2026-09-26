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

describe("S24 — unlisted hosts and malformed URLs stay out", () => {
  it("rejects unlisted hosts, non-https and malformed values", () => {
    for (const url of [
      "https://evil.example.com/x.jpg",
      "http://picsum.photos/seed/a/100/100",
      "data:image/png;base64,AAA",
      "blob:https://x",
      "//picsum.photos/x.jpg",
      "not a url",
      "",
    ]) {
      assert.equal(isPlausibleBannerImageUrl(url), false, url || "(empty)")
    }
  })

  it("accepts site-relative paths and the allowlisted hosts", () => {
    assert.equal(isPlausibleBannerImageUrl("/images/kabuklu-badem-acik.jpeg"), true)
    assert.equal(isPlausibleBannerImageUrl("https://picsum.photos/seed/a/100/100"), true)
    assert.equal(isPlausibleBannerImageUrl("https://fastly.picsum.photos/seed/a/100/100"), true)
  })

  it("save schemas enforce the allowlist on all three URL fields", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync("lib/admin/schemas.ts", "utf8")
    assert.match(src, /image_url: z\.string\(\)[\s\S]*?\.refine\(isAllowedImageUrl/)
    assert.match(src, /main_image_url: z\.string\(\)[\s\S]*?\.refine\(isAllowedImageUrl/)
    assert.match(src, /photo_url: optionalText\("Fotoğraf", 1000\)\.refine\(\(v\) => v == null \|\| isAllowedImageUrl\(v\)/)
  })

  it("render paths degrade instead of throwing", async () => {
    const { readFileSync } = await import("node:fs")
    const banner = readFileSync("app/shop/page.tsx", "utf8")
    assert.match(banner, /<BannerErrorBoundary>/)
    const card = readFileSync("components/producers/producer-card.tsx", "utf8")
    assert.match(card, /isAllowedImageUrl\(producer\.photoUrl\)/)
    const entry = readFileSync("components/shop/product-entry.tsx", "utf8")
    assert.match(entry, /isAllowedImageUrl\(product\.mainImageUrl\)/)
    const detail = readFileSync("components/shop/product-detail.tsx", "utf8")
    assert.match(detail, /isAllowedImageUrl\(image\)/)
    assert.match(detail, /\.filter\(isAllowedImageUrl\)/)
  })
})
