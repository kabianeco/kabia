import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProducerRow } from "@/lib/supabase/rows"

const PRODUCER_SELECT =
  "id, slug, name, product_type, region, photo_url, story, production_place, method, inputs, certificates, why_selected, is_published, created_at"

export interface Producer {
  id: string
  slug: string
  name: string
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

export type PublicProducersResult =
  | { status: "ok"; producers: Producer[] }
  | { status: "error" }

/**
 * Every published producer, newest first — the same is_published gate the RLS
 * policy enforces.
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
