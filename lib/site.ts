/**
 * Centralized site facts. Every value here is taken from the existing
 * Kabia project — do not add claims that cannot be verified there.
 */

/**
 * The single configured site URL. Every absolute URL — canonical, OG,
 * sitemap, structured data, robots, auth redirects, emails — derives from
 * this. Switching to kabiaekolojik.com (or back) is one environment variable
 * change: set NEXT_PUBLIC_SITE_URL. Unset means the production domain.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? ""
  const trimmed = raw.trim().replace(/\/+$/, "")
  if (trimmed === "") return "https://kabiaekolojik.com"
  if (/^https?:\/\//.test(trimmed)) return trimmed
  return "https://kabiaekolojik.com"
}

export const siteUrl = resolveSiteUrl()

export const site = {
  name: "Kabia Ekolojik",
  /* Kabia Ekolojik is the brand. The company behind it — the one that sells,
     invoices and holds the organic certificate — is Epilantis, so anywhere the
     law asks who the seller is, this is the name that belongs there. */
  legalName: "Epilantis Kozmetik Estetik Medikal San. Dış Tic. Ltd. Şti.",
  url: siteUrl,
  email: "info@kabia.com",
  phone: "+90 553 744 76 74",
  phoneHref: "tel:+905537447674",
  /* WhatsApp Business hattı: telefonla aynı numara, tek hat karışmaz. */
  whatsappNumber: "905537447674",
  address: "Sabırlar, 54700 Geyve / Sakarya",
  region: "Geyve, Sakarya",
  social: {
    instagram: "https://instagram.com/kabiaekolojik",
    facebook: "https://facebook.com/kabiaekolojik",
    x: "https://x.com/kabiaekolojik",
  },
} as const;

/** Hazır mesajlı WhatsApp sohbet linki — boş sohbet insanlara zor gelir. */
const WHATSAPP_DEFAULT_MESSAGE =
  "Merhaba, Kabia ürünleri hakkında bilgi almak istiyorum.";

