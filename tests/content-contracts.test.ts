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
