import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  SOURCES,
  type Product,
  type ProductSource,
  type ProductCertification,
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
 * `source` is a database enum, so the vocabulary is fixed and closed — unlike
 * categories, which an administrator extends. An unrecognized value falls back
 * to the enum's own default rather than being trusted.
 */
function toSource(value: string | undefined): ProductSource {
  const known = SOURCES.find((s) => s.id !== "tumu" && s.id === value)
  return (known?.id as ProductSource | undefined) ?? "ciftlik"
}

/**
 * Defends the organic-labeling rule at the mapping boundary too: an
 * unrecognized value never falls back to 'organik_sertifikali'.
 */
function toCertification(value: string | undefined): ProductCertification {
  if (value === "organik_sertifikali" || value === "kabia_mutfak") return value
  return "kabia_secki"
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
    // The category row is carried straight through. It used to be matched
    // against a hardcoded list of five slugs, which relabelled every other
    // category as "Çiğ Badem"; an unreadable category is now simply absent.
    category: row.category?.slug ?? "",
    categoryName: row.category?.name ?? "",
    source: toSource(row.source),
    defaultWeight: defaultVariant?.weight ?? "",
    producerId: row.producer_id ?? null,
    producerName: row.producer?.name ?? "",
    producerSlug: row.producer?.slug ?? "",
    producerWhySelected: row.producer?.why_selected ?? "",
    harvestYear: row.harvest_year ?? null,
    lotCode: row.lot_code ?? "",
    variety: row.variety ?? "",
    rootstock: row.rootstock ?? "",
    processing: row.processing ?? "",
    allergens: row.allergens ?? "",
    netWeight: row.net_weight ?? "",
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
    certification: toCertification(row.certification),
    nutrition: mapNutrition(row.nutrition_facts),
    reviews,
  }
}

const PRODUCT_SELECT = `
  id, slug, name, base_price, original_price, main_image_url,
  origin, production_method, shelf_life, storage_conditions, certifications, source,
  certification, producer_id, harvest_year, lot_code, variety, rootstock,
  processing, allergens, net_weight,
  short_description, description, is_active, is_featured, created_at,
  rating_avg, rating_count, rating_breakdown,
  category:categories(slug, name),
  producer:producers(slug, name, why_selected),
  product_variants(id, label, price, stock_quantity),
  product_images(image_url, sort_order),
  nutrition_facts(calories, protein, carbohydrates, fat, fiber, sodium)
`

// Lean select for listing pages (anasayfa, magaza): sadece kartta görünen alanlar + rating.
// `certification` travels with it so the store grid can state an organic
// certification wherever the catalogue asserts one — without it every lean
// row would silently fall back to the non-organic default.
const PRODUCT_LEAN_SELECT = `
  id, slug, name, base_price, main_image_url, source, certification,
  short_description, is_active, is_featured, created_at,
  rating_avg, rating_count,
  category:categories(slug, name),
  producer:producers(slug, name)
`

/**
 * Uzak veritabanı taxonomy migration'ını (20260805000000_kabia_taxonomy)
 * henüz almamışsa `source` / `certification` / `producer_id` kolonları ve
 * `producers` tablosu yoktur. Bu durumda tam select PGRST200 / 42703 ile
 * düşer ve mağaza "Ürünler şu anda yüklenemiyor." gösterir. Migration
 * uygulanana kadar mağazayı çalışır tutmak için baz şemada var olan
 * kolonlarla yetinen legacy select'lere düşüyoruz. Eksik alanlar
 * mapProduct içindeki güvenli varsayılanlara (ciftlik / kabia_secki /
 * üreticisiz) kalır.
 */
const PRODUCT_SELECT_LEGACY = `
  id, slug, name, base_price, original_price, main_image_url,
  origin, production_method, shelf_life, storage_conditions, certifications,
  short_description, description, is_active, is_featured, created_at,
  rating_avg, rating_count, rating_breakdown,
  category:categories(slug, name),
  product_variants(id, label, price, stock_quantity),
  product_images(image_url, sort_order),
  nutrition_facts(calories, protein, carbohydrates, fat, fiber, sodium)
`

const PRODUCT_LEAN_SELECT_LEGACY = `
  id, slug, name, base_price, main_image_url,
  short_description, is_active, is_featured, created_at,
  rating_avg, rating_count,
  category:categories(slug, name)
`

function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === "PGRST200" || error.code === "PGRST205" || error.code === "42703" || error.code === "42P01") return true
  const msg = error.message ?? ""
  return (
    msg.includes("Could not find a relationship") ||
    msg.includes("Could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  )
}

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
  const first = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(50)
  if (!first.error && first.data) {
    return {
      status: "ok",
      products: first.data.map((row) => mapProduct(row as unknown as ProductRow, false)),
    }
  }
  // Eski şemalı uzak DB'ye düş: migration uygulanana kadar legacy kolonlarla dene.
  if (!isMissingSchemaError(first.error)) return { status: "error" }
  const fallback = await client
    .from("products")
    .select(PRODUCT_SELECT_LEGACY)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(50)
  if (fallback.error || !fallback.data) return { status: "error" }
  return {
    status: "ok",
    products: fallback.data.map((row) => mapProduct(row as unknown as ProductRow, false)),
  }
}

