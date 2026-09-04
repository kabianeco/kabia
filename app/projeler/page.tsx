import Link from "next/link";
import "../documentary.css";

export const metadata = { title: "Projeler — Kabia Ekolojik", description: "Canlı Toprak ve Tozlayıcı projeleri — döngü." };

export default function ProjelerPage() {
 return (
 <div className="doc-body">
 <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <p className="doc-eyebrow">Projects — Flamingo Estate gibi</p>
 <h1 className="doc-heading doc-heading--lg">Toprak döngüsü için<br />iki proje.</h1>
 <p className="doc-lead" style={{ marginTop: 12 }}>Her proje kendi sayfası, şeffaf. Ürün değil, misyon.</p>
 <div style={{ display: "grid", gap: 16, marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
 <Link href="/projeler/canli-toprak" style={{ textDecoration: "none", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden", display: "block" }}>
 <div style={{ height: 160, background: "var(--bg-accent-wash)", display: "grid", placeItems: "center", fontFamily: "var(--font-heading)", fontSize: 42, fontStyle: "italic" }}>01</div>
 <div style={{ padding: 18 }}><p style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.12em", color: "var(--text-muted)", margin: 0 }}>PROJECT 01</p><h3 style={{ fontFamily: "var(--font-heading)", fontSize: 18, margin: "6px 0" }}>Canlı Toprak Projesi</h3><p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>Kore Doğal Tarım IMO + JADAM kil — canlı toprak.</p></div>
 </Link>
 <Link href="/projeler/tozlayici" style={{ textDecoration: "none", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden", display: "block" }}>
 <div style={{ height: 160, background: "var(--bg-accent-wash)", display: "grid", placeItems: "center", fontFamily: "var(--font-heading)", fontSize: 42, fontStyle: "italic" }}>02</div>
 <div style={{ padding: 18 }}><p style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.12em", color: "var(--text-muted)", margin: 0 }}>PROJECT 02</p><h3 style={{ fontFamily: "var(--font-heading)", fontSize: 18, margin: "6px 0" }}>Tozlayıcı & Biyoçeşitlilik</h3><p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>Otlar biçilmez — arı ve böcek için denge.</p></div>
 </Link>
 </div>
 <a href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 24 }}>← Ana sayfaya dön</a>
 </div>
 </div>
 );
}
