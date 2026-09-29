import { anchors, site } from "@/lib/site";

/**
 * All visible homepage copy lives here, in Turkish.
 * Facts are limited to what the existing Kabia project states:
 * ecological cultivation without chemical fertilizer or pesticide,
 * additive-free products, local production in Geyve/Sakarya, the
 * product names listed on the current site, and the farm-plus-trusted-
 * producers positioning from the KABIA 2.0 brief (Appendix A).
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
    headlineA: "Toprağa saygıyla",
    headlineB: "üretilenler.",
    supporting: "Kendi çiftliğimizden ve güvendiğimiz üreticilerden.",
    primaryCta: { label: "Çiftliği keşfet", href: anchors.farm },
    secondaryCta: { label: "Seçki ve Mutfak", href: anchors.products },
  },
  /* First editorial beat, set in the secondary (serif italic) voice. */
  act2: {
    kicker: "İzini süreriz",
    text: "Kendi bahçemizde badem yetiştiririz. Bazı ürünleri, güvendiğimiz üreticilerden seçeriz. İkisinde de aynı soruyu sorarız: nasıl üretildi?",
  },
  /* Second editorial beat — more reflective, about time and patience. */
  act3: {
    kicker: "Önce üretici",
    text: "Her ürünü biz üretmiyoruz. Ama üreticisini tanırız, üretim yerini görürüz, nasıl yapıldığını sorarız. Sonra seçeriz.",
  },
  final: {
    /* Broken into two lines for the controlled full-screen setting.
       Character counts are matched closely to the lines they replace —
       this pair is revealed letter-by-letter on a fixed scroll-progress
       timeline (see intro-sequence.tsx), so length changes shift timing. */
    statementA: "Önce üretici.",
    statementB: "Sonra ürün.",
    ctaLabel: "Keşfet",
  },
  /** Brand word shown during the transition to the store. */
  transitionWord: "kabia",
  transitionAnnouncement: "kabia — üreticilerle tanışıyorsunuz",
} as const;

export const manifesto = {
  statementA: "Her ürünü biz üretmiyoruz.",
  statementB: "Neden seçtiğimizi biliyoruz.",
  body: "Kendi çiftliğimizde badem yetiştiririz. Güvendiğimiz üreticilerden seçtiğimiz ürünleri bir araya getiririz. Çok tonajlı üretim yerine toprağı yormadan üretmeyi tercih ediyoruz.",
} as const;

/**
 * The homepage introduces the three sources with one product each — it is not a
 * storefront row. Price, stock, badges and purchase controls belong to the shop
 * and the product page, never here.
 *
 * The slugs are curated rather than queried, so the section keeps the same three
 * products regardless of what the catalogue is doing. They are the verified
 * active rows: `kabuklu-badem`, `findik-ici` and `tarhana`. The name recorded
 * here is the short display name; `findik-ici` ships under the name
 * "Kabuklu Fındık", and that existing slug/name mismatch is left alone.
 */
export const products = {
  title: "Ürünler",
  statement: [
    "Bizim toprağımızdan.",
    "Tanıdığımız üreticilerden.",
    "Üreticilerin mutfağından.",
  ],
  intro:
    "Üç dünyadan birer tat — kendi bahçemizden, tanıdığımız üreticiden, üreticinin mutfağından.",
  entries: [
    {
      source: "ciftlik",
      sourceName: "Kabia Çiftliği",
      name: "Kabuklu Badem",
      slug: "kabuklu-badem",
      image: "/images/acik-badem.jpg",
      alt: "Kabia Çiftliği'nin kendi bahçesinden kabuklu badem",
    },
    {
      source: "secki",
      sourceName: "Kabia Seçki",
      name: "Kabuklu Fındık",
      slug: "findik-ici",
      image: "/images/findik2.jpeg",
      alt: "Güvendiğimiz üreticiden gelen kabuklu fındık",
    },
    {
      source: "mutfak",
      sourceName: "Kabia Mutfak",
      name: "Tarhana",
      slug: "tarhana",
      image: "/images/acik-tarhana1.jpg",
      alt: "Üreticinin mutfağında geleneksel yöntemle hazırlanan tarhana",
    },
  ],
} as const;

export const origin = {
  title: "Kılıçkaya’da bir bahçe.",
  eyebrow: "Sabırlar Köyü — Geyve, Sakarya",
  body: [
    "2019’da boş bir tarlayı dinlemeye geldik. Gerisini bahçe yazdı.",
  ],
  images: [
    {
      src: "/images/orchard-hillside.jpg",
      width: 2047,
      height: 2048,
      alt: "Kılıçkaya yamaçlarında genç badem bahçesi, arkada vadi ve dağlar",
      caption: "Badem ağaçları 3. yıl, Kılıçkaya yamaçları.",
    },
    {
      src: "/images/gunluk-2026-09-13-catlak-kabuk.jpeg",
      width: 1144,
      height: 2040,
      alt: "Dalında çatlamış yeşil kabuklu bademler — hasat zamanı",
      caption: "Yeşil kabuk çatlayınca hasat başlar.",
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
        "Ağaçlar Kılıçkaya yamaçlarında, sentetik girdi kullanılmadan büyür.",
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
      description: "Sert kabuğunda, gölgeli rüzgar alan yerde kurur.",
    },
    {
      name: "Hazırlık",
      description: "Kabuklu halde, katkısız hazırlanır.",
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
      name: "Bilinen kaynak",
      description:
        "Sabırlar Köyü — Kılıçkaya Vadisi, kendi bahçemiz. Toprağı sürmüyor, biçmiyor, dışarıdan gübre almıyoruz.",
    },
    {
      name: "Üreticisi tanınan ürün",
      description:
        "Engin Abi’nin fındığı, Kayadibi’nin cevizi, Akıncı’nın ıhlamuru — her ürünün arkasında tanıdığımız bir insan var.",
    },
    {
      name: "Katkısız",
      description:
        "Sertifikalı olsa bile dışarıdan gübre yok; ürüne ek katkı maddesi yok. Ne uyguluyorsak onu yazıyoruz.",
    },
  ],
} as const;

export const emanet = {
  eyebrow: "Emanet",
  titleA: "Toprağı emanet",
  titleB: "gibi görüyoruz.",
  body: "Bu toprak bize ait değil, bizden sonrakilere bırakacağımız bir emanet. Hızlı değil, doğru ve kalıcı üretmek istiyoruz. Her hasat, bir sonraki yılın toprağına bırakılan nottur.",
} as const;

export const editorialImage = {
  src: "/images/kilimbadem.jpg",
  width: 1672,
  height: 941,
  alt: "Kilim üzerinde kurumaya serilmiş kabuklu bademler",
  caption: "Hasat sonrası. Bademler kabuğunda, kendi halinde kurur.",
} as const;

/**
 * Verbatim brand statement carried over from the existing Kabia site's
 * about section — not a fabricated testimonial.
 */
export const quote = {
  text: "Kendi soframıza koymayacağımızı, sizin sofranıza göndermiyoruz.",
  attribution: "Kabia Ekolojik",
  context: "Kabia sofrası ilkesi",
} as const;

export const finalCta = {
  titleA: "Toprakla başlayan",
  titleB: "bir hikâye.",
  body: "Sorun, önerin — bahçeden biri okuyor, hafta içi dönüyoruz.",
  image: {
    src: "/images/file-badem.jpg",
    alt: "File içinde kabuklu Kabia bademleri",
  },
} as const;
