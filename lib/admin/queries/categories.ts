import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"

export interface CategoryRow {
  id: string
  slug: string
  name: string
  productCount: number
}

export async function loadCategoriesWithCount(supabase: SupabaseClient): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, products(count)")
    .order("name")

  if (error) {
    logQueryError("categories:list", error)
    return []
  }

  return ((data ?? []) as { id: string; slug: string; name: string; products: { count: number }[] }[]).map(
    (row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      productCount: row.products?.[0]?.count ?? 0,
    }),
  )
}
