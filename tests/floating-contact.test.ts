import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { isContactFloatRoute } from "../lib/site.ts"

const read = (path: string) => readFileSync(path, "utf8")

describe("floating contact button allowlist", () => {
  it("shows on the store, farm, journal, secki, mutfak and home", () => {
    for (const path of [
      "/",
      "/magaza",
      "/magaza/kabia-ciftligi",
      "/ciftlik",
      "/gunluk",
      "/gunluk/hasat-gunlugu",
      "/secki",
      "/mutfak",
    ]) {
      assert.equal(isContactFloatRoute(path), true, path)
    }
  })

  it("hides on product, cart, checkout, account, auth, legal, guides and admin routes", () => {
    for (const path of [
      "/shop/bal",
      "/shop",
      "/sepet",
      "/odeme",
      "/hesabim",
      "/hesabim/siparislerim",
      "/hesabim/guvenlik/hesabi-sil",
      "/giris",
      "/kayit",
      "/dogrulama-kodu",
      "/eposta-onay-bekleniyor",
      "/sifremi-unuttum",
      "/sifre-yenile",
      "/mesafeli-satis-sozlesmesi",
      "/on-bilgilendirme-formu",
      "/gizlilik-politikasi",
      "/kvkk-aydinlatma-metni",
      "/acik-riza-metni",
      "/cerez-politikasi",
      "/teslimat-ve-iade",
      "/kullanim-kosullari",
      "/rehber",
      "/rehber/saklama",
      "/admin",
      "/admin/urunler",
      "/admin/appearance/preview",
      "/iletisim",
      "/ureticiler",
      "/badem",
      "/magazax",
      "/gunlukx",
      null,
      undefined,
      "",
    ]) {
      assert.equal(isContactFloatRoute(path), false, String(path))
    }
  })
})

describe("floating contact button component rules", () => {
  const src = () => read("components/layout/whatsapp-float.tsx")

  it("is driven by the single allowlist, with no per-page or per-breakpoint hiding", () => {
    assert.match(src(), /isContactFloatRoute/)
    assert.ok(!src().includes("isAccountSurface"), "no account-surface condition")
    assert.ok(!src().includes("hidden xl:"), "no breakpoint hiding")
    // One allowlist, one place: the component holds no route literals.
    for (const literal of ["/magaza", "/ciftlik", "/gunluk", "/secki", "/mutfak", "/sepet", "/odeme", "/admin"]) {
      assert.ok(!src().includes(`"${literal}"`), literal)
    }
  })

  it("gates the homepage on an IntersectionObserver over the whole intro, not a scroll listener", () => {
    assert.match(src(), /IntersectionObserver/)
    assert.match(src(), /CONTACT_FLOAT_HERO_SELECTOR/)
    assert.ok(!/addEventListener\("scroll"|window\.scrollY|scrollTo/.test(src()), "no scroll listener")
    const intro = read("components/home/intro-sequence.tsx")
    // Both variants (scroll story and reduced-motion stills) gate on the
    // whole section — past the closing green panel — not the first screen.
    const sections = intro.match(/<section[^>]*data-site-hero/g) || []
    assert.equal(sections.length, 2, "both intro variants carry the marker on their section")
  })

  it("starts hidden on server and client and unmounts when hidden", () => {
    // First render must be identical on both sides (no hydration mismatch):
    // mounted starts false, so the button renders null until effects run.
    assert.match(src(), /useState\(false\)/)
    assert.match(src(), /if \(!rendered\) return null/)
  })

  it("fades on a short transition that respects reduced motion", () => {
    assert.match(src(), /contact-float-in/)
    assert.match(src(), /contact-float-out/)
    const css = read("app/globals.css")
    assert.match(css, /\.contact-float-in/)
    assert.match(css, /\.contact-float-out/)
    assert.match(css, /prefers-reduced-motion/)
  })
})

describe("notch-safe fixed chrome (one inset source, applied once)", () => {
  it("reads env() once into --safe-top/--safe-bottom and uses var() everywhere else", () => {
    const css = read("app/globals.css")
    assert.match(css, /--safe-top: env\(safe-area-inset-top, 0px\)/)
    assert.match(css, /--safe-bottom: env\(safe-area-inset-bottom, 0px\)/)
    // No other file may read the raw inset: a single source keeps the
    // stack from counting it twice, and tests override the vars.
    for (const file of [
      "components/layout/site-header.tsx",
      "components/layout/page-shell.tsx",
      "components/layout/whatsapp-float.tsx",
      "components/shop/product-detail-islands.tsx",
      "components/providers.tsx",
    ]) {
      assert.ok(!read(file).includes("env(safe-area-inset-"), file)
    }
  })

  it("stacks band, header and clearance with the inset exactly once", () => {
    const shell = read("components/layout/page-shell.tsx")
    // Band: top edge at 0, own background under the status bar, text in the
    // fixed 2.5rem row below the inset.
    assert.match(shell, /top-0 z-30 pt-\[var\(--safe-top\)\]/)
    assert.match(shell, /flex h-10 items-center justify-center/)
    const header = read("components/layout/site-header.tsx")
    // With the band the header only offsets below it; without the band it
    // starts at 0 and pads itself. Nothing fixed starts at top: var().
    assert.match(header, /top-\[calc\(2\.5rem\+var\(--safe-top\)\)\]/)
    assert.match(header, /top-0 pt-\[var\(--safe-top\)\]/)
    assert.ok(!header.includes("top-[var(--safe-top)]"), "no hole at the top edge")
    const css = read("app/globals.css")
    assert.match(css, /\+ var\(--safe-top\)/)
  })

  it("keeps the status bar covered while the mobile menu grows from the header", () => {
    const header = read("components/layout/site-header.tsx")
    assert.match(header, /site-header__safe-area absolute inset-x-0 top-0 h-\[var\(--safe-top\)\]/)
    assert.match(header, /surfaced \? "bg-ivory" : "bg-transparent"/)
    assert.match(header, /id="mobile-menu"/)
    assert.match(header, /site-header__menu-panel lg:hidden/)
    assert.doesNotMatch(header, /role="dialog"|aria-modal="true"/)
    const float = read("components/layout/whatsapp-float.tsx")
    assert.match(float, /bottom-\[calc\(1\.25rem\+var\(--safe-bottom\)\)\]/)
    assert.match(float, /z-30/)
  })

  it("clears the home indicator at every bottom edge", () => {
    assert.match(read("components/shop/product-detail-islands.tsx"), /var\(--safe-bottom\)/)
    const providers = read("components/providers.tsx")
    assert.match(providers, /var\(--safe-bottom\)/)
    assert.match(providers, /mobileOffset=/)
  })

  it("tints the status bar from the effective theme, not a static export", () => {
    // The boot script paints it before first paint (toggle-aware); the
    // provider keeps it in sync. A static OS-media theme-color cannot see
    // the manual choice, so the layout exports none.
    assert.match(read("lib/theme-init.ts"), /meta\[name="theme-color"\]/)
    assert.match(read("lib/theme.tsx"), /THEME_SURFACE_DARK/)
    assert.ok(!read("app/layout.tsx").includes("themeColor"), "no static theme-color")
    assert.match(read("app/layout.tsx"), /viewportFit: "cover"/)
  })
})
