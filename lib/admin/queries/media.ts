import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  MEDIA_BUCKET,
  MEDIA_PAGE_SIZE,
  type MediaAsset,
  type MediaUsage,
} from "@/lib/admin/media"
import { logQueryError } from "@/lib/admin/errors"

/**
 * Reads for the media library and the product picker.
 *
 * Everything here is bounded. The library never fetches the whole bucket into
 * the browser — it pages over `media_assets` in Postgres against the indexes
 * created alongside the table, and asks Storage for nothing at all. Listing
 * Storage directly, as the first version of this screen did, meant one request
 * per YYYY-MM/ prefix and no way to search, sort or count.
 *
 * All of it runs through the administrator's own client, so RLS decides what
 * comes back. A customer session reaching these functions gets zero rows rather
 * than an error, which is the correct shape of the answer.
 */

export type MediaSort = "newest" | "oldest" | "name" | "largest"

export interface MediaQuery {
  search?: string
  mimeType?: string
  sort?: MediaSort
  page?: number
  pageSize?: number
}

export interface MediaPage {
  assets: MediaAsset[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

interface MediaRow {
  id: string
  bucket_id: string
  object_path: string
  original_filename: string
  display_name: string | null
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  alt_text: string | null
  created_at: string
  created_by: string
}

function toAsset(row: MediaRow, publicUrl: string, uploadedBy: string | null): MediaAsset {
  return {
    id: row.id,
    bucketId: row.bucket_id,
    objectPath: row.object_path,
    url: publicUrl,
    originalFilename: row.original_filename,
    displayName: row.display_name,
    label: row.display_name?.trim() || row.original_filename,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    createdAt: row.created_at,
    uploadedBy,
  }
}

/**
 * PostgREST's `or` filter is comma-delimited, so a search term containing a
 * comma, a parenthesis or a quote would break out of the expression it is
 * embedded in. Terms are stripped to what a filename can legitimately contain.
 */
function sanitiseSearch(term: string): string {
  return term.replace(/[,()"'\\%]/g, " ").trim().slice(0, 80)
}

export async function loadMediaPage(
  supabase: SupabaseClient,
  query: MediaQuery = {},
): Promise<MediaPage> {
  const pageSize = Math.min(Math.max(query.pageSize ?? MEDIA_PAGE_SIZE, 1), 96)
  const page = Math.max(query.page ?? 1, 1)
  const from = (page - 1) * pageSize

  let builder = supabase
    .from("media_assets")
    .select(
      "id, bucket_id, object_path, original_filename, display_name, mime_type, file_size, width, height, alt_text, created_at, created_by",
      { count: "exact" },
    )
    .is("deleted_at", null)

  const search = query.search ? sanitiseSearch(query.search) : ""
  if (search.length >= 2) {
    builder = builder.or(
      `original_filename.ilike.%${search}%,display_name.ilike.%${search}%,alt_text.ilike.%${search}%`,
    )
  }

  if (query.mimeType) builder = builder.eq("mime_type", query.mimeType)

  switch (query.sort) {
    case "oldest":
      builder = builder.order("created_at", { ascending: true })
      break
    case "name":
      builder = builder.order("original_filename", { ascending: true })
      break
    case "largest":
      builder = builder.order("file_size", { ascending: false })
      break
    default:
      builder = builder.order("created_at", { ascending: false })
  }

  const { data, error, count } = await builder.range(from, from + pageSize - 1)

  if (error) {
    logQueryError("media:page", error)
    return { assets: [], total: 0, page, pageSize, pageCount: 0 }
  }

  const rows = (data ?? []) as MediaRow[]

  // Uploader names come from profiles rather than auth.users: reading the auth
  // schema needs the service-role key, and the dashboard never uses it for
  // ordinary reads.
  const uploaderIds = [...new Set(rows.map((row) => row.created_by))]
  const names = new Map<string, string>()
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds)
    for (const profile of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (profile.full_name) names.set(profile.id, profile.full_name)
    }
  }

  const assets = rows.map((row) => {
    const {
      data: { publicUrl },
    } = supabase.storage.from(row.bucket_id || MEDIA_BUCKET).getPublicUrl(row.object_path)
    return toAsset(row, publicUrl, names.get(row.created_by) ?? null)
  })

  const total = count ?? assets.length
  return {
    assets,
    total,
    page,
    pageSize,
    pageCount: Math.max(Math.ceil(total / pageSize), 1),
  }
}

/**
 * Which products point at each of the given assets.
 *
 * Matching is by both `storage_path` and `image_url` because the two coexist:
 * rows created through the media library carry a path, while the seeded
 * catalogue and anything created before it carry only a URL. Missing either
 * would let a referenced image be deleted.
 */
export async function loadMediaUsage(
  supabase: SupabaseClient,
  assets: MediaAsset[],
): Promise<Map<string, MediaUsage[]>> {
  const usage = new Map<string, MediaUsage[]>()
  if (assets.length === 0) return usage

  const urls = assets.map((asset) => asset.url)
  const paths = assets.map((asset) => asset.objectPath)

  const [galleryRes, mainRes] = await Promise.all([
    supabase
      .from("product_images")
      .select("image_url, storage_path, products(id, name)")
      .or(`image_url.in.(${urls.map((u) => `"${u}"`).join(",")}),storage_path.in.(${paths
        .map((p) => `"${p}"`)
        .join(",")})`),
    supabase.from("products").select("id, name, main_image_url").in("main_image_url", urls),
  ])

  if (galleryRes.error) logQueryError("media:usage:gallery", galleryRes.error)
  if (mainRes.error) logQueryError("media:usage:main", mainRes.error)

  const byUrl = new Map<string, MediaUsage[]>()
  const byPath = new Map<string, MediaUsage[]>()

  const push = (map: Map<string, MediaUsage[]>, key: string, entry: MediaUsage) => {
    map.set(key, [...(map.get(key) ?? []), entry])
  }

  for (const row of (galleryRes.data ?? []) as unknown as {
    image_url: string
    storage_path: string | null
    products: { id: string; name: string } | null
  }[]) {
    if (!row.products) continue
    const entry: MediaUsage = {
      productId: row.products.id,
      productName: row.products.name,
      isPrimary: false,
    }
    if (row.image_url) push(byUrl, row.image_url, entry)
    if (row.storage_path) push(byPath, row.storage_path, entry)
  }

  for (const row of (mainRes.data ?? []) as {
    id: string
    name: string
    main_image_url: string
  }[]) {
    push(byUrl, row.main_image_url, {
      productId: row.id,
      productName: row.name,
      isPrimary: true,
    })
  }

  for (const asset of assets) {
    const merged = [...(byUrl.get(asset.url) ?? []), ...(byPath.get(asset.objectPath) ?? [])]
    // One product may reference the same asset both as its primary image and in
    // its gallery; it should be listed once, and as primary if either says so.
    const collapsed = new Map<string, MediaUsage>()
    for (const entry of merged) {
      const existing = collapsed.get(entry.productId)
      collapsed.set(entry.productId, {
        ...entry,
        isPrimary: (existing?.isPrimary ?? false) || entry.isPrimary,
      })
    }
    usage.set(asset.id, [...collapsed.values()])
  }

  return usage
}

/** The distinct MIME types present, for the library's type filter. */
export async function loadMediaMimeTypes(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("mime_type")
    .is("deleted_at", null)
    .limit(500)

  if (error) {
    logQueryError("media:mimeTypes", error)
    return []
  }
  return [...new Set((data ?? []).map((row) => (row as { mime_type: string }).mime_type))].sort()
}
