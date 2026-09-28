import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// SEO/perf pass 2, phase 3: published copy states only sourced facts, makes no
// health claim, and dates the start the way content/farm.ts does.

/** Health and benefit wording forbidden in food copy (Türk Gıda Kodeksi). */
const HEALTH = /sağlıklı|sağlığ|şifa|bağışıklı|faydal|probiyotik|antioksidan|kolesterol|detoks|iyi gelir/i
/** Superlatives and unverifiable comparisons. */
const SUPERLATIVE = /\ben (iyi|kaliteli|lezzetli|doğal|saf)\b|eşsiz|benzersiz|kusursuz ürün/i

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const COPY = [
  "content/homepage.ts",
  "content/farm.ts",
  "content/pages.ts",
  "content/kabia-standard.ts",
  "content/guides.ts",
  "app/badem/page.tsx",
  "app/ciftlik/page.tsx",
  "app/shop/page.tsx",
  "app/secki/page.tsx",
  "app/mutfak/page.tsx",
  "app/ureticiler/page.tsx",
  ...files("app/rehber"),
  "supabase/migrations/20260928120228_enrich_product_descriptions.sql",
].filter((path) => existsSync(path))

describe("published copy", () => {
  for (const path of COPY) {
    it(`${path} makes no health claim and no superlative`, () => {
      const src = readFileSync(path, "utf8")
      assert.doesNotMatch(src, HEALTH)
      assert.doesNotMatch(src, SUPERLATIVE)
    })
  }

  it("dates the start as the timeline does: begun in 2019, planted in 2021", () => {
    for (const path of COPY) {
      const src = readFileSync(path, "utf8")
      assert.doesNotMatch(src, /2021[’']de başlayan|2021[’']de kurul|kuruluş(u|umuz)? 2021/, path)
    }
  })
})

describe("guides", () => {
  const guideFiles = files("app/rehber").concat("content/guides.ts", "components/guides/guide-parts.tsx")

  it("state the certificate only through content/farm.ts, with no expiry-independent phrasing", () => {
    for (const path of guideFiles) {
      const src = readFileSync(path, "utf8")
      assert.doesNotMatch(src, /TR-OT-|3 Ekim 2026|24 Ekim 2025/, `${path} hardcodes certificate facts`)
      assert.doesNotMatch(src, /sertifikalı olarak üret|sertifikalı üretiyoruz|[’']den beri organik/, path)
    }
    for (const path of ["app/rehber/geyve-badem-bahcesi/page.tsx", "app/rehber/uretici-secimi/page.tsx"]) {
      assert.match(readFileSync(path, "utf8"), /farmCertificate\.facts/, path)
    }
  })

  it("the selection guide shows the seven Kabia Standardı criteria and keeps its certification note", async () => {
    const { kabiaStandard } = await import("../content/kabia-standard.ts")
    assert.equal(kabiaStandard.criteria.length, 7)
    assert.match(kabiaStandard.certificationNote, /resmî organik sertifikanın yerine\s+geçmez/)
    const page = readFileSync("app/rehber/uretici-secimi/page.tsx", "utf8")
    assert.match(page, /kabiaStandard\.criteria\.map/)
    assert.match(page, /\{kabiaStandard\.certificationNote\}/)
  })

  it("every guide is in the sitemap and has Article structured data", async () => {
    const { guides } = await import("../content/guides.ts")
    assert.ok(readFileSync("app/sitemap.ts", "utf8").includes("guides.map((guide)"))
    for (const guide of guides) {
      const page = readFileSync(`app/rehber/${guide.slug}/page.tsx`, "utf8")
      assert.match(page, /articleJsonLd\(\{/, guide.slug)
      assert.match(page, /GuideHeader[\s\S]*crumbs=/, `${guide.slug} has no breadcrumb`)
    }
  })
})

describe("internal links (owner decision 4)", () => {
  it("product pages link to the guide hub, the storage answer and, for the almond, /badem", () => {
    const src = readFileSync("components/shop/product-detail.tsx", "utf8")
    assert.match(src, /href: routes\.guides, label: "Tüm rehberler"/)
    assert.match(src, /routes\.guide\("saklama"\)/)
    assert.match(src, /product\.slug === "kabuklu-badem"[\s\S]*href: "\/badem"/)
  })

  it("producer pages link to a guide; /badem links to the orchard guide", () => {
    assert.match(readFileSync("app/ureticiler/[slug]/page.tsx", "utf8"), /routes\.guide\(producer\.source === "ciftlik"/)
    assert.match(readFileSync("app/badem/page.tsx", "utf8"), /href="\/rehber\/geyve-badem-bahcesi"/)
  })

  it("journal entries link to the previous and next entry by date", () => {
    const src = readFileSync("app/gunluk/[slug]/page.tsx", "utf8")
    assert.match(src, /Önceki not:/)
    assert.match(src, /Sonraki not:/)
  })
})
