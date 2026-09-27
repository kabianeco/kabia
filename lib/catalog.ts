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
    // S17: the view supplies account_backed; the legacy user_id shape is kept
    // only so older mapped rows still classify correctly in tests.
    accountBacked: r.account_backed ?? r.user_id != null,
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
    categorySortOrder: row.category?.sort_order ?? 0,
    source: toSource(row.source),
    defaultWeight: defaultVariant?.weight ?? "",
    producerId: row.producer_id ?? null,
    producerName: row.producer?.name ?? "",
    producerSlug: row.producer?.slug ?? "",
    updatedAt: row.updated_at ?? undefined,
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
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
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
  short_description, description, seo_title, seo_description, is_active, is_featured, created_at, updated_at,
  rating_avg, rating_count, rating_breakdown,
  category:categories(slug, name, sort_order),
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
  category:categories(slug, name, sort_order),
  producer:producers(slug, name)
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

/** Shared shape for the listing reads that degrade to an empty list. */
async function selectLean(
  build: (select: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<Product[]> {
  const { data, error } = await build(PRODUCT_LEAN_SELECT)
  if (error || !data) return []
  return data.map((row) => mapProduct(row as unknown as ProductRow, false))
}

export async function fetchFeaturedProducts(client: SupabaseClient): Promise<Product[]> {
  return selectLean((select) =>
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
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_LEAN_SELECT)
    .eq("is_active", true)
    .eq("producer_id", producerId)
    // The producer's shelf is curated in the product editor via display_order,
    // the same field that orders the admin catalogue. created_at keeps the
    // order total where display_order is tied (as it is for every current
    // single-product shelf, which this reorders not at all).
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data.map((row) => mapProduct(row as unknown as ProductRow, false))
}

export async function fetchLeanProducts(client: SupabaseClient, limit = 4): Promise<Product[]> {
  return selectLean((select) =>
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

/**
 * Storefront catalogue cache. Listing and detail reads below go through the
 * shared anon client and refresh every 5 minutes; admin product/producer/
 * category mutations and review submissions bust the tags with updateTag, so
 * an edit is visible on the next request, never stuck behind the ceiling.
 */
export const CATALOG_PRODUCTS_TAG = "catalog-products"

async function fetchPublicProductsUncached(): Promise<PublicProductsResult> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  return fetchPublicProducts(client)
}

export const getCachedPublicProducts = unstable_cache(fetchPublicProductsUncached, ["kabia-public-products-v1"], {
  revalidate: 300,
  tags: [CATALOG_PRODUCTS_TAG],
})

async function fetchProductBaseUncached(slug: string): Promise<Product | null> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  return fetchProductBase(client, slug)
}

export const getCachedProductBase = unstable_cache(fetchProductBaseUncached, ["kabia-product-base-v1"], {
  revalidate: 300,
  tags: [CATALOG_PRODUCTS_TAG],
})

async function fetchProducerProductsUncached(producerId: string): Promise<Product[]> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  return fetchProductsByProducer(client, producerId)
}

export const getCachedProducerProducts = unstable_cache(fetchProducerProductsUncached, ["kabia-producer-products-v1"], {
  revalidate: 300,
  tags: [CATALOG_PRODUCTS_TAG],
})

/**
 * Reviews and related products, cached with the same tag. Both change only
 * through busted paths — review submits and catalog mutations bust
 * CATALOG_PRODUCTS_TAG, and order commits bust it via the confirmation
 * action — so the product page serves warm on all three reads. Stock truth
 * still holds: the order RPC validates and decrements atomically, so a
 * display lag can never oversell.
 */
async function fetchProductReviewsUncached(productId: string): Promise<ProductReview[]> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  return fetchProductReviews(client, productId)
}

export const getCachedProductReviews = unstable_cache(fetchProductReviewsUncached, ["kabia-product-reviews-v1"], {
  revalidate: 300,
  tags: [CATALOG_PRODUCTS_TAG],
})

