import type { Product } from "@/lib/products";
import { sourceProducers, type SourceProducer } from "@/content/producers";

/**
 * PREVIEW ONLY: local purchase examples, never catalog or order data.
 * Remove this file and its gated consumers after design review. Keep identity
 * guards for persisted guest carts. Names, weights, prices and stocks are
 * explicitly examples.
 */
export type PreviewProduct = Product & { producer: SourceProducer };

export const previewProducts: PreviewProduct[] = sourceProducers.map(
  (producer, index) => ({
    id: `kabia-preview:${producer.slug}`,
    slug: `onizleme-${producer.slug}`,
    name: `Örnek ${producer.productType}`,
    category: producer.source === "ciftlik" ? "cig-badem" : "paketli-urunler",
    categoryName: producer.source === "ciftlik" ? "Çiğ Badem" : "Paketli Ürünler",
    // Preview examples, not administered rows — fixed position, never curated.
    categorySortOrder: 0,
    source: producer.source,
    defaultWeight: "500 g",
    price: 100 + index * 10,
    seed: producer.slug,
    mainImageUrl: producer.photoUrl!,
    images: [producer.photoUrl!],
    variants: [
      {
        id: `kabia-preview:${producer.slug}:500g`,
        weight: "500 g",
        price: 100 + index * 10,
        stock: producer.slug === "alic-sirkesi" ? 0 : 10,
      },
    ],
    rating: 0,
    reviewCount: 0,
    ratingBreakdown: [0, 0, 0, 0, 0],
    reviews: [],
    shortDescription:
      "Önizleme ürünü — fiyat, ağırlık ve stok örnektir. Sipariş verilemez.",
    description:
      "Tasarım önizlemesi için örnek ürün. Yalnızca misafir sepetinde denenebilir.",
    seoTitle: "",
    seoDescription: "",
    origin: "",
    productionMethod: "",
    shelfLife: "",
    storage: "",
    certificates: "",
    certification:
      producer.source === "mutfak" ? "kabia_mutfak" : "kabia_secki",
    producerId: producer.id,
    producerName: producer.name,
    producerSlug: producer.slug,
    producerWhySelected: "",
    harvestYear: null,
    lotCode: "",
    variety: "",
    rootstock: "",
    processing: "",
    allergens: "",
    netWeight: "",
    nutrition: {
      kalori: "",
      protein: "",
      karbonhidrat: "",
      yag: "",
      lif: "",
      sodyum: "",
    },
    producer,
  }),
);
