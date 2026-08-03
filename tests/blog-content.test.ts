/**
 * Blog content allowlist — pure logic unit tests. No database, no network.
 *
 * This is the security boundary the whole editor/renderer pipeline rests on:
 * lib/blog/schema.ts (save-time validation) and
 * components/blog/render-content.tsx (render-time) both defer to
 * lib/blog/content.ts's allowlist. If a node type, mark type or link
 * protocol is not proven safe here, it must never reach either.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  blogContentSchema,
  isSafeLinkHref,
  parseBlogContent,
  estimateReadingTimeMinutes,
  wordCount,
  isEmptyDoc,
  extractPlainText,
} from "../lib/blog/content.ts"
import { EMPTY_DOC } from "../lib/blog/types.ts"

const validDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Baslik" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Merhaba " },
        { type: "text", text: "dunya", marks: [{ type: "bold" }] },
        { type: "text", text: " ve ", marks: [{ type: "link", attrs: { href: "https://kabiaekolojik.com" } }] },
      ],
    },
    { type: "image", attrs: { path: "2026-08/foto-abc12345.jpg", alt: "Bahce" } },
    { type: "horizontalRule" },
  ],
}

describe("blogContentSchema — accepts what it should", () => {
  it("accepts a well-formed document", () => {
    const result = blogContentSchema.safeParse(validDoc)
    assert.equal(result.success, true)
  })

  it("accepts an empty document", () => {
    assert.equal(blogContentSchema.safeParse(EMPTY_DOC).success, true)
  })

  it("accepts relative links", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "/magaza" } }] }] }] }
    assert.equal(blogContentSchema.safeParse(doc).success, true)
  })

  it("accepts mailto links", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "mailto:info@kabia.com" } }] }] }] }
    assert.equal(blogContentSchema.safeParse(doc).success, true)
  })
})

describe("blogContentSchema — rejects what it should", () => {
  it("rejects an unknown node type", () => {
    const doc = { type: "doc", content: [{ type: "script", content: [] }] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })

  it("rejects an iframe node type", () => {
    const doc = { type: "doc", content: [{ type: "iframe", attrs: { src: "https://evil.example" } }] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })

  it("rejects a root that is not 'doc'", () => {
    const doc = { type: "paragraph", content: [] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })

  it("rejects heading levels outside H2/H3", () => {
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "x" }] }] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })

  it("rejects an image with no path", () => {
    const doc = { type: "doc", content: [{ type: "image", attrs: { alt: "x" } }] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })

  it("rejects a javascript: link", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })

  it("rejects a data: link", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "data:text/html,<script>alert(1)</script>" } }] }] }] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })

  it("rejects an unknown mark type", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "onclick" }] }] }] }
    assert.equal(blogContentSchema.safeParse(doc).success, false)
  })
})

describe("isSafeLinkHref", () => {
  it("accepts http(s) and mailto", () => {
    assert.equal(isSafeLinkHref("https://example.com"), true)
    assert.equal(isSafeLinkHref("http://example.com"), true)
    assert.equal(isSafeLinkHref("mailto:a@b.com"), true)
  })
  it("accepts root-relative paths", () => {
    assert.equal(isSafeLinkHref("/blog/some-post"), true)
  })
  it("rejects javascript/data/vbscript protocols", () => {
    assert.equal(isSafeLinkHref("javascript:alert(1)"), false)
    assert.equal(isSafeLinkHref("data:text/html,x"), false)
    assert.equal(isSafeLinkHref("vbscript:msgbox(1)"), false)
  })
  it("rejects garbage input", () => {
    assert.equal(isSafeLinkHref(""), false)
    assert.equal(isSafeLinkHref(undefined), false)
    assert.equal(isSafeLinkHref(123), false)
  })
})

describe("parseBlogContent", () => {
  it("returns the parsed doc on success", () => {
    const result = parseBlogContent(validDoc)
    assert.ok(result)
    assert.equal(result?.type, "doc")
  })
  it("returns null on an invalid document", () => {
    assert.equal(parseBlogContent({ type: "script" }), null)
  })
})

describe("reading time and word count", () => {
  it("returns at least 1 minute for an empty document", () => {
    assert.equal(estimateReadingTimeMinutes(EMPTY_DOC), 1)
  })

  it("scales with word count", () => {
    const words = Array.from({ length: 400 }, () => "kelime").join(" ")
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: words }] }] }
    assert.equal(estimateReadingTimeMinutes(doc), 2)
  })

  it("counts words across multiple text nodes", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "bir iki" }, { type: "text", text: "uc dort" }] }],
    }
    assert.equal(wordCount(doc), 4)
  })

  it("extracts plain text ignoring node structure", () => {
    const text = extractPlainText(validDoc)
    assert.match(text, /Baslik/)
    assert.match(text, /Merhaba/)
  })
})

describe("isEmptyDoc", () => {
  it("is true for a doc with no content", () => {
    assert.equal(isEmptyDoc(EMPTY_DOC), true)
  })
  it("is true for null/undefined", () => {
    assert.equal(isEmptyDoc(null), true)
    assert.equal(isEmptyDoc(undefined), true)
  })
  it("is false once there is real text", () => {
    assert.equal(isEmptyDoc(validDoc), false)
  })
})
