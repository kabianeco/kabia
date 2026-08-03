import type { SupabaseClient } from "@supabase/supabase-js"
import { sanitizeSearch } from "@/lib/admin/queries/products"
import { EMPTY_DOC } from "@/lib/blog/content"
import type {
  AdminPostListFilters,
  BlogCategorySummary,
  BlogDocNode,
  BlogPostAdminListItem,
  BlogPostDetail,
  BlogPostStatus,
  BlogPostSummary,
  BlogTag,
  PublicListResult,
  PublicPostListFilters,
} from "@/lib/blog/types"

export const PUBLIC_PAGE_SIZE = 9
export const ADMIN_PAGE_SIZE = 20
export const RELATED_POSTS_COUNT = 3

// ---- row shapes --------------------------------------------------------------

interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  image_path: string | null
  sort_order: number
  is_active: boolean
}

interface TagRow {
  id: string
  name: string
  slug: string
}

interface PostTagJoinRow {
  tag: TagRow | null
}

interface PostSummaryRow {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_path: string | null
  status: BlogPostStatus
  featured: boolean
  author_name: string | null
  published_at: string | null
  reading_time_minutes: number
  category: CategoryRow | null
  blog_post_tags?: PostTagJoinRow[] | null
}

interface PostDetailRow extends PostSummaryRow {
  content_json: unknown
  og_image_path: string | null
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  allow_indexing: boolean
  created_at: string
  updated_at: string
  version: number
  cover_media_id: string | null
  og_media_id: string | null
  category_id: string | null
  author_id: string | null
  scheduled_at: string | null
}

const SUMMARY_SELECT = `
  id, title, slug, excerpt, cover_image_path, status, featured, author_name,
  published_at, reading_time_minutes,
  category:blog_categories(id, name, slug, description, image_path, sort_order, is_active),
  blog_post_tags(tag:blog_tags(id, name, slug))
`

const DETAIL_SELECT = `
  ${SUMMARY_SELECT},
  content_json, og_image_path, seo_title, seo_description, canonical_url,
  allow_indexing, created_at, updated_at, version, cover_media_id, og_media_id,
  category_id, author_id, scheduled_at
`

function mapCategory(row: CategoryRow | null): BlogCategorySummary | null {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imagePath: row.image_path,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

function mapTags(rows: PostTagJoinRow[] | null | undefined): BlogTag[] {
  if (!rows) return []
  return rows
    .map((r) => r.tag)
    .filter((t): t is TagRow => Boolean(t))
    .map((t) => ({ id: t.id, name: t.name, slug: t.slug }))
}

function mapSummary(row: PostSummaryRow): BlogPostSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    coverImagePath: row.cover_image_path,
    category: mapCategory(row.category),
    status: row.status,
    featured: row.featured,
    authorName: row.author_name,
    publishedAt: row.published_at,
    readingTimeMinutes: row.reading_time_minutes,
    tags: mapTags(row.blog_post_tags),
  }
}

function safeDoc(raw: unknown): BlogDocNode {
  if (raw && typeof raw === "object" && "type" in raw) return raw as BlogDocNode
  return EMPTY_DOC
}

function mapDetail(row: PostDetailRow): BlogPostDetail {
  return {
    ...mapSummary(row),
    contentJson: safeDoc(row.content_json),
    ogImagePath: row.og_image_path,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
    allowIndexing: row.allow_indexing,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    coverMediaId: row.cover_media_id,
    ogMediaId: row.og_media_id,
    categoryId: row.category_id,
    authorId: row.author_id,
    scheduledAt: row.scheduled_at,
  }
}

/**
 * The public-eligibility predicate, as a PostgREST `.or()` filter string,
 * applied explicitly in every public query below — not left to RLS alone.
 * RLS is the real boundary, but a signed-in administrator browsing the
 * storefront in the same browser session would otherwise see drafts on the
 * public page too, because their session also satisfies the admin SELECT
 * policy. Explicit filtering keeps the public page's behaviour identical
 * regardless of who is viewing it. Contains no user input — only the
 * `published`/`scheduled` keywords and a server-generated ISO timestamp.
 */
