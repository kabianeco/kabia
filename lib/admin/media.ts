/**
 * Storage constants and shared shapes for product media.
 *
 * These live outside the `"use server"` actions module on purpose: every export
 * of a server-actions file must be an async function, so a plain `const` there
 * silently strips the module's entire export list at build time. This module is
 * also imported by client components, so it must stay free of `server-only`
 * imports and of anything that reads a session.
 */

export const MEDIA_BUCKET = "product-media"

/**
 * 10 MB. Product photography is shot at high resolution and the storefront
 * downsamples through next/image, so the original is kept intact rather than
 * forcing the operator to resize before uploading. Mirrored by
 * `storage.buckets.file_size_limit`, which is the boundary that actually
 * enforces it — this constant only buys a better error message.
 */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024

export const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

export const MEDIA_MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/avif": "AVIF",
}

/** The accept attribute for every file input that feeds the library. */
export const MEDIA_ACCEPT = Object.keys(MEDIA_EXTENSIONS).join(",")

export const MEDIA_PAGE_SIZE = 24

/** A row of the library as every surface consumes it. */
export interface MediaAsset {
  id: string
  bucketId: string
  objectPath: string
  url: string
  originalFilename: string
  displayName: string | null
  /** What to show in a list: the display name if set, else the upload name. */
  label: string
  mimeType: string
  fileSize: number
  width: number | null
  height: number | null
  altText: string | null
  createdAt: string
  uploadedBy: string | null
}

export interface MediaUsage {
  productId: string
  productName: string
  /** Whether the product uses it as its primary image rather than a gallery one. */
  isPrimary: boolean
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDimensions(width: number | null, height: number | null): string {
  return width && height ? `${width} × ${height}` : "Bilinmiyor"
}

/**
 * Never trust a client-supplied filename as a storage path: it can contain
 * `../`, control characters, a NUL byte, or a wildly different extension from
 * the real content type. The name is rebuilt from a slugified stem, a random
 * suffix and an extension derived from the *probed* MIME type, so the path is
 * collision-safe, traversal-free and always agrees with the bytes.
 *
 * Foldering by year/month keeps any single Storage prefix small enough to list
 * quickly, and makes the object layout legible in the Supabase dashboard.
 */
export function safeObjectName(originalName: string, mimeType: string): string {
  const base = originalName
    .replace(/\.[^.]+$/, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  const stem = base || "gorsel"
  const extension = MEDIA_EXTENSIONS[mimeType] ?? "bin"
  const unique = crypto.randomUUID().slice(0, 8)
  const now = new Date()
  const folder = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  return `${folder}/${stem}-${unique}.${extension}`
}

/**
 * The public URL for a stored object, derived rather than stored.
 *
 * The bucket is public, so this URL is stable and never expires — which is
 * exactly why it is safe to persist on a product row. A signed URL would not
 * be, and must never be written to `products.main_image_url`.
 */
export function publicMediaUrl(supabaseUrl: string, bucket: string, objectPath: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`
}
