import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPublicProducts } from "@/lib/catalog";
import { CORRIDORS, type Product } from "@/lib/products";
import "../documentary.css";

export const metadata: Metadata = {
  title: "Hasat Listesi — Kabia Ekolojik",
  description: "Hasat — Kabuklu badem (organik, sadece kabuklu), ceviz, fındık, bal, salça, sirke, erişte, tarhana. Doğal, izlenebilir, hikâyesiyle.",
};

function LedgerRow({ product }: { product: Product }) {
 const isOrganic = product.slug === "kabuklu-badem";
 return (
 <Link
 href={`/shop/${product.slug}`}
 prefetch={false}
 style={{
 display: "grid",
 gridTemplateColumns: "88px 1fr auto",
 gap: 16,
 padding: "16px 0",
 borderBottom: "1px solid var(--border-color)",
 textDecoration: "none",
 alignItems: "center",
 }}
 >
 <span style={{ position: "relative", width: 88, height: 88, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "block" }}>
 {product.mainImageUrl ? (
 <Image src={product.mainImageUrl} alt={product.name} fill style={{ objectFit: "cover" }} sizes="88px" />
 ) : null}
 </span>
 <span style={{ minWidth: 0 }}>
 <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
 <strong style={{ fontFamily: "var(--font-heading)", fontSize: 16, color: "var(--text-heading)", fontWeight: 600 }}>{product.name}</strong>
 {isOrganic ? (
  <span style={{ fontSize: 10, letterSpacing: "0.07em", background: "white", color: "var(--primary-accent)", border: "1px solid var(--primary-accent)", padding: "3px 8px", borderRadius: 999, fontWeight: 700 }}>ORGANİK</span>
 ) : (
 <span style={{ fontSize: 9, letterSpacing: "0.06em", background: "var(--bg-accent-wash)", color: "var(--text-muted)", border: "1px solid var(--border-color)", padding: "3px 7px", borderRadius: 999 }}>DOĞAL</span>
 )}
 </span>
 <span style={{ display: "block", fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.06em", color: "var(--text-muted)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
 {product.origin || "Geyve"} · {product.shortDescription?.slice(0, 48) ?? "Hikâyesiyle"}
 </span>
 <span style={{ fontSize: 12, color: "var(--text-body)", marginTop: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" as any }}>{product.shortDescription}</span>
 </span>
 <span style={{ textAlign: "right", minWidth: 90 }}>
 <span style={{ display: "block", fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 600, color: "var(--text-heading)" }}>₺{product.price.toFixed(2).replace(".", ",")}</span>
 <span style={{ display: "block", fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.08em", color: "var(--primary-accent)", marginTop: 6 }}>Gör →</span>
 </span>
 </Link>
 );
}

export default async function ShopPage() {
 const supabase = await createSupabaseServerClient();
 const result = await fetchPublicProducts(supabase);
 const all: Product[] = result.status === "ok" ? result.products : [];

 const ciftlik = all.filter((p) => p.slug === "kabuklu-badem");
 const secki = all.filter((p) => (CORRIDORS.secki.categories as string[]).includes(p.category));
 const mutfak = all.filter((p) => (CORRIDORS.mutfak.categories as string[]).includes(p.category));

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
 <a href="#liste" className="doc-mobile-btn" aria-label="Menü">
 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
 </a>
 </div>
 </header>

 <main>
 <section className="doc-section" style={{ paddingBottom: 24 }}>
 <div className="doc-wrap" style={{ maxWidth: 720, textAlign: "center", margin: "0 auto" }}>
  <p className="doc-eyebrow" style={{ justifyContent: "center" }}>HASAT LİSTESİ</p>
  <h1 className="doc-heading doc-heading--xl">Hasat defteri.</h1>
  <p className="doc-lead" style={{ margin: "14px auto 0" }}>Satış hikâyenin önüne geçmez. Önce nereden geldiğini ve neden Kabia’da olduğunu okursun, sonra listeden seçersin. Kabuklu badem organik sertifikalı ve ekolojik üretim — sürülmeden, dış girdisiz; diğerleri doğal, sertifikasız, tanıdığımız üretim.</p>
  </div>
 </section>

 <section id="liste" className="doc-section" style={{ paddingTop: 0 }}>
 <div className="doc-wrap" style={{ maxWidth: 760 }}>
 {all.length === 0 ? (
 <p className="doc-muted" style={{ textAlign: "center", padding: "60px 0" }}>Henüz ürün yok.</p>
 ) : (
 <>
 <div style={{ marginTop: 8 }}>
  <p className="doc-eyebrow">KABİA ÇİFTLİĞİ · ORGANİK SERTİFİKALI · EKOLOJİK ÜRETİM</p>
  <h2 className="doc-heading" style={{ fontSize: 20, marginTop: 6 }}>Marinada çeşit badem</h2>
  <p className="doc-muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>Organik sertifikalı, ekolojik üretim — sürülmeden, dış girdisiz, kendi hasadımız.</p>
 <div style={{ marginTop: 16, borderTop: "1px solid var(--border-color)" }}>
 {ciftlik.length === 0 ? <p className="doc-muted" style={{ padding: "16px 0" }}>Yakında.</p> : ciftlik.map((p) => <LedgerRow key={p.id} product={p} />)}
 </div>
 </div>

 <div style={{ marginTop: 40 }}>
 <p className="doc-eyebrow">KABİA SEÇKİ · DOĞAL · Sertifikasız</p>
 <h2 className="doc-heading" style={{ fontSize: 20, marginTop: 6 }}>Tanıdığımız üreticilerden</h2>
 <div style={{ marginTop: 16, borderTop: "1px solid var(--border-color)" }}>
 {secki.length === 0 ? <p className="doc-muted" style={{ padding: "16px 0" }}>Yakında.</p> : secki.map((p) => <LedgerRow key={p.id} product={p} />)}
 </div>
 </div>

  <div style={{ marginTop: 40 }}>
  <p className="doc-eyebrow">KABİA MUTFAK · GELENEKSEL · Sertifikasız</p>
 <h2 className="doc-heading" style={{ fontSize: 20, marginTop: 6 }}>Üreticilerin mutfağından</h2>
 <div style={{ marginTop: 16, borderTop: "1px solid var(--border-color)" }}>
 {mutfak.length === 0 ? <p className="doc-muted" style={{ padding: "16px 0" }}>Yakında.</p> : mutfak.map((p) => <LedgerRow key={p.id} product={p} />)}
 </div>
 </div>

 <p className="doc-muted" style={{ marginTop: 32, textAlign: "center", fontSize: 11 }}>Fiyatlar KDV dahil · Kargo hasat haftası · Sorular için info@kabia.com</p>
 </>
 )}
 </div>
 </section>
 </main>

 <footer id="iletisim" className="doc-footer">
 <div className="doc-wrap">
 <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
 <p className="doc-footer__brand" style={{ letterSpacing: "0.18em", marginBottom: 12 }}>KABİA EKOLOJİK</p>
 <p className="doc-body-text" style={{ fontSize: 14, margin: "0 auto", maxWidth: 480, fontWeight: 300 }}>Toprağa saygıyla üretilenleri bir araya getiriyoruz — kendi çiftliğimizden ve üretimini bildiğimiz dostlarımızdan.</p>
 <p className="doc-muted" style={{ marginTop: 14 }}>Sabırlar Köyü — Kılıçkaya Vadisi, Geyve / Sakarya</p>
 </div>
  <div className="doc-footer__bottom" style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", gap: 6, marginTop: 28 }}>
  <span>© {new Date().getFullYear()} Kabia Ekolojik — Toprağa saygıyla.</span>
  <span style={{ fontSize: 10, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 480, margin: "0 auto" }}>Kabia Ekolojik, Epilantis Kozmetik Estetik Medikal Sanayi ve Dış Ticaret Limited Şirketi adına tescilli markadır.</span>
  </div>
 </div>
 </footer>
 </div>
 );
}
