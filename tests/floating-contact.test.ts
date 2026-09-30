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

describe("notch-safe fixed chrome (gap above the navbar)", () => {
  it("draws under the status bar and pads clear of the notch", () => {
    assert.match(read("app/layout.tsx"), /viewportFit: "cover"/)
    const header = read("components/layout/site-header.tsx")
    assert.match(header, /pt-\[env\(safe-area-inset-top\)\]/)
    assert.match(header, /top-\[calc\(2\.5rem\+env\(safe-area-inset-top\)\)\]/)
    const shell = read("components/layout/page-shell.tsx")
    assert.match(shell, /pt-\[env\(safe-area-inset-top\)\]/)
    const css = read("app/globals.css")
    assert.match(css, /env\(safe-area-inset-top\)/)
  })
})
