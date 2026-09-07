// Product catalog type definitions + pure UI helpers.
// Catalog DATA now lives in Supabase (see lib/catalog.ts). This file keeps the
// shared TypeScript interfaces and the formatTL / source-label helpers used
// across the UI. No mock business data remains here.

/**
 * A product's category is whatever the `categories` table says it is: the row's
 * slug for filtering, its name for display.
 *
 * There is deliberately no hardcoded list here any more. There used to be one,
 * and because an administrator can create categories freely, anything outside
 * those five slugs was silently relabelled as "Çiğ Badem" — which put a wrong
 * category next to a correct source on every card. The vocabulary now has one
 * home, the one an administrator can actually edit.
 *
 * "Tümü" is the only category label that stays in code: it is a UI affordance
 * meaning "no filter", not a category any product belongs to.
 */
export const ALL_CATEGORIES = "tumu"
export const ALL_CATEGORIES_LABEL = "Tümü"

export interface CategoryOption {
  id: string
  label: string
}

/** Which of Kabia's three product lines this belongs to. */
export const PRODUCT_SOURCES = ["ciftlik", "secki", "mutfak"] as const
export type ProductSource = (typeof PRODUCT_SOURCES)[number]

// UI label config — the matching `products.source` values are the enum
// public.product_source ('ciftlik' | 'secki' | 'mutfak').
export const SOURCES: { id: ProductSource | "tumu"; label: string; badgeLabel: string }[] = [
  { id: "tumu", label: "Tümü", badgeLabel: "" },
  { id: "ciftlik", label: "Çiftlik", badgeLabel: "Kabia Çiftliği" },
  { id: "secki", label: "Seçki", badgeLabel: "Kabia Seçki" },
  { id: "mutfak", label: "Mutfak", badgeLabel: "Kabia Mutfak" },
]

export function sourceBadgeLabel(id: ProductSource) {
  return SOURCES.find((s) => s.id === id)?.badgeLabel ?? id
}

/**
 * The metadata line under a product card and beside the detail gallery —
 * "Çiğ Badem • Kabia Çiftliği". Since a82a52a this is where the source lives,
 * so it is also where a wrong category would be read next to a right source.
 *
 * A product whose category could not be read shows its source alone, rather
 * than an empty segment and a dangling separator.
 */
export function productMetaLine(
  product: Pick<Product, "categoryName" | "source">,
): string {
  return [product.categoryName, sourceBadgeLabel(product.source)]
    .filter((part) => part !== "")
    .join(" • ")
}

/**
 * Legal-weight label — see the Phase 2 migration comment on
 * `products.certification`. `organik_sertifikali` asserts a real organic
 * certificate; the other two express Kabia's own selection approach and must
 * never be described using the word "organik".
 */
export const PRODUCT_CERTIFICATIONS = [
  "organik_sertifikali",
  "kabia_secki",
  "kabia_mutfak",
] as const
export type ProductCertification = (typeof PRODUCT_CERTIFICATIONS)[number]

export const CERTIFICATION_LABEL: Record<ProductCertification, string> = {
  organik_sertifikali: "Organik Sertifikalı",
  kabia_secki: "Kabia Seçki",
  kabia_mutfak: "Kabia Mutfak",
}

/** Whether this certification value may be described as organic anywhere in the UI. */
export function isOrganicCertified(certification: ProductCertification): boolean {
  return certification === "organik_sertifikali"
}

export interface ProductVariant {
  id: string
  weight: string
  price: number
  /** `product_variants.stock_quantity`; 0 means the size cannot be ordered. */
  stock: number
}

export interface NutritionInfo {
  kalori: string
  protein: string
  karbonhidrat: string
  yag: string
  lif: string
  sodyum: string
}

export interface ProductReview {
  name: string
  avatarSeed: number
  date: string
  rating: number
  text: string
  verified: boolean
}

export interface Product {
  id: string
  slug: string
  name: string
  /** `categories.slug`; "" when the category row could not be read. */
  category: string
  /** `categories.name` — the administered display label. */
  categoryName: string
  /** `categories.sort_order` — the curated filter-bar position. */
  categorySortOrder: number
  source: ProductSource
  defaultWeight: string
  price: number
  originalPrice?: number
  seed: string
  mainImageUrl: string
  images: string[]
  variants: ProductVariant[]
  rating: number
  reviewCount: number
  ratingBreakdown: [number, number, number, number, number]
  shortDescription: string
  description: string
  origin: string
  productionMethod: string
  shelfLife: string
  storage: string
  certificates: string
  certification: ProductCertification
  producerId: string | null
  producerName: string
  producerSlug: string
  producerWhySelected: string
  harvestYear: number | null
  lotCode: string
  variety: string
  rootstock: string
  processing: string
  allergens: string
  netWeight: string
  nutrition: NutritionInfo
  reviews: ProductReview[]
}

/** A product is orderable while any of its sizes still has stock. */
export function inStock(product: Pick<Product, "variants">): boolean {
  return product.variants.some((v) => v.stock > 0)
}

export function formatTL(amount: number): string {
  return `₺${amount.toFixed(2).replace(".", ",")}`
}
