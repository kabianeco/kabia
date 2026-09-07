import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"

export interface CategoryRow {
  id: string
  slug: string
  name: string
  sortOrder: number
  productCount: number
}

export async function loadCategoriesWithCount(supabase: SupabaseClient): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, sort_order, products(count)")
    .order("sort_order", { ascending: true })
    .order("name")

  if (error) {
    logQueryError("categories:list", error)
    return []
  }

  return ((data ?? []) as { id: string; slug: string; name: string; sort_order: number; products: { count: number }[] }[]).map(
    (row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
      productCount: row.products?.[0]?.count ?? 0,
    }),
  )
}
