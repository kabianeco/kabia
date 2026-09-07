import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"
import { toNumber } from "@/lib/admin/format"
import { PRODUCT_READ_COLUMNS } from "@/lib/admin/product-fields"
import type { ProductCertification, ProductSource } from "@/lib/products"

/**
 * Product list and detail reads.
 *
 * Everything is server-side and bounded: search, filtering, sorting and
 * pagination all happen in Postgres against the `admin_product_overview` view,
 * and the query asks for `count: "exact"` so the pager knows the total without
 * a second full read.
 */

/**
 * PostgREST's `or=` filter is a comma/parenthesis-delimited mini-language, so a
 * raw search term could otherwise break out of the value and inject extra
 * filter clauses. Only characters that are meaningful to a shop operator
 * survive, and the result is length-capped.
 */
export function sanitizeSearch(input: string | undefined | null): string {
  if (!input) return ""
  return input
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
}

export const PRODUCT_SORTS = {
  updated_at: "updated_at",
  created_at: "created_at",
  name: "name",
  base_price: "base_price",
  total_stock: "total_stock",
  display_order: "display_order",
  producer_name: "producer_name",
} as const

export type ProductSortKey = keyof typeof PRODUCT_SORTS

export interface ProductListParams {
  q?: string
  status?: "aktif" | "arsiv"
  category?: string
  producer?: string
  stock?: "tukendi" | "kritik" | "yeterli"
  featured?: "evet"
  sort: ProductSortKey
  dir: "asc" | "desc"
  page: number
  perPage: number
}

export interface ProductListRow {
  id: string
  slug: string
  name: string
  basePrice: number
  mainImageUrl: string | null
  isActive: boolean
  isFeatured: boolean
  updatedAt: string
  categoryName: string | null
  categorySlug: string | null
  producerId: string | null
  producerName: string | null
  source: ProductSource | null
  totalStock: number
  variantCount: number
  lowStockThreshold: number
  stockStatus: "tukendi" | "kritik" | "yeterli"
}

export interface ProductListResult {
  rows: ProductListRow[]
  total: number
  error: boolean
  /**
   * Whether the read model exposed the producer dimension. The Phase 3 view
   * migration is authored but unapplied, so this is false until it lands and
   * the screen hides the producer filter and column meanwhile — the list
   * behaves exactly as it did before, rather than erroring.
   */
  producerDimension: boolean
}

/**
 * PostgREST reports an unknown select column from the schema cache. Only
 * that condition falls back to the pre-dimension select; every other error
 * keeps today's error path.
 */
function isMissingViewColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === "PGRST204" || error.code === "PGRST200" || error.code === "42703") return true
  const msg = error.message ?? ""
  return msg.includes("schema cache") && msg.includes("Could not find")
}

const LIST_SELECT =
  "id, slug, name, base_price, main_image_url, is_active, is_featured, updated_at, category_name, category_slug, total_stock, variant_count, low_stock_threshold, stock_status"

const LIST_SELECT_WITH_PRODUCER = `${LIST_SELECT}, producer_id, producer_name, source`

type ListRow = {
  id: string
  slug: string
  name: string
  base_price: number | string
  main_image_url: string | null
  is_active: boolean
  is_featured: boolean
  updated_at: string
  category_name: string | null
  category_slug: string | null
  producer_id?: string | null
  producer_name?: string | null
  source?: ProductSource | null
  total_stock: number
  variant_count: number
  low_stock_threshold: number
  stock_status: "tukendi" | "kritik" | "yeterli"
}

function toListRow(row: ListRow): ProductListRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    basePrice: toNumber(row.base_price),
    mainImageUrl: row.main_image_url,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    updatedAt: row.updated_at,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    producerId: row.producer_id ?? null,
    producerName: row.producer_name ?? null,
    source: row.source ?? null,
    totalStock: row.total_stock,
    variantCount: row.variant_count,
    lowStockThreshold: row.low_stock_threshold,
    stockStatus: row.stock_status,
  }
}