export function eligibilityFilter(): string {
  const now = new Date().toISOString()
  return `status.eq.published,and(status.eq.scheduled,published_at.lte.${now})`
}

// ---- public reads --------------------------------------------------------------

export async function fetchPublicPostList(
  client: SupabaseClient,
  filters: PublicPostListFilters,
): Promise<PublicListResult<BlogPostSummary>> {
  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1

  let query = client
    .from("blog_posts")
    .select(SUMMARY_SELECT, { count: "exact" })
    .or(eligibilityFilter())
    .order("published_at", { ascending: false })
    .range(from, to)

  if (filters.categorySlug) {
    const { data: category } = await client
      .from("blog_categories")
      .select("id")
      .eq("slug", filters.categorySlug)
      .eq("is_active", true)
      .maybeSingle()
    if (!category) return { status: "ok", items: [], total: 0 }
    query = query.eq("category_id", category.id)
  }

  if (filters.query && filters.query.trim().length >= 2) {
    const term = sanitizeSearch(filters.query.trim())
    query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error || !data) return { status: "error" }

  return {
    status: "ok",
    items: (data as unknown as PostSummaryRow[]).map(mapSummary),
    total: count ?? data.length,
  }
}

export type PostBySlugResult =
  | { status: "ok"; post: BlogPostDetail }
  | { status: "not_found" }
  | { status: "error" }

/**
 * Distinguishes "no such post" from "the database could not be read" — a
 * failed read must never be treated as an honest 404, per the brief.
 */
export async function fetchPublishedPostBySlug(client: SupabaseClient, slug: string): Promise<PostBySlugResult> {
  const { data, error } = await client
    .from("blog_posts")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .or(eligibilityFilter())
    .maybeSingle()
  if (error) return { status: "error" }
  if (!data) return { status: "not_found" }
  return { status: "ok", post: mapDetail(data as unknown as PostDetailRow) }
}

/** Resolves a stale slug to the post's current slug, only for eligible posts. */
export async function resolveSlugRedirect(client: SupabaseClient, slug: string): Promise<string | null> {
  const { data } = await client
    .from("blog_slug_history")
    .select("post_id, created_at, post:blog_posts(slug)")
    .eq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const currentSlug = (data as { post?: { slug?: string } | null } | null)?.post?.slug
  return currentSlug ?? null
}

export interface AdjacentPosts {
  previous: BlogPostSummary | null
  next: BlogPostSummary | null
}

