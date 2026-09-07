import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { splitStoryParagraphs } from "../lib/producers.ts"

/**
 * Finding 12: `/ureticiler/[slug]` rendered `producer.story` in a single
 * `<p>`, collapsing multi-paragraph stories into one run-on block. Storage
 * stays plain text with blank-line separators (the `content/producers.ts`
 * convention); the split happens at render, here.
 */

describe("splitStoryParagraphs", () => {
  it("splits blank-line-separated blocks into paragraphs", () => {
    assert.deepEqual(splitStoryParagraphs("Birinci.\n\nİkinci.\n\nÜçüncü."), [
      "Birinci.",
      "İkinci.",
      "Üçüncü.",
    ])
  })

  it("returns nothing for a missing or blank story", () => {
    assert.deepEqual(splitStoryParagraphs(null), [])
    assert.deepEqual(splitStoryParagraphs(""), [])
    assert.deepEqual(splitStoryParagraphs("   \n\n  "), [])
  })

  it("keeps a single-paragraph story as one paragraph", () => {
    assert.deepEqual(splitStoryParagraphs("Tek paragraf."), ["Tek paragraf."])
  })

  it("leaves single newlines inside a paragraph alone", () => {
    // A line break the author did not separate with a blank line renders as a
    // space, as it always has — only blank-line runs start a paragraph.
    assert.deepEqual(splitStoryParagraphs("Birinci satır\nikinci satır.\n\nYeni paragraf."), [
      "Birinci satır\nikinci satır.",
      "Yeni paragraf.",
    ])
  })

  it("drops empty runs from leading, trailing and repeated blank lines", () => {
    assert.deepEqual(splitStoryParagraphs("\n\nBirinci.\n\n\n\nİkinci.\n\n"), [
      "Birinci.",
      "İkinci.",
    ])
  })

  it("treats whitespace-only lines as blank", () => {
    assert.deepEqual(splitStoryParagraphs("Birinci.\n   \nİkinci."), ["Birinci.", "İkinci."])
  })
})