/** Existing callers that intentionally degrade to an empty list. */
export async function fetchProducts(client: SupabaseClient): Promise<Product[]> {
  const result = await fetchPublicProducts(client)
  return result.status === "ok" ? result.products : []
}

async function selectLeanWithFallback(
  client: SupabaseClient,
  build: (select: string) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>,
): Promise<Product[]> {
  const first = await build(PRODUCT_LEAN_SELECT)
  if (!first.error && first.data) {
    return first.data.map((row) => mapProduct(row as unknown as ProductRow, false))
  }
  if (!isMissingSchemaError(first.error)) return []
  const fallback = await build(PRODUCT_LEAN_SELECT_LEGACY)
  if (fallback.error || !fallback.data) return []
  return fallback.data.map((row) => mapProduct(row as unknown as ProductRow, false))
}

export async function fetchFeaturedProducts(client: SupabaseClient): Promise<Product[]> {
  return selectLeanWithFallback(client, (select) =>
    client
      .from("products")
      .select(select)
      .eq("is_active", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: true })
      .limit(4),
  )
}

/** A producer's own products, for their profile page — same card fields as the storefront grid. */
export async function fetchProductsByProducer(client: SupabaseClient, producerId: string): Promise<Product[]> {
  // Eski şemada producer_id kolonu yoktur — bu filtre hep şema hatası verir,
  // üretici sayfası boş listelenir. Yeni şemada normal çalışır.
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_LEAN_SELECT)
    .eq("is_active", true)
    .eq("producer_id", producerId)
    .order("created_at", { ascending: true })
  if (!error && data) return data.map((row) => mapProduct(row as unknown as ProductRow, false))
  if (!isMissingSchemaError(error)) return []
  return []
}

export async function fetchLeanProducts(client: SupabaseClient, limit = 4): Promise<Product[]> {
  return selectLeanWithFallback(client, (select) =>
    client
      .from("products")
      .select(select)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(limit),
  )
}

function getAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function fetchFeaturedUncached(): Promise<Product[]> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  return fetchFeaturedProducts(client)
}
async function fetchProductsUncached(): Promise<Product[]> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  return fetchLeanProducts(client, 4)
}

export const getCachedFeaturedProducts = unstable_cache(fetchFeaturedUncached, ["kabia-featured-products-v2"], {
  revalidate: 300,
  tags: ["catalog-featured"],
})
export const getCachedHomepageProducts = unstable_cache(fetchProductsUncached, ["kabia-homepage-products-v2"], {
  revalidate: 300,
  tags: ["catalog-homepage"],
})

async function fetchFeaturedFullUncached(): Promise<Product[]> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapProduct(row as unknown as ProductRow, false))
}

/**
 * Öne çıkanlar şeridi varyant ister (stok + ağırlık + sepete ekle id'si);
 * lean satırlar yetmez. Stok bilinmiyorken "Stokta yok" yazmak yasaktır —
 * o yüzden bu şerit tam satır okur.
 */
export const getCachedFeaturedFullProducts = unstable_cache(fetchFeaturedFullUncached, ["kabia-featured-full-v2"], {
  revalidate: 300,
  tags: ["catalog-featured"],
})

export async function fetchProductBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<Product | null> {
  const first = await client
    .from("products")
    .select(
      `${PRODUCT_SELECT}, reviews(id, reviewer_name, user_id, rating, review_text, is_verified_purchase, created_at)`,
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .order("created_at", { referencedTable: "reviews", ascending: false })
    .maybeSingle()
  if (!first.error && first.data) return mapProduct(first.data as unknown as ProductRow, true)
  if (!isMissingSchemaError(first.error)) return null
  const fallback = await client
    .from("products")
    .select(
      `${PRODUCT_SELECT_LEGACY}, reviews(id, reviewer_name, user_id, rating, review_text, is_verified_purchase, created_at)`,
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .order("created_at", { referencedTable: "reviews", ascending: false })
    .maybeSingle()
  if (fallback.error || !fallback.data) return null
  return mapProduct(fallback.data as unknown as ProductRow, true)
}

export async function fetchRelatedProducts(
  client: SupabaseClient,
  product: Product,
  count = 4,
): Promise<Product[]> {
  const categoryId = await categoryIdBySlug(client, product.category)
  const queryLean = (select: string) =>
    Promise.all([
      categoryId
        ? client.from("products").select(select).eq("is_active", true).eq("category_id", categoryId).neq("slug", product.slug).order("created_at", { ascending: true }).limit(count)
        : Promise.resolve({ data: [] as unknown[] | null, error: null }),
      client.from("products").select(select).eq("is_active", true).neq("slug", product.slug).order("created_at", { ascending: true }).limit(count),
    ])
  let [sameRes, restRes] = await queryLean(PRODUCT_LEAN_SELECT)
  const sameErr = (sameRes as { error?: { code?: string; message?: string } | null }).error
  const restErr = (restRes as { error?: { code?: string; message?: string } | null }).error
  if (isMissingSchemaError(sameErr) || isMissingSchemaError(restErr)) {
    ;[sameRes, restRes] = await queryLean(PRODUCT_LEAN_SELECT_LEGACY)
  }
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
