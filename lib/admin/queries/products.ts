import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"
import { toNumber } from "@/lib/admin/format"

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
} as const

export type ProductSortKey = keyof typeof PRODUCT_SORTS

export interface ProductListParams {
  q?: string
  status?: "aktif" | "arsiv"
  category?: string
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
  totalStock: number
  variantCount: number
  lowStockThreshold: number
  stockStatus: "tukendi" | "kritik" | "yeterli"
}

export interface ProductListResult {
  rows: ProductListRow[]
  total: number
  error: boolean
}

export async function loadProductList(
  supabase: SupabaseClient,
  params: ProductListParams,
): Promise<ProductListResult> {
  const from = (params.page - 1) * params.perPage
  const to = from + params.perPage - 1

  let query = supabase
    .from("admin_product_overview")
    .select(
      "id, slug, name, base_price, main_image_url, is_active, is_featured, updated_at, category_name, category_slug, total_stock, variant_count, low_stock_threshold, stock_status",
      { count: "exact" },
    )

  const q = sanitizeSearch(params.q)
  if (q.length >= 2) {
    // name, slug and every SKU on the product, in one indexed pass.
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,skus.ilike.%${q}%`)
  }
  if (params.status === "aktif") query = query.eq("is_active", true)
  if (params.status === "arsiv") query = query.eq("is_active", false)
  if (params.category) query = query.eq("category_slug", params.category)
  if (params.stock) query = query.eq("stock_status", params.stock)
  if (params.featured === "evet") query = query.eq("is_featured", true)

  const { data, error, count } = await query
    .order(PRODUCT_SORTS[params.sort], { ascending: params.dir === "asc" })
    .order("id", { ascending: true })
    .range(from, to)

  if (error) {
    logQueryError("products:list", error)
    return { rows: [], total: 0, error: true }
  }

  type Row = {
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
    total_stock: number
    variant_count: number
    low_stock_threshold: number
    stock_status: "tukendi" | "kritik" | "yeterli"
  }

  return {
    rows: ((data ?? []) as Row[]).map((row) => ({
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
      totalStock: row.total_stock,
      variantCount: row.variant_count,
      lowStockThreshold: row.low_stock_threshold,
      stockStatus: row.stock_status,
    })),
    total: count ?? 0,
    error: false,
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

const DETAIL_SELECT = `
  id, slug, name, category_id, description, short_description, base_price, original_price,
  main_image_url, origin, production_method, shelf_life, storage_conditions, certifications,
  is_active, is_featured, low_stock_threshold, display_order, seo_title, seo_description,
  created_at, updated_at, rating_avg, rating_count,
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