/** Chronological neighbours by published_at — "previous" is older, "next" is newer. */
export async function fetchAdjacentPosts(
  client: SupabaseClient,
  post: BlogPostDetail,
): Promise<AdjacentPosts> {
  if (!post.publishedAt) return { previous: null, next: null }

  const [{ data: prevData }, { data: nextData }] = await Promise.all([
    client
      .from("blog_posts")
      .select(SUMMARY_SELECT)
      .lt("published_at", post.publishedAt)
      .or(eligibilityFilter())
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("blog_posts")
      .select(SUMMARY_SELECT)
      .gt("published_at", post.publishedAt)
      .or(eligibilityFilter())
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    previous: prevData ? mapSummary(prevData as unknown as PostSummaryRow) : null,
    next: nextData ? mapSummary(nextData as unknown as PostSummaryRow) : null,
  }
}

export async function fetchRelatedPosts(
  client: SupabaseClient,
  post: BlogPostSummary,
  count = RELATED_POSTS_COUNT,
): Promise<BlogPostSummary[]> {
  const results: PostSummaryRow[] = []

  if (post.category) {
    const { data } = await client
      .from("blog_posts")
      .select(SUMMARY_SELECT)
      .eq("category_id", post.category.id)
      .neq("id", post.id)
      .or(eligibilityFilter())
      .order("published_at", { ascending: false })
      .limit(count)
    if (data) results.push(...(data as unknown as PostSummaryRow[]))
  }

  if (results.length < count) {
    const { data } = await client
      .from("blog_posts")
      .select(SUMMARY_SELECT)
      .neq("id", post.id)
      .or(eligibilityFilter())
      .order("published_at", { ascending: false })
      .limit(count + results.length)
    if (data) results.push(...(data as unknown as PostSummaryRow[]))
  }

  const seen = new Set<string>()
  const deduped = results.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
  return deduped.slice(0, count).map(mapSummary)
}

/** Only categories that currently have at least one publicly eligible post. */
export async function fetchPublicCategoriesWithCounts(
  client: SupabaseClient,
): Promise<Array<BlogCategorySummary & { postCount: number }>> {
  const [{ data: categories }, { data: eligiblePosts }] = await Promise.all([
    client
      .from("blog_categories")
      .select("id, name, slug, description, image_path, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    client.from("blog_posts").select("category_id").not("category_id", "is", null).or(eligibilityFilter()),
  ])

  const counts = new Map<string, number>()
  for (const row of eligiblePosts ?? []) {
    if (!row.category_id) continue
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }

  return (categories ?? [])
    .map((c) => ({ ...(mapCategory(c as CategoryRow) as BlogCategorySummary), postCount: counts.get(c.id) ?? 0 }))
    .filter((c) => c.postCount > 0)
}

/** Bounded server-side public search across title, excerpt, category and tags. */
export async function searchPublicPosts(client: SupabaseClient, term: string, limit = 20): Promise<BlogPostSummary[]> {
  const cleaned = sanitizeSearch(term.trim())
  if (cleaned.length < 2) return []

  const [{ data: byText }, { data: matchingTags }] = await Promise.all([
    client
      .from("blog_posts")
      .select(SUMMARY_SELECT)
      .or(`title.ilike.%${cleaned}%,excerpt.ilike.%${cleaned}%`)
      .or(eligibilityFilter())
      .order("published_at", { ascending: false })
      .limit(limit),
    client.from("blog_tags").select("id").ilike("name", `%${cleaned}%`).limit(10),
  ])

  const results: PostSummaryRow[] = [...((byText as unknown as PostSummaryRow[]) ?? [])]

  const tagIds = (matchingTags ?? []).map((t) => t.id)
  if (tagIds.length > 0) {
    const { data: postIdRows } = await client.from("blog_post_tags").select("post_id").in("tag_id", tagIds).limit(100)
    const postIds = [...new Set((postIdRows ?? []).map((r) => r.post_id))]
    if (postIds.length > 0) {
      const { data } = await client
        .from("blog_posts")
        .select(SUMMARY_SELECT)
        .in("id", postIds)
        .or(eligibilityFilter())
        .order("published_at", { ascending: false })
        .limit(limit)
      if (data) results.push(...(data as unknown as PostSummaryRow[]))
    }
  }

  const seen = new Set<string>()
  const deduped = results.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
  return deduped.slice(0, limit).map(mapSummary)
}

// ---- admin reads --------------------------------------------------------------

export async function fetchAdminPostList(
  client: SupabaseClient,
  filters: AdminPostListFilters,
): Promise<{ items: BlogPostAdminListItem[]; total: number } | null> {
  const from = (filters.page - 1) * filters.perPage
  const to = from + filters.perPage - 1

  let query = client
    .from("blog_posts")
    .select(
      "id, title, slug, status, featured, author_name, published_at, scheduled_at, updated_at, category:blog_categories(name)",
      { count: "exact" },
    )
    .order(filters.sort, { ascending: filters.dir === "asc" })
    .range(from, to)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId)
  if (filters.query && filters.query.trim().length >= 2) {
    const term = sanitizeSearch(filters.query.trim())
    query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`)
  }

  const { data, error, count } = await query
  if (error || !data) return null

  const items: BlogPostAdminListItem[] = (
    data as unknown as Array<{
      id: string
      title: string
      slug: string
      status: BlogPostStatus
      featured: boolean
      author_name: string | null
      published_at: string | null
      scheduled_at: string | null
      updated_at: string
      category: { name: string } | null
    }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    categoryName: row.category?.name ?? null,
    authorName: row.author_name,
    publishedAt: row.published_at,
    scheduledAt: row.scheduled_at,
    updatedAt: row.updated_at,
    featured: row.featured,
  }))

  return { items, total: count ?? items.length }
}

export async function fetchAdminPostDetail(client: SupabaseClient, id: string): Promise<BlogPostDetail | null> {
  const { data, error } = await client.from("blog_posts").select(DETAIL_SELECT).eq("id", id).maybeSingle()
  if (error || !data) return null
  return mapDetail(data as unknown as PostDetailRow)
}

export async function fetchAdminCategories(client: SupabaseClient): Promise<BlogCategorySummary[]> {
  const { data } = await client
    .from("blog_categories")
    .select("id, name, slug, description, image_path, sort_order, is_active")
    .order("sort_order", { ascending: true })
  return (data ?? []).map((row) => mapCategory(row as CategoryRow) as BlogCategorySummary)
}

export async function fetchAdminCategoriesWithCounts(
  client: SupabaseClient,
): Promise<Array<BlogCategorySummary & { postCount: number }>> {
  const { data } = await client
    .from("blog_categories")
    .select("id, name, slug, description, image_path, sort_order, is_active, blog_posts(count)")
    .order("sort_order", { ascending: true })
  return ((data ?? []) as Array<CategoryRow & { blog_posts: { count: number }[] }>).map((row) => ({
    ...(mapCategory(row) as BlogCategorySummary),
    postCount: row.blog_posts?.[0]?.count ?? 0,
  }))
}

export async function fetchAdminTags(client: SupabaseClient): Promise<BlogTag[]> {
  const { data } = await client.from("blog_tags").select("id, name, slug").order("name", { ascending: true })
  return (data ?? []) as BlogTag[]
}

export async function fetchPostTagIds(client: SupabaseClient, postId: string): Promise<string[]> {
  const { data } = await client.from("blog_post_tags").select("tag_id").eq("post_id", postId)
  return (data ?? []).map((r) => r.tag_id as string)
}

export async function countCategoryPostReferences(client: SupabaseClient, categoryId: string): Promise<number> {
  const { count } = await client
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
  return count ?? 0
}

/** Admin-only: which posts reference a given Storage object path (cover, OG, or inline body image). */
export async function loadBlogMediaUsage(
  client: SupabaseClient,
  objectPath: string,
): Promise<Array<{ id: string; title: string }>> {
  // .eq() rather than a hand-built .or() string, so a path containing a
  // comma or parenthesis cannot be misread as PostgREST filter syntax.
  const [{ data: byCover }, { data: byOg }] = await Promise.all([
    client.from("blog_posts").select("id, title").eq("cover_image_path", objectPath),
    client.from("blog_posts").select("id, title").eq("og_image_path", objectPath),
  ])
  const direct = [...(byCover ?? []), ...(byOg ?? [])] as Array<{ id: string; title: string }>

  // Inline body references cannot be expressed as a column filter, so this
  // pass scans content_json — bounded to posts already fetched (or, when
  // neither cover nor OG referenced it, a small additional scan below).
  const { data: allPosts } = await client.from("blog_posts").select("id, title, content_json")
  const inline = ((allPosts ?? []) as Array<{ id: string; title: string; content_json: unknown }>).filter((row) =>
    JSON.stringify(row.content_json ?? {}).includes(objectPath),
  )

  const merged = new Map<string, { id: string; title: string }>()
  for (const row of [...direct, ...inline]) merged.set(row.id, { id: row.id, title: row.title })
  return [...merged.values()]
}
