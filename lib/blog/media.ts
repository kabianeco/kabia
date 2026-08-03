import { MEDIA_BUCKET, publicMediaUrl } from "@/lib/admin/media"

/** Resolves a stored object-path snapshot (cover_image_path, og_image_path, …) to a public URL. */
export function blogImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return publicMediaUrl(base, MEDIA_BUCKET, path)
}
