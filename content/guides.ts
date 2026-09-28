/**
 * The /rehber guides: their metadata and the few connecting sentences they add.
 *
 * Every fact on a guide page is rendered from its own source rather than
 * restated here — the timeline and principles from content/farm.ts, the
 * certificate from content/farm.ts `farmCertificate` (the one place it may be
 * stated, so a renewal flows through), the selection criteria from
 * content/kabia-standard.ts, and producer, product, storage and shelf-life
 * details from the live `products` and `producers` rows. The strings below
 * only name and connect those; each is traced in the SEO/perf pass's
 * CONTENT-SOURCES.md.
 */

export interface Guide {
  slug: string
  /** Visible label above the H1. */
  eyebrow: string
  /** The H1: plain part and the italic display part, as the story pages set it. */
  heading: [plain: string, display: string, tail: string]
  /** <title> (the layout appends the store name). */
  metaTitle: string
  description: string
  /** First publication; guides have no separate edit date until one is set. */
  datePublished: string
  keywords: string[]
}

export const guidesHub = {
  eyebrow: "Rehber",
  heading: ["Kabia ", "rehberi", "."] as [string, string, string],
  metaTitle: "Rehber — Badem Bahçesi, Üretici Seçimi, Saklama",
  intro:
    "Bahçemizi, üreticilerimizi nasıl seçtiğimizi ve ürünlerimizi nasıl saklayacağınızı anlatan sayfalar.",
  description:
    "Geyve'deki badem bahçemizin hikâyesi, üreticilerimizi nasıl seçtiğimiz (Kabia Standardı) ve ürünlerimizin saklama koşulları ile raf ömrü.",
} as const

export const guides: readonly Guide[] = [
  {
    slug: "geyve-badem-bahcesi",
    eyebrow: "Sabırlar Köyü — Geyve, Sakarya",
    heading: ["Geyve'de bir ", "badem bahçesi", "."],
    metaTitle: "Geyve'de Bir Badem Bahçesi — 946 Marinada Ağacı",
    description:
      "Sabırlar'da 19 dönüm, 946 Marinada badem ağacı: 2019'da başlayan, 2021'de dikilen bahçenin yıl yıl hikâyesi, toprak yaklaşımı ve hasat notları.",
    datePublished: "2026-09-28",
    keywords: ["Geyve badem", "Marinada badem", "badem bahçesi", "badem hasadı", "Sabırlar Geyve"],
  },
  {
    slug: "uretici-secimi",
    eyebrow: "Kabia Standardı",
    heading: ["Üreticilerimizi ", "nasıl seçiyoruz", "?"],
    metaTitle: "Üreticilerimizi Nasıl Seçiyoruz — Kabia Standardı",
    description:
      "Kabia Standardı: yedi seçim ölçütü, hangi ürünün hangi üreticiden ve nereden geldiği, Seçki, Mutfak ve organik etiketlerinin ne anlama geldiği.",
    datePublished: "2026-09-28",
    keywords: ["Kabia Standardı", "küçük üretici", "katkısız gıda", "organik ile doğal arasındaki fark"],
  },
  {
    slug: "saklama",
    eyebrow: "Saklama ve raf ömrü",
    heading: ["Ürünlerimizi ", "nasıl saklarsınız", "?"],
    metaTitle: "Badem, Bal, Tarhana Nasıl Saklanır — Saklama ve Raf Ömrü",
    description:
      "Kabuklu badem, fındık, ceviz, bal, ıhlamur, salça, sirke, erişte ve tarhana: her ürünün saklama koşulu ve raf ömrü, ürün sayfasında yazanla aynı.",
    datePublished: "2026-09-28",
    keywords: ["badem nasıl saklanır", "bal nasıl saklanır", "tarhana nasıl saklanır", "raf ömrü"],
  },
]

export function guideBySlug(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug)
}

/** Connecting copy on the orchard guide. Facts come from the files cited. */
export const orchardGuideCopy = {
  facts: [
    // content/pages.ts farm.eyebrow; content/homepage.ts origin.title "Kılıçkaya’da bir bahçe."
    { title: "Nerede?", body: "Sabırlar Köyü — Geyve, Sakarya. Bahçe Kılıçkaya yamaçlarında." },
    // content/pages.ts farm.stats (19 dönüm, 946 badem ağacı); content/farm.ts "946 Marinada"
    { title: "Ne kadar?", body: "19 dönüm, 946 badem ağacı. Çeşidi Marinada." },
    // content/homepage.ts origin.body[0]; content/farm.ts farmTimeline[0].eyebrow (2021 Temmuz, 946 fidan)
    { title: "Ne zamandan beri?", body: "2019’da boş bir tarlayı dinlemeye geldik. 946 Marinada fidanı Temmuz 2021’de toprakla buluştu." },
  ],
  // app/ciftlik/page.tsx "2019 Kasım’ında … dinlemeye geldik. Bir yıl boyunca tek fidan dikmeden yalnızca toprağı gözlemledik"
  start: {
    eyebrow: "2019 KASIM — DİNLEME",
    heading: "Boş tarlayı dinlemeye geldik.",
    body: "Bir yıl boyunca tek fidan dikmeden yalnızca toprağı gözlemledik.",
  },
  timelineHeading: "Yıl yıl bahçe",
  soilHeading: "Toprağa nasıl bakıyoruz?",
  harvestHeading: "Hasat ne zaman?",
  // content/homepage.ts process.steps[1] (Hasat)
  harvestSign: "Yeşil kabuk çatlayınca badem toplanmaya hazırdır.",
  journalLead: "Bahçeden son notlar:",
  certificateLead: "Kabia Çiftliği'nin belgesi:",
  // content/homepage.ts finalCta.title
  closing: "Toprakla başlayan bir hikâye.",
} as const

/** Connecting copy on the producer-selection guide. */
export const selectionGuideCopy = {
  sourcesHeading: "Üç kaynak",
  // content/homepage.ts products.statement + source names (lib/products.ts SOURCES badge labels)
  sources: [
    { name: "Kabia Çiftliği", line: "Bizim toprağımızdan.", href: "/ciftlik" },
    { name: "Kabia Seçki", line: "Tanıdığımız üreticilerden.", href: "/secki" },
    { name: "Kabia Mutfak", line: "Üreticilerin mutfağından.", href: "/mutfak" },
  ],
  whoHeading: "Hangi ürün kimden geliyor?",
  whoLead: "Üretici ve sertifika durumu, ürün ve üretici kayıtlarında yazdığı gibi:",
  labelsHeading: "Etiketler ne anlama geliyor?",
  certificateLead: "Kabia Çiftliği'nin belgesi:",
  // content/homepage.ts intro.act1.supporting (revision brief A.9)
  closing: "Kendi çiftliğimizden ve güvendiğimiz üreticilerden.",
} as const

/** Connecting copy on the storage guide. */
export const storageGuideCopy = {
  intro:
    "Saklama koşulu ve raf ömrü, her ürünün kendi sayfasında yazanla aynıdır; ikisi de aynı ürün kaydından gelir.",
  shelfLife: "Raf ömrü",
  sizes: "Boyutlar",
  productLink: "Ürün sayfası",
  // content/homepage.ts intro.act1.headlineA + headlineB
  closing: "Toprağa saygıyla üretilenler.",
} as const
