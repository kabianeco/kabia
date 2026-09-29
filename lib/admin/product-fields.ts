import type { ProductCertification } from "@/lib/products"
import type { ProductInput } from "@/lib/admin/schemas"

/**
 * The product editor's column contract, in one place.
 *
 * A product field has to exist in four places to work: the form renders it, the
 * Zod schema keeps it, the save payload writes it, and the detail select reads
 * it back. A field present in three of the four fails silently — it either does
 * not save, or saves and then shows a stale value on reload.
 *
 * `products.certification` was present in none of them while being NOT NULL
 * with no database default, so every product creation failed with SQLSTATE
 * 23502 and the only message the operator saw was the generic "Zorunlu bir alan
 * boş bırakılamaz." with no field to point at.
 *
 * Pure module: no Supabase, no Next, no `server-only`, so the contract itself
 * is testable.
 */

/**
 * `products` columns that are NOT NULL with **no database default**. An insert
 * omitting any of these fails with 23502.
 *
 * Sources: 20260730194034_create_schema.sql (the first seven) and
 * 20260805000000_kabia_taxonomy.sql, which added `certification` nullable,
 * backfilled it, then set NOT NULL without ever giving it a default.
 *
 * `source` is deliberately absent: it is NOT NULL but the taxonomy migration
 * gave it `default 'ciftlik'`, so an insert omitting it succeeds — silently
 * filing the product under the farm, which is why the editor writes it anyway.
 */
export const PRODUCT_REQUIRED_ON_INSERT = [
  "slug",
  "name",
  "category_id",
  "description",
  "short_description",
  "base_price",
  "main_image_url",
  "certification",
] as const

/** Every column the save action writes. */
export const PRODUCT_WRITE_COLUMNS = [
  "name",
  "slug",
  "category_id",
  "short_description",
  "description",
  "base_price",
  "original_price",
  "main_image_url",
  "origin",
  "production_method",
  "shelf_life",
  "storage_conditions",
  "certifications",
  "is_active",
  "is_featured",
  "low_stock_threshold",
  "display_order",
  "seo_title",
  "seo_description",
  "source",
  "certification",
  "producer_id",
  "harvest_year",
  "lot_code",
  "variety",
  "rootstock",
  "processing",
  "allergens",
  "net_weight",
] as const

/**
 * Every column the editor reads back: everything it writes, plus the ones the
 * database owns and the screen displays.
 */
export const PRODUCT_READ_COLUMNS = [
  "id",
  ...PRODUCT_WRITE_COLUMNS,
  "created_at",
  "updated_at",
  "rating_avg",
  "rating_count",
] as const

export type ProductWriteColumn = (typeof PRODUCT_WRITE_COLUMNS)[number]
export type ProductRowWrite = Record<ProductWriteColumn, unknown>

/**
 * The `products` row the save action writes, built from validated input.
 *
 * Extracted from the action so the column coverage can be asserted without a
 * database or an admin session.
 */
export function buildProductRow(input: ProductInput): ProductRowWrite {
  return {
    name: input.name,
    slug: input.slug,
    category_id: input.category_id,
    short_description: input.short_description,
    description: input.description,
    base_price: input.base_price,
    original_price: input.original_price ?? null,
    main_image_url: input.main_image_url,
    origin: input.origin ?? null,
    production_method: input.production_method ?? null,
    shelf_life: input.shelf_life ?? null,
    storage_conditions: input.storage_conditions ?? null,
    certifications: input.certifications ?? null,
    is_active: input.is_active,
    is_featured: input.is_featured,
    low_stock_threshold: input.low_stock_threshold,
    display_order: input.display_order,
    seo_title: input.seo_title ?? null,
    seo_description: input.seo_description ?? null,
    source: input.source,
    certification: input.certification,
    producer_id: input.producer_id ?? null,
    harvest_year: input.harvest_year ?? null,
    lot_code: input.lot_code ?? null,
    variety: input.variety ?? null,
    rootstock: input.rootstock ?? null,
    processing: input.processing ?? null,
    allergens: input.allergens ?? null,
    net_weight: input.net_weight ?? null,
  }
}

/**
 * The row an UPDATE writes: everything `buildProductRow` writes except the main
 * image. On update the main image travels with the gallery through
 * admin_save_product_images, so the two can never disagree; an insert still
 * needs `main_image_url` because the column is NOT NULL.
 */
export function buildProductUpdateRow(input: ProductInput): Omit<ProductRowWrite, "main_image_url"> {
  return Object.fromEntries(
    Object.entries(buildProductRow(input)).filter(([column]) => column !== "main_image_url"),
  ) as Omit<ProductRowWrite, "main_image_url">
}

/**
 * Whether saving this product needs an explicit organic confirmation.
 *
 * `organik_sertifikali` asserts that a real organic certificate exists — the
 * taxonomy migration's own header says an administrator upgrades a product by
 * hand once one is confirmed, and the backfill deliberately never granted it.
 * So the claim is confirmed when it is *made*: on creation, or when a product
 * moves to it from another value. A product that is already organic is not
 * re-interrogated on every unrelated edit.
 *
 * The previous value is read from the database by the caller, never from the
 * submitted form, so the check cannot be skipped by a crafted request.
 */
export function requiresOrganicConfirmation(
  previous: ProductCertification | null,
  next: ProductCertification,
): boolean {
  return next === "organik_sertifikali" && previous !== "organik_sertifikali"
}

/** The message shown when the claim is made without its confirmation. */
export const ORGANIC_CONFIRMATION_MESSAGE =
  "Organik sertifikalı işaretlemek için gerçek bir organik sertifikanın bulunduğunu onaylamanız gerekir."
