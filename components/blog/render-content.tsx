import { Fragment, type ReactNode } from "react"
import Image from "next/image"
import { isSafeLinkHref } from "@/lib/blog/content"
import { blogImageUrl } from "@/lib/blog/media"
import type { BlogDocNode, BlogMark } from "@/lib/blog/types"
import { site } from "@/lib/site"

/**
 * The one canonical renderer for blog article bodies.
 *
 * content_json has already passed lib/blog/content.ts's allowlist at save
 * time, but this renderer does not trust that as its only line of defence —
 * it re-checks node types, mark types and link protocols itself and fails
 * safe (renders nothing) on anything unrecognised, so a schema/renderer drift
 * or a row edited directly in the database cannot become a script-injection
 * vector. There is no `dangerouslySetInnerHTML` anywhere in this module.
 */

function isExternalHref(href: string): boolean {
  if (href.startsWith("/")) return false
  try {
    return new URL(href).host !== new URL(site.url).host
  } catch {
    return true
  }
}

function applyMarks(text: string, marks: BlogMark[] | undefined, key: string): ReactNode {
  let node: ReactNode = text
  if (!marks || marks.length === 0) return node

  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        node = <strong key={`${key}-b`}>{node}</strong>
        break
      case "italic":
        node = <em key={`${key}-i`}>{node}</em>
        break
      case "underline":
        node = <u key={`${key}-u`}>{node}</u>
        break
      case "code":
        node = (
          <code key={`${key}-c`} className="rounded-[3px] bg-ink/[0.06] px-1.5 py-0.5 text-[0.9em]">
            {node}
          </code>
        )
        break
      case "link": {
        const href = (mark.attrs as { href?: unknown } | undefined)?.href
        if (!isSafeLinkHref(href)) break
        const external = isExternalHref(href)
        node = (
          <a
            key={`${key}-a`}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="text-brand underline decoration-brand/40 underline-offset-2 transition-colors duration-300 hover:text-forest"
          >
            {node}
          </a>
        )
        break
      }
      default:
        // Unknown mark: ignore the mark, keep the text itself.
        break
    }
  }
  return node
}

function renderInline(nodes: BlogDocNode[] | undefined, keyPrefix: string): ReactNode[] {
  if (!nodes) return []
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`
    if (node.type === "text") return <Fragment key={key}>{applyMarks(node.text ?? "", node.marks, key)}</Fragment>
    if (node.type === "hardBreak") return <br key={key} />
    // Any other node type inside an inline run is unexpected; drop it safely.
    return null
  })
}

function BlogImage({ node, keyPrefix }: { node: BlogDocNode; keyPrefix: string }) {
  const attrs = (node.attrs ?? {}) as { path?: unknown; alt?: unknown; caption?: unknown; bucket?: unknown }
  const path = typeof attrs.path === "string" ? attrs.path : null
  if (!path) return null
  const alt = typeof attrs.alt === "string" ? attrs.alt : ""
  const caption = typeof attrs.caption === "string" ? attrs.caption.trim() : ""
  const src = blogImageUrl(path)
  if (!src) return null

  return (
    <figure key={keyPrefix} className="my-8">
      <span className="block overflow-hidden rounded-media bg-ink/[0.04]">
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={800}
          sizes="(min-width: 768px) 42rem, 100vw"
          className="h-auto w-full object-cover"
        />
      </span>
      {caption && <figcaption className="mt-2.5 text-center text-xs text-ink/50">{caption}</figcaption>}
    </figure>
  )
}

function renderBlock(node: BlogDocNode, keyPrefix: string): ReactNode {
  switch (node.type) {
    case "paragraph": {
      if (!node.content || node.content.length === 0) return null
      return (
        <p key={keyPrefix} className="mb-5 text-base leading-[1.75] text-ink/85 last:mb-0">
          {renderInline(node.content, keyPrefix)}
        </p>
      )
    }
    case "heading": {
      const level = (node.attrs as { level?: unknown } | undefined)?.level === 3 ? 3 : 2
      const className =
        level === 2
          ? "font-theme-display mb-5 mt-12 text-2xl leading-tight text-ink first:mt-0 md:text-3xl"
          : "font-theme-display mb-4 mt-9 text-xl leading-tight text-ink first:mt-0 md:text-2xl"
      const content = renderInline(node.content, keyPrefix)
      return level === 2 ? (
        <h2 key={keyPrefix} className={className}>
          {content}
        </h2>
      ) : (
        <h3 key={keyPrefix} className={className}>
          {content}
        </h3>
      )
    }
    case "bulletList":
      return (
        <ul key={keyPrefix} className="mb-5 ml-5 list-disc space-y-2 text-base leading-[1.75] text-ink/85">
          {(node.content ?? []).map((li, i) => renderBlock(li, `${keyPrefix}-${i}`))}
        </ul>
      )
    case "orderedList":
      return (
        <ol key={keyPrefix} className="mb-5 ml-5 list-decimal space-y-2 text-base leading-[1.75] text-ink/85">
          {(node.content ?? []).map((li, i) => renderBlock(li, `${keyPrefix}-${i}`))}
        </ol>
      )
    case "listItem":
      return (
        <li key={keyPrefix}>
          {(node.content ?? []).map((child, i) => {
            // A list item's paragraph child renders inline (no <p> margin
            // inside an <li>); anything else falls back to the block renderer.
            if (child.type === "paragraph") return <Fragment key={i}>{renderInline(child.content, `${keyPrefix}-${i}`)}</Fragment>
            return renderBlock(child, `${keyPrefix}-${i}`)
          })}
        </li>
      )
    case "blockquote":
      return (
        <blockquote
          key={keyPrefix}
          className="font-theme-display my-8 border-l-2 border-brand/40 pl-5 text-lg italic leading-relaxed text-ink/75"
        >
          {(node.content ?? []).map((child, i) => renderBlock(child, `${keyPrefix}-${i}`))}
        </blockquote>
      )
    case "horizontalRule":
      return <hr key={keyPrefix} className="my-10 border-t border-ink/10" />
    case "image":
      return <BlogImage key={keyPrefix} node={node} keyPrefix={keyPrefix} />
    default:
      // Unknown node type: fail safe, render nothing.
      return null
  }
}

export function BlogContent({ doc }: { doc: BlogDocNode }) {
  if (!doc || doc.type !== "doc" || !doc.content) return null
  return (
    <div className="mx-auto max-w-[42rem]">
      {doc.content.map((node, i) => renderBlock(node, `n-${i}`))}
    </div>
  )
}
