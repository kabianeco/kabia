/**
 * Blog domain types.
 *
 * content_json is the canonical article body: a TipTap document, validated by
 * lib/blog/content.ts against an allowlist before it is ever stored, and
 * rendered by components/blog/render-content.tsx against the same allowlist.
 * Nothing here trusts stored HTML — there is none.
 */

export const BLOG_POST_STATUSES = ["draft", "scheduled", "published", "archived"] as const
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number]

export const BLOG_STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: "Taslak",
  scheduled: "Zamanlandı",
  published: "Yayında",
  archived: "Arşivde",
}

export interface BlogCategorySummary {
  id: string
  name: string
  slug: string
  description: string | null
  imagePath: string | null
  sortOrder: number
  isActive: boolean
}

export interface BlogTag {
  id: string
  name: string
  slug: string
}

/** The shape rendered on /blog and inside cards — no content body. */
export interface BlogPostSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImagePath: string | null
  category: BlogCategorySummary | null
  status: BlogPostStatus
  featured: boolean
  authorName: string | null
  publishedAt: string | null
  readingTimeMinutes: number
  tags: BlogTag[]
}

/** The full shape for /blog/[slug] and the admin editor. */
export interface BlogPostDetail extends BlogPostSummary {
  contentJson: BlogDocNode
  ogImagePath: string | null
  seoTitle: string | null
  seoDescription: string | null
  canonicalUrl: string | null
  allowIndexing: boolean
  createdAt: string
  updatedAt: string
  version: number
  coverMediaId: string | null
  ogMediaId: string | null
  categoryId: string | null
  authorId: string | null
  scheduledAt: string | null
}

export interface BlogPostAdminListItem {
  id: string
  title: string
  slug: string
  status: BlogPostStatus
  categoryName: string | null
  authorName: string | null
  publishedAt: string | null
  scheduledAt: string | null
  updatedAt: string
  featured: boolean
}

// ---- TipTap document shape --------------------------------------------------

export interface BlogMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface BlogDocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: BlogDocNode[]
  marks?: BlogMark[]
  text?: string
}

export const EMPTY_DOC: BlogDocNode = { type: "doc", content: [] }

// ---- query filter shapes -----------------------------------------------------

export interface PublicPostListFilters {
  categorySlug?: string
  query?: string
  page: number
  perPage: number
}

export type AdminPostSort = "updated_at" | "published_at" | "title"

export interface AdminPostListFilters {
  status?: BlogPostStatus
  categoryId?: string
  query?: string
  sort: AdminPostSort
  dir: "asc" | "desc"
  page: number
  perPage: number
}

export type PublicListResult<T> =
  | { status: "ok"; items: T[]; total: number }
  | { status: "error" }
