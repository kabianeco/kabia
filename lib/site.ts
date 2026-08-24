/**
 * Centralized site facts. Every value here is taken from the existing
 * Kabia project — do not add claims that cannot be verified there.
 */
export const site = {
  name: "Kabia Ekolojik",
  url: "https://kabiaekolojik.com",
  email: "info@kabia.com",
  phone: "+90 553 744 76 74",
  phoneHref: "tel:+905537447674",
  address: "Sabırlar, 54700 Geyve / Sakarya",
  region: "Geyve, Sakarya",
  social: {
    instagram: "https://instagram.com/kabiaekolojik",
    facebook: "https://facebook.com/kabiaekolojik",
    x: "https://x.com/kabiaekolojik",
  },
} as const;

/**
 * In-page anchors on the homepage. These only resolve on `/`, so navigation
 * built from them has to prefix the home route when it can be rendered
 * elsewhere — see `homeAnchor`.
 */
export const anchors = {
  products: "#urunler",
  farm: "#ciftlik",
  approach: "#yaklasim",
  contact: "#iletisim",
} as const;

/**
 * App routes. The Turkish paths are the shipped, functional URLs and are kept
 * exactly as they are: existing links, Supabase auth redirects and password
 * reset emails all point at them.
 */
export const routes = {
  home: "/",
  store: "/magaza",
  product: (slug: string) => `/shop/${slug}`,
  blog: "/blog",
  blogPost: (slug: string) => `/blog/${slug}`,
  cart: "/sepet",
  checkout: "/odeme",
  login: "/giris",
  register: "/kayit",
  account: "/hesabim",
  accountOrders: "/hesabim/siparislerim",
  accountProfile: "/hesabim/bilgilerim",
  // Yasal / sözleşme sayfaları
  distanceSalesAgreement: "/mesafeli-satis-sozlesmesi",
  preliminaryInfo: "/on-bilgilendirme-formu",
  privacyPolicy: "/gizlilik-politikasi",
  kvkkDisclosure: "/kvkk-aydinlatma-metni",
  explicitConsent: "/acik-riza-metni",
  cookiePolicy: "/cerez-politikasi",
  deliveryAndReturn: "/teslimat-ve-iade",
  termsOfUse: "/kullanim-kosullari",
} as const;

/** Footer'da ve form onay kutularında kullanılan yasal linkler. */
export const legalLinks = [
  { label: "Mesafeli Satış Sözleşmesi", href: "/mesafeli-satis-sozlesmesi" },
  { label: "Ön Bilgilendirme Formu", href: "/on-bilgilendirme-formu" },
  { label: "Gizlilik Politikası", href: "/gizlilik-politikasi" },
  { label: "KVKK Aydınlatma Metni", href: "/kvkk-aydinlatma-metni" },
  { label: "Açık Rıza Metni", href: "/acik-riza-metni" },
  { label: "Çerez Politikası", href: "/cerez-politikasi" },
  { label: "Teslimat ve İade", href: "/teslimat-ve-iade" },
  { label: "Kullanım Koşulları", href: "/kullanim-kosullari" },
] as const;

/** A homepage anchor that also works when linked from another route. */
export const homeAnchor = (anchor: string) => `/${anchor}`;

export const mailto = (subject?: string) =>
  subject
    ? `mailto:${site.email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${site.email}`;
