import { z } from "zod"
import type { BlogDocNode } from "@/lib/blog/types"
import { EMPTY_DOC } from "@/lib/blog/types"

/**
 * The one allowlist that decides what a TipTap document is permitted to
 * contain. lib/blog/schema.ts validates new content against it before a save
 * is ever persisted; components/blog/render-content.tsx renders only nodes
 * and marks that pass it. Nothing outside this list reaches the page —
 * there is no raw-HTML fallback anywhere in the pipeline.
 */
export const ALLOWED_NODE_TYPES = [
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
  "image",
] as const

export const ALLOWED_MARK_TYPES = ["bold", "italic", "underline", "code", "link"] as const

const SAFE_LINK_PROTOCOLS = ["http:", "https:", "mailto:"]

export function isSafeLinkHref(href: unknown): href is string {
  if (typeof href !== "string" || href.trim() === "") return false
  try {
    // Relative/internal links (starting with "/") are always safe.
    if (href.startsWith("/")) return true
    const url = new URL(href)
    return SAFE_LINK_PROTOCOLS.includes(url.protocol)
  } catch {
    return false
  }
}

const markSchema: z.ZodType<{ type: string; attrs?: Record<string, unknown> }> = z.lazy(() =>
  z.union([
    z.object({ type: z.enum(["bold", "italic", "underline", "code"]) }),
    z.object({
      type: z.literal("link"),
      attrs: z.object({
        href: z.string().refine(isSafeLinkHref, "Geçersiz veya güvensiz bağlantı."),
        target: z.enum(["_blank", "_self"]).optional(),
      }),
    }),
  ]),
)

/**
 * Recursive node schema. Unknown node types fail the whole parse — the save
 * path rejects, it never silently drops a subtree. The renderer, which sees
 * only already-validated content, additionally fails safe (renders nothing)
 * on a type it does not recognise, as defence in depth against a schema/
 * renderer drift.
 */
const nodeSchema: z.ZodType<BlogDocNode> = z.lazy(() =>
  z
    .object({
      type: z.enum(ALLOWED_NODE_TYPES),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(nodeSchema).optional(),
      marks: z.array(markSchema).optional(),
      text: z.string().optional(),
    })
    .superRefine((node, ctx) => {
      // Applied at every depth, not just the root — z.lazy's recursion reuses
      // this exact schema (superRefine included) for every nested `content[]`.
      if (node.type === "heading") {
        const level = (node.attrs as { level?: unknown } | undefined)?.level
        if (level !== 2 && level !== 3) {
          ctx.addIssue({ code: "custom", message: "Başlık seviyesi yalnızca H2 veya H3 olabilir." })
        }
      }
      if (node.type === "image") {
        const attrs = node.attrs as { path?: unknown } | undefined
        if (typeof attrs?.path !== "string" || attrs.path.trim() === "") {
          ctx.addIssue({ code: "custom", message: "Görsel için geçerli bir dosya yolu gerekli." })
        }
      }
    }),
)

export const blogContentSchema = nodeSchema.superRefine((doc, ctx) => {
  if (doc.type !== "doc") {
    ctx.addIssue({ code: "custom", message: "Kök öğe 'doc' olmalı." })
  }
})

export function parseBlogContent(raw: unknown): BlogDocNode | null {
  const result = blogContentSchema.safeParse(raw)
  return result.success ? result.data : null
}

/** Plain text extraction — used for reading time, search excerpts, and word count. */
export function extractPlainText(node: BlogDocNode): string {
  if (node.type === "text") return node.text ?? ""
  if (!node.content || node.content.length === 0) {
    return node.type === "hardBreak" ? "\n" : ""
  }
  return node.content.map(extractPlainText).join(" ")
}

const WORDS_PER_MINUTE = 200

/** Turkish-reading-speed estimate, derived server-side from the document. */
export function estimateReadingTimeMinutes(doc: BlogDocNode): number {
  const text = extractPlainText(doc).trim()
  if (!text) return 1
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

export function wordCount(doc: BlogDocNode): number {
  const text = extractPlainText(doc).trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

export function isEmptyDoc(doc: BlogDocNode | null | undefined): boolean {
  if (!doc || !doc.content || doc.content.length === 0) return true
  return extractPlainText(doc).trim() === ""
}

export { EMPTY_DOC }
