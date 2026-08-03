import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Turkish-aware slugification. `toLowerCase()` alone mishandles the Turkish
 * dotted/dotless I pair (İ → i̇, ı stays ı but the diacritics below still need
 * folding), so every Turkish letter is mapped explicitly before the generic
 * accent strip runs.
 */
const TURKISH_MAP: Record<string, string> = {
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ı: "i", I: "i",
  İ: "i", i: "i",
  ö: "o", Ö: "o",
  ş: "s", Ş: "s",
  ü: "u", Ü: "u",
}

export function slugify(input: string): string {
  const folded = input
    .split("")
    .map((ch) => TURKISH_MAP[ch] ?? ch)
    .join("")
  return folded
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip remaining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 96)
    .replace(/-+$/g, "")
}

/**
 * Paths that must never be shadowed by a post slug — literal Next.js routes
 * under /blog take precedence in routing regardless, but a post claiming one
 * of these would still be confusing to link to and to find again.
 */
export const RESERVED_BLOG_SLUGS = new Set([
  "rss.xml",
  "sayfa",
  "kategori",
  "kategoriler",
  "etiket",
  "etiketler",
  "arama",
  "yeni",
  "preview",
  "taslak",
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED_BLOG_SLUGS.has(slug)
}

/** Appends -2, -3, … until the slug is free. `excludeId` lets an edit keep its own slug. */
export async function ensureUniqueSlug(
  supabase: SupabaseClient,
  table: "blog_posts" | "blog_categories" | "blog_tags",
  baseSlug: string,
  excludeId?: string | null,
): Promise<string> {
  let candidate = baseSlug || "yazi"
  let suffix = 2
  // Bounded: a blog will not plausibly need 500 slug collisions in one title.
  for (let attempt = 0; attempt < 500; attempt++) {
    if (isReservedSlug(candidate)) {
      candidate = `${baseSlug}-${suffix}`
      suffix += 1
      continue
    }
    const query = supabase.from(table).select("id").eq("slug", candidate).limit(1)
    const { data } = excludeId ? await query.neq("id", excludeId) : await query
    if (!data || data.length === 0) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
  return `${baseSlug}-${Date.now()}`
}
