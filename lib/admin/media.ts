/**
 * Storage constants for product media.
 *
 * These live outside the `"use server"` actions module on purpose: every export
 * of a server-actions file must be an async function, so a plain `const` there
 * silently strips the module's entire export list at build time.
 */

export const MEDIA_BUCKET = "product-media"

export const MEDIA_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

/**
 * Never trust a client-supplied filename as a storage path: it can contain
 * `../`, control characters, or a wildly different extension from the real
 * content type. The name is rebuilt from a slugified stem, a random suffix and
 * an extension derived from the validated MIME type.
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
