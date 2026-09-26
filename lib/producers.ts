import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProducerRow } from "@/lib/supabase/rows"
import type { ProductSource } from "@/lib/products"

const PRODUCER_SELECT =
  "id, slug, name, source, tagline, sort_order, product_type, region, photo_url, story, production_place, method, inputs, certificates, why_selected, is_published, created_at"

export interface Producer {
  id: string
  slug: string
  name: string
  /** Which of the three lines this producer belongs to; drives /secki membership. */
  source: ProductSource | null
  /** One-line card copy under the name. */
  tagline: string | null
  /** Curated display order, ascending. */
  sortOrder: number
  productType: string | null
  region: string | null
  photoUrl: string | null
  story: string | null
  productionPlace: string | null
  method: string | null
  inputs: string | null
  certificates: string | null
  whySelected: string | null
  createdAt: string
}

function mapProducer(row: ProducerRow): Producer {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    source: (row.source as ProductSource | null) ?? null,
    tagline: row.tagline,
    sortOrder: row.sort_order ?? 0,
    productType: row.product_type,
    region: row.region,
    photoUrl: row.photo_url,
    story: row.story,
    productionPlace: row.production_place,
    method: row.method,
    inputs: row.inputs,
    certificates: row.certificates,
    whySelected: row.why_selected,
    createdAt: row.created_at,
  }
}

/**
 * A producer story is stored exactly as authored — plain text, paragraphs
 * separated by a blank line, the same convention `content/producers.ts` used.
 * The database keeps no markup, so no paragraph can arrive broken by an
 * editor that half-escaped it; the split happens at render, in one place.
 *
 * A single newline inside a paragraph is left alone (it renders as a space,
 * as it always has). Only blank-line runs start a new paragraph, and empty
 * runs from leading/trailing blank lines are dropped rather than rendered
 * as empty `<p>` elements.
 */
export function splitStoryParagraphs(story: string | null): string[] {
  if (!story) return []
  return story
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
}

export type PublicProducersResult =
  | { status: "ok"; producers: Producer[] }
  | { status: "error" }

/**
 * Every published producer in curated order — the same is_published gate the
 * RLS policy enforces. `sort_order` carries the display sequence (backfilled
 * to reproduce the previous `created_at desc`), `created_at` breaks ties.
 *
 * Returns a tagged result for the same reason `fetchPublicProducts` and
 * `fetchPublishedProducerBySlug` do: "nobody has published a producer yet" and
 * "the producers table could not be read" are different facts, and only one of
 * them is something to tell a visitor. Collapsing them meant a missing table
 * rendered as a considered editorial state.
 */
export async function fetchPublicProducers(
  client: SupabaseClient,
): Promise<PublicProducersResult> {
  const { data, error } = await client
    .from("producers")
    .select(PRODUCER_SELECT)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error || !data) return { status: "error" }
  return { status: "ok", producers: (data as unknown as ProducerRow[]).map(mapProducer) }
}

/**
 * One line (secki or mutfak) in curated order. Same honest-error contract as
 * `fetchPublicProducers`: a failed read is an outage, never an empty shelf.
 */
export async function fetchProducersBySource(
  client: SupabaseClient,
  source: ProductSource,
): Promise<PublicProducersResult> {
  const { data, error } = await client
    .from("producers")
    .select(PRODUCER_SELECT)
    .eq("is_published", true)
    .eq("source", source)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error || !data) return { status: "error" }
  return { status: "ok", producers: (data as unknown as ProducerRow[]).map(mapProducer) }
}

/**
 * The Seçki line in curated order. Same honest-error contract as
 * `fetchPublicProducers`: a failed read is an outage, never an empty shelf.
 */
export async function fetchSeckiProducers(
  client: SupabaseClient,
): Promise<PublicProducersResult> {
  const { data, error } = await client
    .from("producers")
    .select(PRODUCER_SELECT)
    .eq("is_published", true)
    .eq("source", "secki")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error || !data) return { status: "error" }
  return { status: "ok", producers: (data as unknown as ProducerRow[]).map(mapProducer) }
}

export type ProducerBySlugResult =
  | { status: "ok"; producer: Producer }
  | { status: "not_found" }
  | { status: "error" }

/** Distinguishes "no such producer" from "the database could not be read". */
export async function fetchPublishedProducerBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<ProducerBySlugResult> {
  const { data, error } = await client
    .from("producers")
    .select(PRODUCER_SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "not_found" }
  return { status: "ok", producer: mapProducer(data as unknown as ProducerRow) }
}
