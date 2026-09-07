import {
  ALL_CATEGORIES,
  ALL_CATEGORIES_LABEL,
  SOURCES,
  type CategoryOption,
  type Product,
} from "@/lib/products";
import { orderOf } from "@/lib/shop-badges";

export const SORT_OPTIONS = [
  { id: "onerilen", label: "Varsayılan" },
  { id: "fiyat-artan", label: "Fiyat: artan" },
  { id: "fiyat-azalan", label: "Fiyat: azalan" },
] as const;

export function selectProducts(
  products: readonly Product[],
  category: string,
  source: string,
  sort: string,
): Product[] {
  const filtered = products.filter(
    (p) =>
      (category === ALL_CATEGORIES || category === p.category) &&
      (source === ALL_CATEGORIES || source === p.source),
  );
  if (sort === "fiyat-artan") filtered.sort((a, b) => a.price - b.price);
  else if (sort === "fiyat-azalan") filtered.sort((a, b) => b.price - a.price);
  else filtered.sort((a, b) => orderOf(a.slug) - orderOf(b.slug));
  return filtered;
}

/** The three sources, narrowed to those the current catalogue actually has. */
export function presentSources(products: readonly Product[]) {
  return SOURCES.filter(
    (source) =>
      source.id === "tumu" || products.some((p) => p.source === source.id),
  );
}

/**
 * Categories narrowed to what is present, and — once a source is chosen —
 * to what is present *within that source*, so the bar never offers a
 * combination that resolves to an empty grid.
 *
 * The options are built from the products themselves, each carrying its own
 * `categories` row, so a category an administrator adds appears here under its
 * administered name without a second query and without a code change. A product
 * whose category could not be read contributes no option rather than being
 * filed under someone else's category.
 */
export function presentCategories(
  products: readonly Product[],
  source: string,
): CategoryOption[] {
  const scope =
    source === ALL_CATEGORIES
      ? products
      : products.filter((p) => p.source === source);

  const bySlug = new Map<string, string>();
  for (const product of scope) {
    if (!product.category) continue;
    if (!bySlug.has(product.category)) {
      bySlug.set(product.category, product.categoryName || product.category);
    }
  }

  const options = [...bySlug].map(([id, label]) => ({ id, label }));
  // `categories` has no display order of its own, so the bar is sorted by the
  // administered name under Turkish collation — stable, and readable to the
  // person who named them.
  options.sort((a, b) => a.label.localeCompare(b.label, "tr"));

  return [{ id: ALL_CATEGORIES, label: ALL_CATEGORIES_LABEL }, ...options];
}

export function listingHref(
  base: string,
  category: string,
  source: string,
  sort: string,
): string {
  const params = new URLSearchParams();
  if (category !== ALL_CATEGORIES) params.set("kategori", category);
  if (source !== ALL_CATEGORIES) params.set("kaynak", source);
  if (sort !== "onerilen") params.set("sirala", sort);
  return params.size ? `${base}?${params}` : base;
}
