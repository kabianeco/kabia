import { anchors, mailto, site } from "@/lib/site";

/**
 * All visible homepage copy lives here, in Turkish.
 * Facts are limited to what the existing Kabia project states:
 * ecological cultivation without chemical fertilizer or pesticide,
 * additive-free products, local production in Geyve/Sakarya, and the
 * product names listed on the current site.
 */

/**
 * The 4-act scroll intro. Act 1: headline + CTAs beside the almond.
 * Acts 2/3: two distinct editorial beats — the almond crosses the stage
 * in front of the text and carries the old message into the new one.
 * Act 4: the shell opens and a hidden paper note unfolds from inside it.
 */
export const intro = {
  act1: {
    eyebrow: `Kabia Ekolojik — ${site.region}`,
    /* Serif italic is applied to the second line in the component. */
    headlineA: "Kendi bahçemizden,",
    headlineB: "ekolojik badem.",
    supporting:
      "Kabia, Sakarya Geyve'deki bahçelerinde kimyasal gübre ve ilaç kullanmadan badem yetiştiriyor. Hasat, katkı maddesi olmadan hazırlanıp sofranıza ulaşıyor.",
    primaryCta: { label: "Ürünleri İncele", href: anchors.products },
    secondaryCta: { label: "Çiftliği tanıyın", href: anchors.farm },
  },
  /* First editorial beat, set in the secondary (serif italic) voice. */
  act2: {
    kicker: "Kabuğun altında",
    text: "Bir bademin iyi olması için bahçede başlayan özenin sofraya kadar sürmesi gerekir. Kabia bu zinciri kendi elinde tutar: yetiştirir, kurutur, hazırlar.",
  },
  /* Second editorial beat — more reflective, about time and patience. */
  act3: {
    kicker: "Zamanla olgunlaşır",
    text: "İyi badem, zamana gösterilen saygıyla oluşur. Dalda olgunlaşmayı, güneşte kurumayı, sırasını beklemeyi ister. Lezzet, acele edilmeden kurulan bir sürecin sonucudur.",
  },
  final: {
    /* Broken into two lines for the controlled full-screen setting. */
    statementA: "Badem",
    statementB: "gelmez.",
    ctaLabel: "Keşfet",
  },
  /** Read by screen readers in place of the decorative 3D scene. */
  sceneDescription:
    "Dekoratif üç boyutlu badem: sayfa kaydırıldıkça sahnede yer değiştirir, sonunda kabuğu ortadan ikiye açılır ve içine saklanmış kırışık bir kâğıt not açılarak mesajı ortaya çıkarır.",
  /** Brand word shown during the transition to the store. */
  transitionWord: "kabia",
  transitionAnnouncement: "kabia — mağazaya yönlendiriliyorsunuz",
} as const;

export const manifesto = {
  statementA: "Badem gelmez;",
  statementB: "biz de acele etmiyoruz.",
  body: "Kabia Ekolojik, Geyve'nin dağ köyü Sabırlar'da badem yetiştirir. Bahçeye kimyasal gübre ve ilaç girmez; ürüne katkı maddesi eklenmez. Az ama iyi üretmeyi tercih ediyoruz.",
} as const;

/**
 * Section framing only. The rows themselves are the live catalogue, read from
 * Supabase by components/home/product-collection.tsx.
 */
export const products = {
  title: "Ürünler",
  intro:
    "Tek kaynak: Geyve'deki bahçelerimiz. Öne çıkan ürünler aşağıda; tamamı mağazada.",
} as const;

