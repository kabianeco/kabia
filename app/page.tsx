import Image from "next/image";
import Link from "next/link";
import { HarvestSystem } from "@/components/documentary/harvest-system";
import "./documentary.css";

export const metadata = {
  title: "Kabia Ekolojik — Toprağa iyi bakarsanız, toprak da size iyi bakar",
  description: "2021'den beri Geyve Kılıçkaya eteklerinde'de organik badem. 2025 donu da dahil, her mevsimin hikayesiyle.",
};

export default function HomePage() {
  return (
  <div className="doc-body">
  <header className="doc-header">
  <div className="doc-wrap doc-header__inner">
  <Link href="/" className="doc-logo" aria-label="Kabia Ekolojik — anasayfa">
 
  <span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span>
  </Link>
  <nav className="doc-nav" aria-label="Ana menü">
  <Link href="/ciftlik" className="doc-nav__link">ÇİFTLİK</Link>
  <Link href="/secki" className="doc-nav__link">SEÇKİ</Link>
  <Link href="/mutfak" className="doc-nav__link">MUTFAK</Link>
  <Link href="/emanet" className="doc-nav__link">EMANET</Link>
  <Link href="/ciftlikten" className="doc-nav__link">ÇİFTLİKTEN</Link>
  <Link href="/magaza" className="doc-nav__link" style={{ opacity: 0.6 }}>Liste</Link>
  </nav>
  <a href="#baslangic" className="doc-mobile-btn" aria-label="Menü">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  </a>
  </div>
  </header>

  <main>
  {/* HERO — 2025 donuyla başlayan hikaye */}
  <section style={{ minHeight: "92vh", position: "relative", display: "grid", placeItems: "center", padding: 0, overflow: "hidden", background: "#0f1a14" }}>
  <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
  <video autoPlay muted loop playsInline preload="metadata" poster="/images/orchard-hillside.jpg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", top: 0, objectFit: "cover", objectPosition: "center 18%", transform: "scale(1.04)" }}>
  <source src="/images/video3.mp4" type="video/mp4" />
  </video>
  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(12,22,16,0.18) 0%, rgba(12,22,16,0.32) 55%, rgba(12,22,16,0.58) 100%)" }} />
  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, transparent 45%, rgba(0,0,0,0.24) 100%)" }} />
  </div>
  <div className="doc-wrap" style={{ position: "relative", textAlign: "center", color: "white", paddingTop: 40, paddingBottom: 56 }}>
  <p style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.78)", margin: "0 0 12px" }}>Geyve · Kılıçkaya · 2021’den beri</p>
            <h1 className="doc-heading" style={{ color: "white", fontSize: "clamp(44px, 9vw, 88px)", letterSpacing: "0.14em", fontWeight: 500, lineHeight: 1, margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.22)" }}>KABİA</h1>
  <p style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(18px, 3.2vw, 28px)", fontStyle: "italic", fontWeight: 400, marginTop: 12, color: "white", lineHeight: 1.35 }}>Toprağa iyi bakarsanız,<br />toprak da size iyi bakar.</p>

  </div>
        </section>

  {/* BAŞLANGIÇ — 2021 */}
  <section id="baslangic" className="doc-section" style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)" }}>
  <div className="doc-wrap" style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
  <p className="doc-eyebrow" style={{ justifyContent: "center" }}>BAŞLANGIÇ — 2021</p>
  <h2 className="doc-heading doc-heading--lg" style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Her şey bir badem ağacıyla başlamadı.</h2>
  <h3 className="doc-heading" style={{ fontSize: 28, marginTop: 6, fontStyle: "italic", fontWeight: 400 }}>Toprağa başka türlü bakmaya karar vermekle başladı.</h3>
  <p className="doc-body-text" style={{ marginTop: 16, fontSize: 15 }}>2021’de Geyve Kılıçkaya yamaçlarında Kabia Ekolojik Çiftliği’ni kurduk. Bir bahçe kurmak istedik — toprağın canlılığını koruyabildiğimiz bir yer. İlk kış 946 fidan kar altındaydı, biz soba başında toprak analizlerine bakıyorduk. 2025’te don vurdu, beklediğimiz hasadı alamadık. Zordu, ama bize şunu öğretti: tarım doğaya karşı değil, doğayla birlikte.</p>
  <Link href="/ciftlik" className="doc-btn doc-btn--ghost" style={{ marginTop: 18 }}>Kabia’nın hikâyesi →</Link>
  </div>
  </section>

  {/* ÜÇ DÜNYA — immersive */}
  <section className="doc-section" style={{ paddingBottom: 40 }}>
  <div className="doc-wrap">
  <div style={{ maxWidth: 640, marginBottom: 28, textAlign: "center", marginInline: "auto" }}>
  <p className="doc-eyebrow" style={{ justifyContent: "center" }}>ÜÇ ANA DÜNYA</p>
  <h2 className="doc-heading doc-heading--lg">Bizim toprağımızdan.<br />Tanıdığımız üreticilerden.<br /><em>Üreticilerin mutfağından.</em></h2>
  </div>
  <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
  <Link href="/ciftlik" style={{ textDecoration: "none", display: "block", borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-soft)", background: "var(--bg-card)" }}>
  <div style={{ height: 260, position: "relative" }}><Image src="/images/almonds-net.jpg" alt="Kabia Çiftliği — filede badem" fill quality={90} style={{ objectFit: "cover" }} sizes="(min-width:900px) 33vw, 100vw" /><span style={{ position: "absolute", left: 12, top: 12, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--primary-accent)", fontWeight: 600 }}>ORGANİK SERTİFİKALI</span></div>
  <div style={{ padding: 18 }}>
  <p style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.12em", color: "var(--primary-accent)", margin: 0 }}>KABİA ÇİFTLİĞİ</p>
  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 20, margin: "8px 0 6px", color: "var(--text-heading)" }}>Marinada çeşit badem</h3>
   <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-body)" }}>Organik sertifikalı, kendi hasadımız.</p>
  </div>
  </Link>
  <Link href="/secki" style={{ textDecoration: "none", display: "block", borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-soft)", background: "var(--bg-card)" }}>
  <div style={{ height: 260, position: "relative" }}><Image src="/images/findik1.jpeg" alt="Kabia Seçki — dost üreticiler" fill style={{ objectFit: "cover" }} sizes="(min-width:900px) 33vw, 100vw" /><span style={{ position: "absolute", left: 12, top: 12, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 500 }}>DOĞAL · Sertifikasız</span></div>
  <div style={{ padding: 18 }}>
  <p style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.12em", color: "var(--text-muted)", margin: 0 }}>KABİA SEÇKİ</p>
  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 20, margin: "8px 0 6px", color: "var(--text-heading)" }}>Ceviz, fındık, bal</h3>
  <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-body)" }}>Tanıdığımız üretim, izlenebilir.</p>
  </div>
  </Link>
  <Link href="/mutfak" style={{ textDecoration: "none", display: "block", borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-soft)", background: "var(--bg-card)" }}>
  <div style={{ height: 260, position: "relative" }}><Image src="/images/valley-ridge.jpg" alt="Kabia Mutfak — geleneksel" fill style={{ objectFit: "cover" }} sizes="(min-width:900px) 33vw, 100vw" /><span style={{ position: "absolute", left: 12, top: 12, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--secondary-accent)", fontWeight: 500 }}>GELENEKSEL · Sertifikasız</span></div>
  <div style={{ padding: 18 }}>
  <p style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.12em", color: "var(--secondary-accent)", margin: 0 }}>KABİA MUTFAK</p>
  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 20, margin: "8px 0 6px", color: "var(--text-heading)" }}>Erişte, tarhana, salça</h3>
  <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "var(--text-body)" }}>Geleneksel mutfak, tanıdığımız eller.</p>
  </div>
  </Link>
  </div>
  <div style={{ textAlign: "center", marginTop: 24 }}>
  <Link href="/magaza" className="doc-btn doc-btn--ghost" style={{ padding: "12px 24px" }}>Hasat Listesini gör →</Link>
  </div>
  </div>
  </section>

  {/* TOPRAK — asimetrik */}
  <section className="doc-section" style={{ background: "var(--bg-accent-wash)", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)" }}>
  <div className="doc-wrap" style={{ display: "grid", gap: 32, alignItems: "center", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
  <div style={{ position: "relative", height: 380, borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-soft)" }}>
  <Image src="/images/field-tractor.jpg" alt="Canlı toprak — Geyve" fill style={{ objectFit: "cover" }} sizes="(min-width: 900px) 50vw, 100vw" />
  </div>
  <div style={{ textAlign: "left" }}>
  <p className="doc-eyebrow">TOPRAK</p>
  <h2 className="doc-heading doc-heading--lg" style={{ marginTop: 8 }}>Önce toprağı düşündük.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>Bizim için tarımın başlangıcı bitki değil, topraktır. Toprağı yaşayan bir ekosistem olarak görüyoruz. Ekolojik tekniklerle canlılığını desteklemeye çalışıyoruz. 2025 donu da toprağın bize verdiği bir ders oldu.</p>
  <Link href="/uretim" className="doc-btn doc-btn--ghost" style={{ marginTop: 16 }}>Nasıl üretiyoruz? →</Link>
  </div>
  </div>
  </section>

  {/* BADEM — asimetrik */}
  <section className="doc-section">
  <div className="doc-wrap" style={{ display: "grid", gap: 32, alignItems: "center", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
  <div style={{ textAlign: "left" }}>
  <p className="doc-eyebrow">BADEM</p>
  <h2 className="doc-heading doc-heading--lg" style={{ marginTop: 8 }}>Bir badem,<br /><em>bir yılın hikâyesidir.</em></h2>
  <div style={{ display: "grid", gap: 8, marginTop: 16, maxWidth: 320 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--border-color)", padding: "8px 0" }}>
  <span className="doc-muted" style={{ fontSize: 11 }}>Ağaç</span>
  <span style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 600, color: "var(--text-heading)" }}>946 ağaç</span>
  </div>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--border-color)", padding: "8px 0" }}>
  <span className="doc-muted" style={{ fontSize: 11 }}>Çeşit</span>
  <span style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 600, color: "var(--text-heading)" }}>Marinada</span>
  </div>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--border-color)", padding: "8px 0" }}>
  <span className="doc-muted" style={{ fontSize: 11 }}>Rakım</span>
  <span style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 600, color: "var(--text-heading)" }}>775 m</span>
  </div>
  </div>
  <p className="doc-body-text" style={{ marginTop: 16 }}>Çiçeklenmeden hasada uzun bir yol. 2025’te don, aylarca emeği bir gecede değiştirdi. Saklamadık — bu da hikâyenin parçası.</p>
  <Link href="/badem" className="doc-btn doc-btn--ghost" style={{ marginTop: 16 }}>Badem bahçesini keşfet →</Link>
  </div>
  <div style={{ position: "relative", height: 420, borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-soft)" }}>
  <Image src="/images/almonds-drying.jpg" alt="Marinada badem" fill style={{ objectFit: "cover" }} sizes="(min-width: 900px) 50vw, 100vw" />
  <div style={{ position: "absolute", left: 14, bottom: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "6px 12px", fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.1em", color: "var(--text-heading)" }}>MARINADA · ORGANİK</div>
  </div>
  </div>
  </section>

  {/* ÜRETİCİLER */}
  <section id="uretici" className="doc-section">
  <div className="doc-wrap">
  <div style={{ display: "grid", gap: 24, alignItems: "end", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginBottom: 28 }}>
  <div>
  <p className="doc-eyebrow">ÜRETİCİLER</p>
  <h2 className="doc-heading doc-heading--lg" style={{ marginTop: 8 }}>Bir ürünün arkasında<br /><em>çoğu zaman bir insan vardır.</em></h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>Kabia yalnızca kendi bahçemiz değil. Aynı özeni gösteren üreticileri tanıyoruz. İleride hikâyeleri burada, kendi ağızlarından.</p>
  </div>
  <div style={{ position: "relative", height: 220, borderRadius: "var(--radius-card)", overflow: "hidden", border: "1px solid var(--border-color)", opacity: 0.9 }}>
  <Image src="/images/valley-ridge.jpg" alt="Geyve vadisi — üreticiler" fill style={{ objectFit: "cover" }} sizes="(min-width:900px) 40vw, 100vw" />
  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.38), transparent 60%)" }} />
  <p style={{ position: "absolute", left: 14, bottom: 10, margin: 0, fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.12em", color: "white" }}>5 Seçki üreticisi · 5 hikâye</p>
  </div>
  </div>
  <HarvestSystem />
  </div>
  </section>

  {/* EMANET — Arşiv yerine, konsepte uygun yeni başlık */}
  <section className="doc-section" style={{ background: "var(--text-heading)", color: "var(--bg-card)", textAlign: "center" }}>
  <div className="doc-wrap" style={{ maxWidth: 720 }}>
  <p className="doc-eyebrow" style={{ color: "var(--secondary-accent)", justifyContent: "center" }}>EMANET</p>
  <h2 className="doc-heading doc-heading--lg" style={{ color: "var(--bg-card)" }}>Toprağı emanet<br /><em style={{ color: "var(--secondary-accent)" }}>gibi görüyoruz.</em></h2>
  <p className="doc-body-text" style={{ marginTop: 12, color: "rgba(255,255,255,0.88)", maxWidth: 600, marginInline: "auto" }}>Bu toprak bize ait değil, bizden sonrakilere bırakacağımız bir emanet. 2025 donu bize bunu yeniden hatırlattı. Hızlı değil, doğru ve kalıcı üretmek istiyoruz. Her hasat, bir sonraki yılın toprağına bırakılan nottur.</p>
  <Link href="/ciftlik" className="doc-btn" style={{ marginTop: 20, background: "var(--bg-card)", color: "var(--text-heading)", padding: "12px 22px", borderRadius: 999, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, textDecoration: "none" }}>Emaneti gör →</Link>
  </div>
  </section>

  <footer id="iletisim" className="doc-footer">
  <div className="doc-wrap">
  <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
  <p className="doc-footer__brand" style={{ letterSpacing: "0.18em", marginBottom: 12 }}>KABİA EKOLOJİK</p>
  <p className="doc-body-text" style={{ fontSize: 14, margin: "0 auto", maxWidth: 480, fontWeight: 300 }}>Toprağa saygıyla üretilenleri bir araya getiriyoruz — kendi çiftliğimizden ve üretimini bildiğimiz dostlarımızdan.</p>
  <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", fontSize: 13 }}>
  <Link href="/ciftlik" className="doc-footer__link">Çiftlik</Link>
  <span style={{ opacity: 0.3 }}>·</span>
  <Link href="/secki" className="doc-footer__link">Seçki</Link>
  <span style={{ opacity: 0.3 }}>·</span>
  <Link href="/mutfak" className="doc-footer__link">Mutfak</Link>
  <span style={{ opacity: 0.3 }}>·</span>
  <Link href="/emanet" className="doc-footer__link">Emanet</Link>
  <span style={{ opacity: 0.3 }}>·</span>
  <Link href="/magaza" className="doc-footer__link">Liste</Link>
  </div>
  <p className="doc-muted" style={{ marginTop: 14 }}>Sabırlar Köyü — Kılıçkaya Vadisi, Geyve / Sakarya · +90 553 744 76 74</p>
  </div>
  <div className="doc-footer__bottom" style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", gap: 6, marginTop: 28 }}>
  <span>© {new Date().getFullYear()} Kabia Ekolojik — Toprağa saygıyla.</span>
  <span style={{ fontSize: 10, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 480, margin: "0 auto" }}>Kabia Ekolojik, Epilantis Kozmetik Estetik Medikal Sanayi ve Dış Ticaret Limited Şirketi adına tescilli markadır.</span>
  </div>
  </div>
  </footer>
  </main>
  </div>
  );
}
