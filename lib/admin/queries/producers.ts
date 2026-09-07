import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"
import { toNumber } from "@/lib/admin/format"
import type { ProductSource } from "@/lib/products"

/**
 * Producer list and detail reads for the admin screen.
 *
 * Producers are flat — one table, no variants or gallery — so the list is a
 * single bounded select with a product count, and the detail is one row.
 * Errors degrade to empty states, never throws: the screen renders "nothing
 * here" rather than failing, the same convention as the categories screen.
 */

export interface ProducerListRow {
  id: string
  slug: string
  name: string
  source: ProductSource | null
  desc: string | null
  region: string | null
  productType: string | null
  isPublished: boolean
  sortOrder: number
  productCount: number
  createdAt: string
}

export async function loadProducerList(supabase: SupabaseClient): Promise<ProducerListRow[]> {
  const { data, error } = await supabase
    .from("producers")
    .select("id, slug, name, source, desc, region, product_type, is_published, sort_order, created_at, products(count)")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) {
    logQueryError("producers:list", error)
    return []
  }

  type Row = {
    id: string
    slug: string
    name: string
    source: ProductSource | null
    desc: string | null
    region: string | null
    product_type: string | null
    is_published: boolean
    sort_order: number
    created_at: string
    products: { count: number }[]
  }

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    source: row.source,
    desc: row.desc,
    region: row.region,
    productType: row.product_type,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
    productCount: row.products?.[0]?.count ?? 0,
    createdAt: row.created_at,
  }))
}

export interface ProducerDetail {
  id: string
  slug: string
  name: string
  source: ProductSource
  desc: string
  region: string | null
  productType: string | null
  photoUrl: string | null
  story: string | null
  productionPlace: string | null
  method: string | null
  inputs: string | null
  certificates: string | null
  whySelected: string | null
  isPublished: boolean
  sortOrder: number
  createdAt: string
}

const DETAIL_SELECT = [
  "id",
  "slug",
  "name",
  "source",
  "desc",
  "region",
  "product_type",
  "photo_url",
  "story",
  "production_place",
  "method",
  "inputs",
  "certificates",
  "why_selected",
  "is_published",
  "sort_order",
  "created_at",
].join(", ")

export async function loadProducerDetail(
  supabase: SupabaseClient,
  producerId: string,
): Promise<ProducerDetail | null> {
  const { data, error } = await supabase
    .from("producers")
    .select(DETAIL_SELECT)
    .eq("id", producerId)
    .maybeSingle()

  if (error) {
    logQueryError("producers:detail", error)
    return null
  }
  if (!data) return null

  type Raw = {
    id: string
    slug: string
    name: string
    source: ProductSource
    desc: string
    region: string | null
    product_type: string | null
    photo_url: string | null
    story: string | null
    production_place: string | null
    method: string | null
    inputs: string | null
    certificates: string | null
    why_selected: string | null
    is_published: boolean
    sort_order: number | string
    created_at: string
  }

  const row = data as unknown as Raw

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    source: row.source,
    desc: row.desc,
    region: row.region,
    productType: row.product_type,
    photoUrl: row.photo_url,
    story: row.story,
    productionPlace: row.production_place,
    method: row.method,
    inputs: row.inputs,
    certificates: row.certificates,
    whySelected: row.why_selected,
    isPublished: row.is_published,
    sortOrder: toNumber(row.sort_order),
    createdAt: row.created_at,
  }
}

/** How many products point at this producer — decides delete vs refuse. */
export async function countProducerProductReferences(
  supabase: SupabaseClient,
  producerId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("producer_id", producerId)
  if (error) {
    logQueryError("producers:productReferences", error)
    // Fail closed: if the count is unknown, treat the producer as referenced
    // so deletion is refused rather than silently allowed.
    return 1
  }
  return count ?? 0
}

export interface ProducerProductRow {
  id: string
  slug: string
  name: string
  basePrice: number
  isActive: boolean
}

/** The producer's own products, inline on the edit screen (Phase 3 shape). */
export async function loadProducerProducts(
  supabase: SupabaseClient,
  producerId: string,
): Promise<ProducerProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, base_price, is_active")
    .eq("producer_id", producerId)
    .order("name")

  if (error) {
    logQueryError("producers:products", error)
    return []
  }

  type Row = {
    id: string
    slug: string
    name: string
    base_price: number | string
    is_active: boolean
  }

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    basePrice: toNumber(row.base_price),
    isActive: row.is_active,
  }))
}