export function whatsappHref(message: string = WHATSAPP_DEFAULT_MESSAGE) {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

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
  producers: "/ureticiler",
  producer: (slug: string) => `/ureticiler/${slug}`,
  // The Seçki grid is the brand-facing entry to the producers; /ureticiler
  // stays as it is and remains the story route that Seçki links into.
  secki: "/secki",
  mutfak: "/mutfak",
  // Producer slugs are story slugs: the producer's shelf lives at
  // /magaza/<producer-slug> (see app/magaza/[producer-slug]), and the story
  // at /ureticiler/<slug>. Map each producer to a representative product for
  // surfaces that need a single product link — the single source is the shop
  // catalogue, keyed by product slug.
  producerProduct: {
    "kabia-ciftligi": "kabuklu-badem",
    "geyve-setce-findik": "findik-ici",
    "ege-ceviz": "ceviz-ici",
    "anadolu-bal": "cicek-bali",
    "akinci-ihlamur": "ihlamur",
    "domates-salcasi": "domates-salcasi",
    "elma-sirkesi": "elma-sirkesi",
    "alic-sirkesi": "alic-sirkesi",
    "eriste": "eriste",
    "tarhana": "tarhana",
  } as Record<string, string>,
  producerStore: (slug: string) =>
    `/shop/${routes.producerProduct[slug] ?? slug}`,
  journal: "/gunluk",
  journalEntry: (slug: string) => `/gunluk/${slug}`,
  // Long-form guides (content/guides.ts): the orchard, how producers are
  // chosen, how to store the products.
  guides: "/rehber",
  guide: (slug: string) => `/rehber/${slug}`,
  farm: "/ciftlik",
  contact: "/iletisim",
  // The approach the nav points at. The homepage still opens with a short
  // version of it under `anchors.approach`, but /ciftlik is where it is set
  // out in full, so that is where the link goes from anywhere on the site.
  farmApproach: "/ciftlik#yaklasim",
  cart: "/sepet",
  checkout: "/odeme",
  login: "/giris",
  register: "/kayit",
  account: "/hesabim",
  accountOrders: "/hesabim/siparislerim",
  accountProfile: "/hesabim/bilgilerim",
  accountSecurity: "/hesabim/guvenlik",
  accountDelete: "/hesabim/guvenlik/hesabi-sil",
  accountDeleted: "/hesap-silindi",
  confirmationPending: "/eposta-onay-bekleniyor",
  verificationCode: "/dogrulama-kodu",
  forgotPassword: "/sifremi-unuttum",
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

/**
 * The static routes `app/sitemap.ts` advertises, declared next to the route
 * table they are drawn from so the two cannot drift apart.
 *
 * Only pages that exist at a fixed URL and are safe to advertise belong here:
 * no dynamic segments, no preview URLs. Product and producer URLs are appended
 * by the sitemap itself from live data.
 */
export type SitemapChangeFrequency = "daily" | "weekly" | "monthly" | "yearly"

export interface SitemapStaticPath {
  path: string
  changeFrequency: SitemapChangeFrequency
  priority: number
}

export const sitemapStaticPaths: readonly SitemapStaticPath[] = [
  { path: routes.home, changeFrequency: "weekly", priority: 1 },
  { path: routes.store, changeFrequency: "daily", priority: 0.9 },

  // The brand pages: the story half of the site, advertised alongside the shop.
  { path: routes.secki, changeFrequency: "monthly", priority: 0.7 },
  { path: routes.mutfak, changeFrequency: "monthly", priority: 0.7 },
  { path: "/badem", changeFrequency: "monthly", priority: 0.7 },
  { path: routes.farm, changeFrequency: "monthly", priority: 0.8 },
  { path: routes.producers, changeFrequency: "monthly", priority: 0.7 },
  { path: routes.journal, changeFrequency: "weekly", priority: 0.6 },
  // The guide pages themselves are appended by app/sitemap.ts from
  // content/guides.ts, with their publication dates.
  { path: routes.guides, changeFrequency: "monthly", priority: 0.6 },
  { path: routes.contact, changeFrequency: "monthly", priority: 0.5 },

  { path: routes.distanceSalesAgreement, changeFrequency: "monthly", priority: 0.5 },
  { path: routes.preliminaryInfo, changeFrequency: "monthly", priority: 0.5 },
  { path: routes.privacyPolicy, changeFrequency: "monthly", priority: 0.5 },
  { path: routes.kvkkDisclosure, changeFrequency: "monthly", priority: 0.5 },
  { path: routes.explicitConsent, changeFrequency: "monthly", priority: 0.4 },
  { path: routes.cookiePolicy, changeFrequency: "monthly", priority: 0.4 },
  { path: routes.deliveryAndReturn, changeFrequency: "monthly", priority: 0.5 },
  { path: routes.termsOfUse, changeFrequency: "monthly", priority: 0.5 },
] as const

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

/**
 * Sign-in, registration, e-mail/password status pages and the account area.
 * These screens are forms end to end, so the floating WhatsApp control and
 * toasts are placed so they never cover a field or a button here (see
 * WhatsAppFloat and SiteToaster). Every other route is left exactly as it is.
 */
const ACCOUNT_SURFACE_PATHS = [
  routes.login,
  routes.register,
  routes.confirmationPending,
  routes.verificationCode,
  routes.forgotPassword,
  "/sifre-yenile",
  "/eposta-onaylandi",
  "/eposta-degisikligi-onaylandi",
  "/baglanti-gecersiz",
  routes.accountDeleted,
] as const

export function isAccountSurface(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === routes.account || pathname.startsWith(`${routes.account}/`)) return true
  return (ACCOUNT_SURFACE_PATHS as readonly string[]).includes(pathname)
}

/**
 * The floating contact button's allowlist — the single rule for where it
 * may appear. Default-deny: anything not listed here never renders it, so
 * product pages (/shop/*, which carry the mobile buy bar), the cart
 * (/sepet), checkout (/odeme), account and auth surfaces, legal pages,
 * guides (/rehber/*) and all of /admin stay free of it without their own
 * per-page or per-breakpoint conditions.
 *
 * The homepage is listed but hero-gated: WhatsAppFloat keeps it hidden
 * until its IntersectionObserver reports the hero has left the viewport.
 */
const CONTACT_FLOAT_PREFIXES = [
  routes.store,
  routes.farm,
  routes.journal,
  routes.secki,
  routes.mutfak,
] as const

export function isContactFloatRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === routes.home) return true
  return (CONTACT_FLOAT_PREFIXES as readonly string[]).some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
}
