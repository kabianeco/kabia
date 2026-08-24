import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductReview,
  type ProductVariant,
  type NutritionInfo,
} from "@/lib/products"
import type {
  NutritionFactsRow,
  ProductImageRow,
  ProductRow,
  ProductVariantRow,
  ReviewRow,
} from "@/lib/supabase/rows"

// ---- pure mappers (DB row -> frontend Product shape) ----

function mapNutrition(n: NutritionFactsRow | null): NutritionInfo {
  if (!n) return { kalori: "", protein: "", karbonhidrat: "", yag: "", lif: "", sodyum: "" }
  return {
    kalori: n.calories ?? "",
    protein: n.protein ?? "",
    karbonhidrat: n.carbohydrates ?? "",
    yag: n.fat ?? "",
    lif: n.fiber ?? "",
    sodyum: n.sodium ?? "",
  }
}

/**
 * Category slugs are seeded from the same list the UI filters on. Anything the
 * database returns outside that list would otherwise silently break filtering,
 * so it falls back to the raw slug being unmatched rather than being trusted.
 */
function toCategory(slug: string | undefined): ProductCategory {
  const known = CATEGORIES.find((c) => c.id !== "tumu" && c.id === slug)
  return (known?.id as ProductCategory | undefined) ?? "cig-badem"
}

function nameSeed(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1000
  return (Math.abs(h) % 70) + 1
}

export function mapReview(r: ReviewRow): ProductReview {
  const name = r.reviewer_name ?? "Kullanıcı"
  return {
    name,
    avatarSeed: nameSeed(name),
    date: new Date(r.created_at).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    rating: r.rating,
    text: r.review_text,
    verified: r.is_verified_purchase ?? false,
  }
}

// Build a Product from a fetched DB row (with nested relations).
export function mapProduct(row: ProductRow, includeReviews = false): Product {
  const variants: ProductVariant[] = (row.product_variants || [])
    .map((v: ProductVariantRow) => ({
      id: v.id,
      weight: v.label,
      price: Number(v.price),
      stock: Number(v.stock_quantity ?? 0),
    }))
    .sort((a: ProductVariant, b: ProductVariant) => a.price - b.price)
  const base = Number(row.base_price)
  const defaultVariant = variants.find((v) => v.price === base) ?? variants[0]
  const images: string[] = (row.product_images || [])
    .slice()
    .sort((a: ProductImageRow, b: ProductImageRow) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i: ProductImageRow) => i.image_url)
  const mainImageUrl = row.main_image_url ?? images[0] ?? ""
  const reviews = includeReviews ? (row.reviews ?? []).map(mapReview) : []
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: toCategory(row.category?.slug),
    defaultWeight: defaultVariant?.weight ?? "",
    price: base,
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    seed: row.slug,
    mainImageUrl,
    images,
    variants,
    rating: Number(row.rating_avg) || 0,
    reviewCount: row.rating_count || 0,
    ratingBreakdown: Array.isArray(row.rating_breakdown)
      ? (row.rating_breakdown as [number, number, number, number, number])
      : [0, 0, 0, 0, 0],
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    origin: row.origin ?? "",
    productionMethod: row.production_method ?? "",
    shelfLife: row.shelf_life ?? "",
    storage: row.storage_conditions ?? "",
    certificates: row.certifications ?? "",
    nutrition: mapNutrition(row.nutrition_facts),
    reviews,
  }
}

const PRODUCT_SELECT = `
  id, slug, name, base_price, original_price, main_image_url,
  origin, production_method, shelf_life, storage_conditions, certifications,
  short_description, description, is_active, is_featured, created_at,
  rating_avg, rating_count, rating_breakdown,
  category:categories(slug),
  product_variants(id, label, price, stock_quantity),
  product_images(image_url, sort_order),
  nutrition_facts(calories, protein, carbohydrates, fat, fiber, sodium)
`

// Lean select for listing pages (anasayfa, magaza): sadece kartta görünen alanlar + rating
const PRODUCT_LEAN_SELECT = `
  id, slug, name, base_price, main_image_url,
  short_description, is_active, is_featured, created_at,
  rating_avg, rating_count,
  category:categories(slug)
`

