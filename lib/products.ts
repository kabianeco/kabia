// Product catalog type definitions + pure UI helpers.
// Catalog DATA now lives in Supabase (see lib/catalog.ts). This file keeps the
// shared TypeScript interfaces and the formatTL / category-label helpers used
// across the UI. No mock business data remains here.

export type ProductCategory =
  // Kabia Çiftliği — organik (ana)
  | "kabia-ciftligi"
  | "cig-badem"
  | "kavrulmus"
  | "badem-unu"
  | "badem-ezmesi"
  | "kabuklu-badem"
  // Kabia Seçki — dost üretici
  | "kabia-secki"
  | "ceviz"
  | "findik"
  | "bal"
  | "ihlamur"
  // Kabia Mutfak — dost üretici mutfak
  | "kabia-mutfak"
  | "salca"
  | "sirke"
  | "eriste"
  | "tarhana"
  | "paketli-urunler"

export const CORRIDORS = {
 ciftlik: {
 id: "kabia-ciftligi",
 label: "Kabia Çiftliği",
 badge: "ORGANİK",
 description: "Biz ürettik, 946 ağaç",
 categories: ["kabia-ciftligi", "cig-badem", "kavrulmus", "badem-unu", "badem-ezmesi", "kabuklu-badem"] as ProductCategory[],
 },
  secki: {
  id: "kabia-secki",
  label: "Kabia Seçki",
  badge: "DOĞAL",
  description: "Dost üreticiden seçtik",
  categories: ["kabia-secki", "ceviz", "findik", "bal", "ihlamur"] as ProductCategory[],
  },
 mutfak: {
 id: "kabia-mutfak",
 label: "Kabia Mutfak",
 badge: "DOĞAL",
 description: "Mutfak — hikayesini biliyoruz",
 categories: ["kabia-mutfak", "salca", "sirke", "eriste", "tarhana", "paketli-urunler"] as ProductCategory[],
 },
} as const;

export function corridorForCategory(cat: ProductCategory): string | null {
 for (const [key, corr] of Object.entries(CORRIDORS) as [string, (typeof CORRIDORS)[keyof typeof CORRIDORS]][]) {
 if ((corr.categories as readonly string[]).includes(cat)) return key;
 }
 return null;
}

// UI label config — DB categories.slug ile eşleşir
export const CATEGORIES: { id: ProductCategory | "tumu"; label: string }[] = [
 { id: "tumu", label: "Tümü" },
 { id: "kabia-ciftligi", label: "Kabia Çiftliği" },
 { id: "kabuklu-badem", label: "Kabuklu Badem" },
 { id: "cig-badem", label: "Çiğ Badem" },
 { id: "kavrulmus", label: "Kavrulmuş" },
 { id: "badem-unu", label: "Badem Unu" },
 { id: "badem-ezmesi", label: "Badem Ezmesi" },
  { id: "kabia-secki", label: "Kabia Seçki" },
  { id: "ceviz", label: "Ceviz" },
  { id: "findik", label: "Fındık" },
  { id: "bal", label: "Bal" },
  { id: "ihlamur", label: "Ihlamur" },
 { id: "kabia-mutfak", label: "Kabia Mutfak" },
 { id: "salca", label: "Salça" },
 { id: "sirke", label: "Sirke" },
 { id: "eriste", label: "Erişte" },
 { id: "tarhana", label: "Tarhana" },
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