export async function loadProductList(
  supabase: SupabaseClient,
  params: ProductListParams,
): Promise<ProductListResult> {
  const from = (params.page - 1) * params.perPage
  const to = from + params.perPage - 1
  const q = sanitizeSearch(params.q)

  // The enriched select exposes the producer dimension once the Phase 3 view
  // migration lands. Until then the view lacks those columns and PostgREST
  // answers from the schema cache — that, and only that, falls back to
  // today's select below, so the list behaves exactly as before.
  let enriched = supabase
    .from("admin_product_overview")
    .select(LIST_SELECT_WITH_PRODUCER, { count: "exact" })

  if (q.length >= 2) {
    // name, slug and every SKU on the product, in one indexed pass.
    enriched = enriched.or(`name.ilike.%${q}%,slug.ilike.%${q}%,skus.ilike.%${q}%`)
  }
  if (params.status === "aktif") enriched = enriched.eq("is_active", true)
  if (params.status === "arsiv") enriched = enriched.eq("is_active", false)
  if (params.category) enriched = enriched.eq("category_slug", params.category)
  if (params.producer) enriched = enriched.eq("producer_id", params.producer)
  if (params.stock) enriched = enriched.eq("stock_status", params.stock)
  if (params.featured === "evet") enriched = enriched.eq("is_featured", true)

  const first = await enriched
    .order(PRODUCT_SORTS[params.sort], { ascending: params.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, to)

  if (!first.error && first.data) {
    return {
      rows: (first.data as ListRow[]).map(toListRow),
      total: first.count ?? 0,
      error: false,
      producerDimension: true,
    }
  }
  if (first.error && !isMissingViewColumn(first.error)) {
    logQueryError("products:list", first.error)
    return { rows: [], total: 0, error: true, producerDimension: false }
  }

  let legacy = supabase.from("admin_product_overview").select(LIST_SELECT, { count: "exact" })

  if (q.length >= 2) {
    legacy = legacy.or(`name.ilike.%${q}%,slug.ilike.%${q}%,skus.ilike.%${q}%`)
  }
  if (params.status === "aktif") legacy = legacy.eq("is_active", true)
  if (params.status === "arsiv") legacy = legacy.eq("is_active", false)
  if (params.category) legacy = legacy.eq("category_slug", params.category)
  if (params.stock) legacy = legacy.eq("stock_status", params.stock)
  if (params.featured === "evet") legacy = legacy.eq("is_featured", true)

  // No producer column to sort or filter by on the old view: the one sort key
  // that needs it degrades to recency, and a producer filter has nothing to
  // match against, so it is left off rather than erroring.
  const legacySort = params.sort === "producer_name" ? "updated_at" : PRODUCT_SORTS[params.sort]
  const second = await legacy
    .order(legacySort, { ascending: params.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, to)

  if (second.error) {
    logQueryError("products:list", second.error)
    return { rows: [], total: 0, error: true, producerDimension: false }
  }

  return {
    rows: (second.data as ListRow[]).map(toListRow),
    total: second.count ?? 0,
    error: false,
    producerDimension: false,
  }
}

export interface CategoryOption {
  id: string
  slug: string
  name: string
}

export async function loadCategories(supabase: SupabaseClient): Promise<CategoryOption[]> {
  const { data, error } = await supabase.from("categories").select("id, slug, name").order("name")
  if (error) {
    logQueryError("products:categories", error)
    return []
  }
  return (data ?? []) as CategoryOption[]
}

export interface ProducerOption {
  id: string
  name: string
  slug: string
  isPublished: boolean
}

/**
 * Producers an administrator can attach a product to. Unpublished producers are
 * included — a product is often prepared before its producer profile goes live —
 * and the form marks them so the choice is deliberate.
 */
export async function loadProducers(supabase: SupabaseClient): Promise<ProducerOption[]> {
  const { data, error } = await supabase
    .from("producers")
    .select("id, name, slug, is_published")
    .order("name")
  if (error) {
    logQueryError("products:producers", error)
    return []
  }
  return (data ?? []).map((row) => {
    const producer = row as { id: string; name: string; slug: string; is_published: boolean }
    return {
      id: producer.id,
      name: producer.name,
      slug: producer.slug,
      isPublished: producer.is_published,
    }
  })
}

export interface ProductDetail {
  id: string
  slug: string
  name: string
  categoryId: string
  description: string
  shortDescription: string
  basePrice: number
  originalPrice: number | null
  mainImageUrl: string
  origin: string | null
  productionMethod: string | null
  shelfLife: string | null
  storageConditions: string | null
  certifications: string | null
  isActive: boolean
  isFeatured: boolean
  lowStockThreshold: number
  displayOrder: number
  seoTitle: string | null
  seoDescription: string | null
  source: ProductSource
  certification: ProductCertification
  producerId: string | null
  harvestYear: number | null
  lotCode: string | null
  variety: string | null
  rootstock: string | null
  processing: string | null
  allergens: string | null
  netWeight: string | null
  createdAt: string
  updatedAt: string
  ratingAvg: number
  ratingCount: number
  variants: {
    id: string
    label: string
    price: number
    stockQuantity: number
    sku: string | null
  }[]
  images: {
    id: string
    imageUrl: string
    altText: string | null
    sortOrder: number
    storagePath: string | null
  }[]
  nutrition: {
    calories: string | null
    protein: string | null
    carbohydrates: string | null
    fat: string | null
    fiber: string | null
    sodium: string | null
  } | null
}

/**
 * Built from the shared column list rather than typed out again, so a column
 * the editor writes cannot be missing here — that mismatch is invisible until
 * an operator saves a field and reloads to find the old value.
 */
const DETAIL_SELECT = `
  ${PRODUCT_READ_COLUMNS.join(", ")},
  product_variants(id, label, price, stock_quantity, sku),
  product_images(id, image_url, alt_text, sort_order, storage_path),
  nutrition_facts(calories, protein, carbohydrates, fat, fiber, sodium)
`

export async function loadProductDetail(
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .eq("id", productId)
    .maybeSingle()

  if (error) {
    logQueryError("products:detail", error)
    return null
  }
  if (!data) return null

  type Raw = {
    id: string
    slug: string
    name: string
    category_id: string
    description: string
    short_description: string
    base_price: number | string
    original_price: number | string | null
    main_image_url: string
    origin: string | null
    production_method: string | null
    shelf_life: string | null
    storage_conditions: string | null
    certifications: string | null
    is_active: boolean
    is_featured: boolean
    low_stock_threshold: number
    display_order: number
    seo_title: string | null
    seo_description: string | null
    source: ProductSource
    certification: ProductCertification
    producer_id: string | null
    harvest_year: number | null
    lot_code: string | null
    variety: string | null
    rootstock: string | null
    processing: string | null
    allergens: string | null
    net_weight: string | null
    created_at: string
    updated_at: string
    rating_avg: number | string
    rating_count: number
    product_variants: {
      id: string
      label: string
      price: number | string
      stock_quantity: number
      sku: string | null
    }[]
    product_images: {
      id: string
      image_url: string
      alt_text: string | null
      sort_order: number
      storage_path: string | null
    }[]
    nutrition_facts: ProductDetail["nutrition"]
  }

  const row = data as unknown as Raw

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categoryId: row.category_id,
    description: row.description,
    shortDescription: row.short_description,
    basePrice: toNumber(row.base_price),
    originalPrice: row.original_price === null ? null : toNumber(row.original_price),
    mainImageUrl: row.main_image_url,
    origin: row.origin,
    productionMethod: row.production_method,
    shelfLife: row.shelf_life,
    storageConditions: row.storage_conditions,
    certifications: row.certifications,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    lowStockThreshold: row.low_stock_threshold,
    displayOrder: row.display_order,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    source: row.source,
    certification: row.certification,
    producerId: row.producer_id,
    harvestYear: row.harvest_year,
    lotCode: row.lot_code,
    variety: row.variety,
    rootstock: row.rootstock,
    processing: row.processing,
    allergens: row.allergens,
    netWeight: row.net_weight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ratingAvg: toNumber(row.rating_avg),
    ratingCount: row.rating_count,
    variants: (row.product_variants ?? [])
      .map((v) => ({
        id: v.id,
        label: v.label,
        price: toNumber(v.price),
        stockQuantity: v.stock_quantity,
        sku: v.sku,
      }))
      .sort((a, b) => a.price - b.price),
    images: (row.product_images ?? [])
      .map((i) => ({
        id: i.id,
        imageUrl: i.image_url,
        altText: i.alt_text,
        sortOrder: i.sort_order,
        storagePath: i.storage_path,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    nutrition: row.nutrition_facts ?? null,
  }
}

/** How many order lines reference this product — decides archive vs delete. */
export async function countOrderReferences(
  supabase: SupabaseClient,
  productId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
  if (error) {
    logQueryError("products:orderReferences", error)
    // Fail closed: if the count is unknown, treat the product as referenced so
    // deletion is refused rather than silently allowed.
    return 1
  }
  return count ?? 0
}
