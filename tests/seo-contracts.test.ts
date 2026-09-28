import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// SEO/perf pass 2, phase 2: structured data and crawl contracts. Each states
// only what the site visibly states (brief §2 Truth).

describe("Organization structured data", () => {
  const layout = readFileSync("app/layout.tsx", "utf8")

  it("claims only the social profiles confirmed to exist", () => {
    assert.match(layout, /sameAs: \[site\.social\.instagram, site\.social\.facebook\]/)
    assert.ok(!/sameAs:[^\n]*social\.x/.test(layout), "x.com/kabiaekolojik is unconfirmed")
    assert.ok(!/creator: "@kabiaekolojik"/.test(layout), "twitter:creator names the unconfirmed X handle")
  })

  it("states the contact details /iletisim shows, as a contactPoint", () => {
    const contact = readFileSync("app/iletisim/page.tsx", "utf8")
    assert.match(contact, /Hafta içi 09:00–18:00/)
    assert.match(layout, /"@type": "ContactPoint"/)
    assert.match(layout, /opens: "09:00",\s+closes: "18:00"/)
    assert.ok(!layout.includes('"@type": "LocalBusiness"'))
  })
})

describe("Product structured data", () => {
  const page = readFileSync("app/shop/[slug]/page.tsx", "utf8")

  it("states price and availability per size, never one size's price with another's stock", () => {
    assert.match(page, /"@type": "ProductGroup"/)
    assert.match(page, /hasVariant: product\.variants\.map/)
    assert.match(page, /offers: offer\(variant\.price, variant\.stock > 0\)/)
    assert.ok(!/product\.variants\.some\(\(v\) => v\.stock > 0\)/.test(page), "a product-wide stock flag is back on a single Offer")
  })

  it("puts the Kabia brand only on the farm's own produce", () => {
    assert.match(page, /product\.source === "ciftlik" \? \{ brand:/)
  })
})

describe("Store listing facets", () => {
  it("keeps filtered and sorted views out of the index", () => {
    const shop = readFileSync("app/shop/page.tsx", "utf8")
    assert.match(shop, /FACET_PARAMS = \["kategori", "kaynak", "sirala"\]/)
    assert.match(shop, /noindex: faceted/)
  })

  it("serves the listing at one URL: /shop redirects permanently to /magaza", async () => {
    const { default: nextConfig } = await import("../next.config.ts")
    const redirects = (await nextConfig.redirects?.()) ?? []
    assert.deepEqual(
      redirects.filter((entry) => entry.source === "/shop"),
      [{ source: "/shop", destination: "/magaza", permanent: true }],
    )
    assert.ok(!redirects.some((entry) => entry.source.startsWith("/shop/")), "product URLs must not redirect")
  })
})

describe("Image sitemap", () => {
  const sitemap = readFileSync("app/sitemap.ts", "utf8")

  it("lists every product photo, main image and gallery", () => {
    assert.match(sitemap, /images: imageList\(\[p\.mainImageUrl, \.\.\.p\.images\]\)/)
  })

  it("lists the producer photo the story page shows", () => {
    assert.match(sitemap, /imageList\(p\.photoUrl && isAllowedImageUrl\(p\.photoUrl\) \? \[p\.photoUrl\] : \[\]\)/)
  })
})

describe("Journal entries", () => {
  const page = readFileSync("app/gunluk/[slug]/page.tsx", "utf8")

  it("carry BlogPosting with the entry's own date and headline", () => {
    assert.match(page, /articleJsonLd\(\{\s+headline: entry\.observation,/)
    assert.match(page, /datePublished: entry\.date,/)
    const seo = readFileSync("lib/seo.ts", "utf8")
    assert.match(seo, /"@type": "BlogPosting"/)
  })

  it("take their title from the entry text, not the date alone", () => {
    assert.match(page, /title: entryTitle\(entry\),/)
  })
})

describe("404 responses", () => {
  it("override the root layout's index,follow and share the 404 page's title", () => {
    const notFound = readFileSync("app/not-found.tsx", "utf8")
    assert.match(notFound, /robots: \{ index: false, follow: false \}/)
    for (const route of ["app/shop/[slug]/page.tsx", "app/ureticiler/[slug]/page.tsx", "app/gunluk/[slug]/page.tsx", "app/magaza/[producer-slug]/page.tsx"]) {
      assert.match(readFileSync(route, "utf8"), /title: "Sayfa bulunamadı", robots: \{ index: false, follow: false \}/, route)
    }
  })
})
