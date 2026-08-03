/**
 * Blog slug helpers — pure logic unit tests. No database, no network.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { slugify, isReservedSlug, RESERVED_BLOG_SLUGS } from "../lib/blog/slug.ts"

describe("slugify", () => {
  it("folds every Turkish letter to its ASCII equivalent", () => {
    assert.equal(slugify("Çilek Ğıdık İçecek Öğün Şeker Üzüm"), "cilek-gidik-icecek-ogun-seker-uzum")
  })

  it("lowercases and hyphenates", () => {
    assert.equal(slugify("Kışın Hazırlığı"), "kisin-hazirligi")
  })

  it("strips punctuation and collapses whitespace into single hyphens", () => {
    assert.equal(slugify("Badem: Nasıl Kurutulur?!"), "badem-nasil-kurutulur")
  })

  it("collapses repeated hyphens and trims leading/trailing ones", () => {
    assert.equal(slugify("  --Hasat Zamanı--  "), "hasat-zamani")
  })

  it("produces an empty string for input with no latin characters", () => {
    assert.equal(slugify("!!!"), "")
  })

  it("caps length at 96 characters", () => {
    const long = "a".repeat(200)
    assert.ok(slugify(long).length <= 96)
  })
})

describe("reserved slugs", () => {
  it("flags known reserved paths", () => {
    assert.equal(isReservedSlug("rss.xml"), true)
    assert.equal(isReservedSlug("kategori"), true)
  })

  it("does not flag an ordinary post slug", () => {
    assert.equal(isReservedSlug("badem-hasadi-2026"), false)
  })

  it("every entry in the reserved set is lowercase, matching what slugify produces", () => {
    for (const slug of RESERVED_BLOG_SLUGS) {
      assert.equal(slug, slug.toLowerCase())
    }
  })
})
