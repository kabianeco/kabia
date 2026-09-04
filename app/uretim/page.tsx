import Image from "next/image";
import Link from "next/link";
import { soilProduction } from "@/content/homepage";
import "../documentary.css";

export const metadata = { title: "Üretim — Kabia Ekolojik", description: "Toprağı sadece üretim alanı olarak görmüyoruz. Toprak, biyoçeşitlilik, doğal yöntemler, gözlem." };

export default function UretimPage() {
 return (
 <div className="doc-body">
 <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 64 }}>
 <a href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <p className="doc-eyebrow">NASIL ÜRETİYORUZ?</p>
 <h1 className="doc-heading doc-heading--lg">{soilProduction.title}</h1>
 <p className="doc-body-text" style={{ marginTop: 14, maxWidth: 640 }}>{soilProduction.body}</p>
 <div className="doc-philosophy" style={{ marginTop: 24 }}>
 {soilProduction.pillars.map((p) => (
 <div key={p.title} className="doc-philosophy__card">
 <h3>{p.title}</h3>
 <p>{p.description}</p>
 </div>
 ))}
 </div>
  <div style={{ marginTop: 32, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
  <div style={{ position: "relative", height: 180 }}><Image src="/images/uretim-surmeme.jpg" alt="Sürmeme — 5 yıldır sürülmeyen toprak" fill style={{ objectFit: "cover" }} sizes="(min-width:860px) 400px, 100vw" /></div>
  <div style={{ padding: 16 }}>
  <h3 className="doc-heading" style={{ fontSize: 15 }}>1 — Sürmüyoruz</h3>
  <p className="doc-body-text" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>5 yıldır toprağı sürmüyoruz. Pulluk mantar ağını ve kök bölgesini parçalar — biz orman zeminini taklit ediyoruz. Anız ve ot örtüsü toprakta kalır, canlılık artar.</p>
  </div>
  </div>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
  <div style={{ position: "relative", height: 180 }}><Image src="/images/uretim-bicim.jpg" alt="Biçmeme — ot örtüsü" fill style={{ objectFit: "cover" }} sizes="(min-width:860px) 400px, 100vw" /></div>
  <div style={{ padding: 16 }}>
  <h3 className="doc-heading" style={{ fontSize: 15 }}>2 — Biçmiyoruz</h3>
  <p className="doc-body-text" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>Otları biçmiyoruz. Ot, rakibimiz değil; toprağın örtüsü, böceğin evi. Biçmek yerine yatırıyoruz — malç oluyor, nemi tutuyor, biyoçeşitliliği besliyor.</p>
  </div>
  </div>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16 }}>
  <h3 className="doc-heading" style={{ fontSize: 15 }}>3 — Kompost & Kompost Çayı</h3>
  <p className="doc-body-text" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>Dışarıdan gübre almıyoruz. Orman kompostu, kompost gübresi ve kompost çayı ile toprağı kendi bahçemizden besliyoruz. Mikroorganizma çoğalır, toprak kendi kendini besler.</p>
  <p className="doc-muted" style={{ marginTop: 8, fontSize: 11 }}>Mart–Nisan: kompost çayı uygulaması</p>
  </div>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16 }}>
  <h3 className="doc-heading" style={{ fontSize: 15 }}>4 — JADAM Killi Koruma</h3>
  <p className="doc-body-text" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>İlaç yerine JADAM killi koruma. Kimyasal zehir değil, kil ve doğal preparatlar — bitkiyi kapatır, zararlıyı uzak tutar. Dozunda, mevsiminde.</p>
  <p className="doc-muted" style={{ marginTop: 8, fontSize: 11 }}>Haziran: killi koruma öncesi gözlem</p>
  </div>
  </div>
  <div style={{ marginTop: 24, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 20 }}>
  <h3 className="doc-heading" style={{ fontSize: 16 }}>Organik sertifikalıyız — ama hikaye orada bitmiyor</h3>
  <p className="doc-body-text" style={{ marginTop: 8, fontSize: 14 }}>Sertifika tabanımız, ekoloji farkımız. Yazmadığımız yöntemi uygulamıyoruz. Her karttaki foto ve metin gerçektir, her sezon güncellenir.</p>
  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <Link href="/ciftlik" className="doc-btn doc-btn--ghost" style={{ fontSize: 12 }}>Çiftliği gör →</Link>
  <Link href="/emanet" className="doc-btn doc-btn--ghost" style={{ fontSize: 12 }}>Emanet ilkeleri →</Link>
  <a href="/images/sertifika.jpeg" target="_blank" rel="noopener noreferrer" className="doc-btn doc-btn--ghost" style={{ fontSize: 12 }}>Sertifika →</a>
  </div>
  </div>
 <a href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 24 }}>← Ana sayfaya dön</a>
 </div>
 </div>
 );
}