async function fetchRelatedUncached(category: string, slug: string, count: number): Promise<Product[]> {
  const client = getAnonClient()
  if (!client) throw new Error("Supabase env eksik — Vercel build env kontrol edin")
  const categoryId = await categoryIdBySlug(client, category)
  const restPromise = client.from("products").select(PRODUCT_LEAN_SELECT).eq("is_active", true).neq("slug", slug).order("created_at", { ascending: true }).limit(count)
  const samePromise = categoryId
    ? client.from("products").select(PRODUCT_LEAN_SELECT).eq("is_active", true).eq("category_id", categoryId).neq("slug", slug).order("created_at", { ascending: true }).limit(count)
    : Promise.resolve({ data: [] as unknown[] | null })
  const [sameRes, restRes] = await Promise.all([samePromise, restPromise])
  const combined = [
    ...(sameRes.data ?? []).map((r) => mapProduct(r as unknown as ProductRow, false)),
    ...(restRes.data ?? []).map((r) => mapProduct(r as unknown as ProductRow, false)),
  ]
  const seen = new Set<string>()
  return combined.filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true))).slice(0, count)
}

export const getCachedRelatedProducts = unstable_cache(fetchRelatedUncached, ["kabia-related-v1"], {
  revalidate: 300,
  tags: [CATALOG_PRODUCTS_TAG],
})

export async function fetchProductBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<Product | null> {
  const base = await fetchProductBase(client, slug)
  if (!base) return null
  // S17: reviews come from the public_reviews view (no user_id column), not
  // the base table — a separate keyed read keeps the shape mapProduct expects.
  const reviews = await fetchProductReviews(client, base.id)
  return { ...base, reviews }
}

/**
 * The product row without reviews. The product page fetches this first, then
 * fires the reviews read and the related-products reads in parallel — the
 * related shelf needs the product's category, not its reviews, so waiting for
 * reviews before starting it cost a full sequential round trip.
 */
export async function fetchProductBase(
  client: SupabaseClient,
  slug: string,
): Promise<Product | null> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle()
  // No row is "no such product" (the page 404s). A failed read is not: it
  // throws, so the route's error boundary tells the visitor the page could
  // not load instead of claiming the product does not exist. The message
  // stays in the server log; the boundary never shows it.
  if (error) throw new Error(`[catalog] product read failed for "${slug}": ${error.message}`)
  if (!data) return null
  return mapProduct(data as unknown as ProductRow, false)
}

/** Reviews for a product already read — runs alongside related products. */
export async function fetchProductReviews(
  client: SupabaseClient,
  productId: string,
): Promise<ProductReview[]> {
  const { data: reviewRows, error: reviewError } = await client
    .from("public_reviews")
    .select("id, reviewer_name, rating, review_text, is_verified_purchase, created_at, account_backed")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
  if (reviewError) throw new Error(`[catalog] review read failed: ${reviewError.message}`)
  return (reviewRows ?? []).map((r) => mapReview(r as unknown as ReviewRow))
}

export async function fetchRelatedProducts(
  client: SupabaseClient,
  product: Product,
  count = 4,
): Promise<Product[]> {
  // Same category first, then anything else, so a thin category still fills the
  // row. Both reads degrade to an empty list; related products are a courtesy,
  // never a reason to fail the product page.
  //
  // The unfiltered read has no dependency, so it fires immediately; only the
  // same-category read waits on the category id lookup. Previously the lookup
  // gated both reads, costing a sequential round trip.
  const restPromise = client.from("products").select(PRODUCT_LEAN_SELECT).eq("is_active", true).neq("slug", product.slug).order("created_at", { ascending: true }).limit(count)
  const categoryId = await categoryIdBySlug(client, product.category)
  const samePromise = categoryId
    ? client.from("products").select(PRODUCT_LEAN_SELECT).eq("is_active", true).eq("category_id", categoryId).neq("slug", product.slug).order("created_at", { ascending: true }).limit(count)
    : Promise.resolve({ data: [] as unknown[] | null })
  const [sameRes, restRes] = await Promise.all([samePromise, restPromise])
  const combined = [
    ...(sameRes.data ?? []).map((r) => mapProduct(r as unknown as ProductRow, false)),
    ...(restRes.data ?? []).map((r) => mapProduct(r as unknown as ProductRow, false)),
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
