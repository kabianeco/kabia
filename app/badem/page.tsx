import Link from "next/link";
import { almondStory } from "@/content/homepage";
import "../documentary.css";

export const metadata = { title: "Badem — Kabia Ekolojik", description: "Bademimizi tanıyın. Marinada, Geyve/Sakarya, Kabia Çiftliği, organik. Bahçeden sofraya." };

export default function BademPage() {
 return (
 <div className="doc-body">
 <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <p className="doc-eyebrow">{almondStory.eyebrow}</p>
 <h1 className="doc-heading doc-heading--lg">{almondStory.title}</h1>
  <p className="doc-lead" style={{ marginTop: 12 }}>{almondStory.intro}</p>
  <p className="doc-body-text" style={{ marginTop: 12, maxWidth: 640 }}>Bademimiz <strong>organik sertifikalı</strong>, üretim modelimiz ise <strong>ekolojik</strong>: 5 yıldır sürülmeyen, biçilmeyen, dış girdisiz toprakta — orman kompostu ve kompost çayıyla beslenen 946 ağaç. Sertifika tabanımız, ekoloji ise farkımız.</p>
  <div style={{ marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18 }}>
  <h3 className="doc-heading" style={{ fontSize: 15 }}>Kabuğun altında</h3>
  <p className="doc-body-text" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>Bir bademin iyi olması için bahçede başlayan özenin sofraya kadar sürmesi gerekir. Kabia bu zinciri kendi elinde tutar: yetiştirir, kurutur, hazırlar.</p>
  </div>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18 }}>
  <h3 className="doc-heading" style={{ fontSize: 15 }}>Zamanla olgunlaşır</h3>
  <p className="doc-body-text" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>İyi badem, zamana gösterilen saygıyla oluşur. Dalda olgunlaşmayı, güneşte kurumayı, sırasını beklemeyi ister. Lezzet, acele edilmeden kurulan bir sürecin sonucudur.</p>
  </div>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18 }}>
  <h3 className="doc-heading" style={{ fontSize: 15 }}>Badem aceleye gelmez</h3>
  <p className="doc-body-text" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>Geyve’nin dağ köyü Sabırlar’da badem yetiştiririz. Bahçeye kimyasal gübre ve ilaç girmez; ürüne katkı maddesi eklenmez. Çok tonajlı üretim yerine temiz ve sağlıklı gıda üretmeyi tercih ediyoruz.</p>
  </div>
  </div>
 <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
 {almondStory.meta.map((m) => (
 <span key={m} className="doc-tag" style={{ background: "var(--bg-card)" }}>{m}</span>
 ))}
 </div>
 <div style={{ display: "grid", gap: 12, marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
 {almondStory.steps.map((s, i) => (
 <div key={s.name} className="doc-philosophy__card" style={{ textAlign: "center", padding: "18px 14px" }}>
 <p className="doc-muted" style={{ fontSize: 10, margin: 0 }}>0{i + 1}</p>
 <h3 style={{ fontSize: 14, margin: "6px 0 4px 0" }}>{s.name}</h3>
 <p style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{s.description}</p>
 </div>
 ))}
 </div>
  <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
  <Link href="/shop/kabuklu-badem" className="doc-btn doc-btn--primary">Kabuklu Badem — Mağazada gör →</Link>
  <Link href="/magaza" className="doc-btn doc-btn--ghost">Hasat Listesini gör →</Link>
  </div>
  <Link href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 16 }}>← Ana sayfaya dön</Link>
  </div>
  </div>
 );
}
