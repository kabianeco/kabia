import { kabiaStandard } from "@/content/homepage";
import "../documentary.css";

export const metadata = { title: "Kabia Standardı — Kabia Ekolojik", description: "Kabia'da her ürün yer almaz. Çiftlik ve Seçki ayrımı net." };

export default function StandardPage() {
 return (
 <div className="doc-body">
 <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <h1 className="doc-heading doc-heading--lg">{kabiaStandard.title}</h1>
 <p className="doc-body-text" style={{ marginTop: 12, maxWidth: 600 }}>{kabiaStandard.body}</p>
 <div style={{ display: "grid", gap: 16, marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
 {kabiaStandard.columns.map((c) => (
 <div key={c.label} className="doc-philosophy__card">
 <p style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.12em", fontWeight: 600, color: "var(--text-muted)", margin: 0 }}>{c.label}</p>
 <p style={{ fontFamily: "var(--font-heading)", fontStyle: "italic", fontSize: 16, margin: "8px 0 6px 0" }}>“{c.subtitle}”</p>
 <p style={{ fontSize: 13, margin: 0 }}>{c.description}</p>
 </div>
 ))}
 </div>
 <p className="doc-muted" style={{ marginTop: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "10px 14px", borderRadius: 10 }}>{kabiaStandard.disclaimer}</p>
 <a href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 24 }}>← Ana sayfaya dön</a>
 </div>
 </div>
 );
}