// ---- async fetch functions (accept a server or browser client) ----

export type PublicProductsResult =
  | { status: "ok"; products: Product[] }
  | { status: "error" }

/**
 * Storefront read that preserves the difference between an empty catalogue and
 * a failed query. Route components use this result to render an honest stable
 * error instead of disguising an outage as "no products".
 */
export async function fetchPublicProducts(
  client: SupabaseClient,
): Promise<PublicProductsResult> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(50)
  if (error || !data) return { status: "error" }
  return {
    status: "ok",
    products: data.map((row) => mapProduct(row as unknown as ProductRow, false)),
  }
}

/** Existing callers that intentionally degrade to an empty list. */
export async function fetchProducts(client: SupabaseClient): Promise<Product[]> {
  const result = await fetchPublicProducts(client)
  return result.status === "ok" ? result.products : []
}

export async function fetchFeaturedProducts(client: SupabaseClient): Promise<Product[]> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_LEAN_SELECT)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: true })
    .limit(4)
  if (error || !data) return []
  return data.map((row) => mapProduct(row as unknown as ProductRow, false))
}

export async function fetchLeanProducts(client: SupabaseClient, limit = 4): Promise<Product[]> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_LEAN_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(limit)
  if (error || !data) return []
  return data.map((row) => mapProduct(row as unknown as ProductRow, false))
}

function getAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function fetchFeaturedUncached(): Promise<Product[]> {
  const client = getAnonClient()
  if (!client) return []
  return fetchFeaturedProducts(client)
}
async function fetchProductsUncached(): Promise<Product[]> {
  const client = getAnonClient()
  if (!client) return []
  return fetchLeanProducts(client, 4)
}

export const getCachedFeaturedProducts = unstable_cache(fetchFeaturedUncached, ["kabia-featured-products"], {
  revalidate: 300,
  tags: ["catalog-featured"],
})
export const getCachedHomepageProducts = unstable_cache(fetchProductsUncached, ["kabia-homepage-products"], {
  revalidate: 300,
  tags: ["catalog-homepage"],
})

export async function fetchProductBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<Product | null> {
  const { data, error } = await client
    .from("products")
    .select(
      `${PRODUCT_SELECT}, reviews(id, reviewer_name, user_id, rating, review_text, is_verified_purchase, created_at)`,
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .order("created_at", { referencedTable: "reviews", ascending: false })
    .maybeSingle()
  if (error || !data) return null
  return mapProduct(data as unknown as ProductRow, true)
}

export async function fetchRelatedProducts(
  client: SupabaseClient,
  product: Product,
  count = 4,
): Promise<Product[]> {
  const categoryId = await categoryIdBySlug(client, product.category)
  const [sameRes, restRes] = await Promise.all([
    categoryId
      ? client.from("products").select(PRODUCT_LEAN_SELECT).eq("is_active", true).eq("category_id", categoryId).neq("slug", product.slug).order("created_at", { ascending: true }).limit(count)
      : Promise.resolve({ data: [] as unknown[] }),
    client.from("products").select(PRODUCT_LEAN_SELECT).eq("is_active", true).neq("slug", product.slug).order("created_at", { ascending: true }).limit(count),
  ])
  const same = (sameRes as { data: unknown[] | null }).data
  const rest = (restRes as { data: unknown[] | null }).data
  const combined = [
    ...(same ?? []).map((r) => mapProduct(r as unknown as ProductRow, false)),
    ...(rest ?? []).map((r) => mapProduct(r as unknown as ProductRow, false)),
  ]
  // dedupe by slug
  const seen = new Set<string>()
  const dedup = combined.filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)))
  return dedup.slice(0, count)
}

async function categoryIdBySlug(client: SupabaseClient, slug: string): Promise<string | null> {
  const { data } = await client.from("categories").select("id").eq("slug", slug).maybeSingle()
  return data?.id ?? null
}
