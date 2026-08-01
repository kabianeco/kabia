// Product catalog type definitions + pure UI helpers.
// Catalog DATA now lives in Supabase (see lib/catalog.ts). This file keeps the
// shared TypeScript interfaces and the formatTL / category-label helpers used
// across the UI. No mock business data remains here.

export type ProductCategory =
  | "cig-badem"
  | "kavrulmus"
  | "badem-unu"
  | "badem-ezmesi"
  | "paketli-urunler"

// UI label config (not transactional business data) — the matching category
// records are seeded into the `categories` table from the same slugs.
export const CATEGORIES: { id: ProductCategory | "tumu"; label: string }[] = [
  { id: "tumu", label: "Tümü" },
  { id: "cig-badem", label: "Çiğ Badem" },
  { id: "kavrulmus", label: "Kavrulmuş" },
  { id: "badem-unu", label: "Badem Unu" },
  { id: "badem-ezmesi", label: "Badem Ezmesi" },
  { id: "paketli-urunler", label: "Paketli Ürünler" },
]

export function categoryLabel(id: ProductCategory) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id
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
  category: ProductCategory
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