export const origin = {
  title: "Çiftlik",
  eyebrow: "Sabırlar Köyü — Geyve, Sakarya",
  body: [
    "Bahçelerimiz Sakarya'nın Geyve ilçesinde, Sabırlar köyünün yamaçlarında. Badem burada dört mevsimi de görür: baharda çiçek, yazda yeşil kabuk, sonbaharda hasat, kışta uyku.",
    "Üretimi başkasına devretmiyoruz. Ağaçların bakımı, hasat ve kurutma bizim elimizden geçer; bölge çiftçileriyle birlikte çalışırız.",
  ],
  images: [
    {
      src: "/images/orchard-hillside.jpg",
      width: 2047,
      height: 2048,
      alt: "Geyve sırtlarında genç badem bahçesi, arkada vadi ve dağlar",
      caption: "Genç bahçe, Geyve sırtları. Ağaçlar vadiye bakar.",
    },
    {
      src: "/images/field-tractor.jpg",
      width: 1200,
      height: 1600,
      alt: "Badem bahçesinde traktör, arkada sisli dağlar",
      caption: "Bahçe bakımı bize ait; işi yerinde, kendi makinemizle yaparız.",
    },
    {
      src: "/images/orchard-winter.jpg",
      width: 2048,
      height: 2048,
      alt: "Kar altındaki genç badem ağaçları ve bulutlu vadi",
      caption: "Kış. Bahçe uykuda, ağaçlar dinlenir.",
    },
  ],
} as const;

export const process = {
  title: "Bahçeden sofraya",
  intro:
    "Bir Kabia bademi sofraya altı adımda gelir. Her adım aynı elden geçer.",
  steps: [
    {
      name: "Bahçe",
      description:
        "Ağaçlar Geyve'nin yamaçlarında, kimyasal gübre ve ilaç kullanılmadan büyür.",
    },
    {
      name: "Hasat",
      description: "Yeşil kabuk çatlayınca badem toplanmaya hazırdır.",
    },
    {
      name: "Ayıklama",
      description: "Yeşil dış kabuk ayrılır; bademler tek tek gözden geçer.",
    },
    {
      name: "Kurutma",
      description: "Bademler sert kabuğunda, kendi halinde kurumaya bırakılır.",
    },
    {
      name: "Hazırlık",
      description:
        "Çiğ, kavrulmuş ya da ezme — hangi ürün olacaksa katkısız hazırlanır.",
    },
    {
      name: "Sofra",
      description: "Badem, bahçeden çıktığı haliyle size ulaşır.",
    },
  ],
} as const;

export const principles = {
  title: "Yaklaşım",
  items: [
    {
      name: "Kimyasalsız bahçe",
      description:
        "Bahçede kimyasal gübre ve ilaç kullanmıyoruz. Ekolojik tarım bizim için bir etiket değil, çalışma biçimi.",
    },
    {
      name: "Katkısız ürün",
      description:
        "Ürünlerimize katkı maddesi girmez. Bademin tadı, bademin tadıdır.",
    },
    {
      name: "Yerinde üretim",
      description:
        "Geyve'de üretiyor, bölge çiftçileriyle birlikte çalışıyoruz. Üretim yerinden kopmaz.",
    },
  ],
} as const;

export const editorialImage = {
  src: "/images/almonds-drying.jpg",
  width: 2200,
  height: 1466,
  alt: "Hasat edilmiş kabuklu bademler, sepetin yanında yığın halinde kuruyor",
  caption: "Hasat sonrası. Bademler kabuğunda, kendi halinde kurur.",
} as const;

/**
 * Verbatim brand statement carried over from the existing Kabia site's
 * about section — not a fabricated testimonial.
 */
export const quote = {
  text: "Doğanın bize sunduğu en değerli hediyelerden biri olan bademi, en saf ve doğal haliyle sizlere ulaştırıyoruz.",
  attribution: "Kabia Ekolojik",
  context: "Kuruluş metninden",
} as const;

export const finalCta = {
  titleA: "Bu hasadın bademini",
  titleB: "birlikte tadalım.",
  body: "Satış kanalımız hazırlanıyor. Sipariş ve sorularınız için bize yazın; hasat takvimimizi paylaşalım.",
  cta: { label: "Bize Yazın", href: mailto("Kabia — sipariş ve bilgi") },
  image: {
    src: "/images/almonds-net.jpg",
    alt: "File içinde kabuklu Kabia bademleri",
  },
} as const;
