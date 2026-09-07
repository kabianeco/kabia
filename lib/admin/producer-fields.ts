import type { ProducerInput } from "@/lib/admin/schemas"

/**
 * The producer editor's column contract, in one place.
 *
 * Same invariant as `lib/admin/product-fields.ts`: a field has to exist in
 * four places to work — the form renders it, the Zod schema keeps it, the
 * save payload writes it, and the detail select reads it back. A field
 * present in three of the four fails silently.
 *
 * Pure module: no Supabase, no Next, no `server-only`, so the contract itself
 * is testable.
 */

/**
 * `producers` columns that are NOT NULL with **no database default**. An
 * insert omitting any of these fails with 23502.
 *
 * Sources: 20260805000000_kabia_taxonomy.sql (`slug`, `name`) and
 * 20260908000000_producers_source_desc_sort_order.sql, which added `source`
 * nullable, backfilled it, then set NOT NULL without ever giving it a
 * default. `is_published` and `sort_order` are deliberately absent: their
 * defaults (`false`, `0`) cover an insert that omits them — which is why the
 * editor writes them anyway, so what the operator sees is what is stored.
 */
export const PRODUCER_REQUIRED_ON_INSERT = ["slug", "name", "source"] as const

/** Every column the save action writes. */
export const PRODUCER_WRITE_COLUMNS = [
  "name",
  "slug",
  "source",
  "tagline",
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
] as const

/**
 * Every column the editor reads back: everything it writes, plus the ones the
 * database owns and the screen displays.
 */
export const PRODUCER_READ_COLUMNS = ["id", ...PRODUCER_WRITE_COLUMNS, "created_at"] as const

export type ProducerWriteColumn = (typeof PRODUCER_WRITE_COLUMNS)[number]
export type ProducerRowWrite = Record<ProducerWriteColumn, unknown>

/**
 * The `producers` row the save action writes, built from validated input.
 *
 * Extracted from the action so the column coverage can be asserted without a
 * database or an admin session.
 */
export function buildProducerRow(input: ProducerInput): ProducerRowWrite {
  return {
    name: input.name,
    slug: input.slug,
    source: input.source,
    tagline: input.tagline,
    region: input.region ?? null,
    product_type: input.product_type ?? null,
    photo_url: input.photo_url ?? null,
    story: input.story ?? null,
    production_place: input.production_place ?? null,
    method: input.method ?? null,
    inputs: input.inputs ?? null,
    certificates: input.certificates ?? null,
    why_selected: input.why_selected ?? null,
    is_published: input.is_published,
    sort_order: input.sort_order,
  }
}
