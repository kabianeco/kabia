import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/content/faqs";
import "../documentary.css";

export const metadata = { title: "Emanet — Kabia Ekolojik", description: "Toprağı emanet gibi görüyoruz. Emanet ilkeleri, toprak notları ve rakamlarla: dış girdi yok, sürüm yok, biçim yok." };

const RAKAMLAR = [
  { value: "946", label: "Marinada ağacı" },
  { value: "0", label: "Dış girdi — sertifikalı gübre bile yok" },
  { value: "5 yıl", label: "Sürülmeden, biçilmeden" },
];

const ILKELER = [
  "Önce toprak, sonra ağaç.",
  "Toprağı sürmüyoruz.",
  "Otları biçmiyoruz.",
  "Dışarıdan girdi yok — organik sertifikalı bile olsa gübre almıyoruz.",
  "Tüm girdiler doğadan ve kendi bahçemizden: kompost, kompost gübresi, kompost çayı.",
  "Doğayı kontrol etmiyoruz, taklit ediyoruz.",
  "Her paket hasat tarihli — ne zaman, nereden, kimden.",
];

const NOTLAR = [
  {
    year: "2021",
    text: "Toprağı devraldık. Yorgundu, biz acemiydik. İlk yıl sadece gözlem: ne yetişiyor, ne eksik, ne yaşıyor bu toprakta.",
  },
  {
    year: "2022",
    text: "Sürümü bıraktık. Toprağın yapısını bozmamayı öğrendik. Orman kompostu ilk kez bahçeye girdi.",
  },
  {
    year: "2023",
    text: "Kompost çayı uygulamaları başladı. Otu artık düşman değil, örtü olarak gördük — biçmeyi bıraktık.",
  },
  {
    year: "2024",
    text: "JADAM killi koruma ve canlı toprak kültürü oturdu. Toprak gözle değişti: daha koyu, daha nemli, daha canlı.",
  },
  {
    year: "2025",
    text: "Don vurdu. Beklediğimiz hasadı alamadık. Ama toprak dinlendi, biz dinledik. Emanete saygı bazen üretmemeyi de bilmektir.",
  },
  {
    year: "2026",
    text: "Yeni sezon. Notlarımız hazır: kompost sıraları, çay takvimi, çiçeklenme gözlemleri. Bu yılın hasadı, bu notlarla başlıyor.",
  },
];

export default function EmanetPage() {
  return (
  <div className="doc-body">
  <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.emanet.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
  <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
  <Link href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex", textDecoration: "none" }}>
  <span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span>
  </Link>

  <p className="doc-eyebrow">EMANET</p>
  <h1 className="doc-heading doc-heading--lg">Toprağı emanet<br /><em>gibi görüyoruz.</em></h1>
  <p className="doc-lead" style={{ marginTop: 12, maxWidth: 640 }}>Bu toprak bize ait değil. Bizden sonrakilere bırakacağımız bir emanet. Hızlı değil, doğru ve kalıcı üretmek — her hasat bir sonraki yılın toprağına bırakılan nottur.</p>

  <div style={{ position: "relative", height: 360, borderRadius: "var(--radius-card)", overflow: "hidden", marginTop: 24, border: "1px solid var(--border-color)" }}>
  <Image src="/images/valley-ridge.jpg" alt="Kılıçkaya Vadisi — emanet" fill style={{ objectFit: "cover" }} sizes="100vw" />
  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.32), transparent 60%)" }} />
  <p style={{ position: "absolute", left: 16, bottom: 12, margin: 0, fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.14em", color: "white" }}>Kılıçkaya Vadisi · Geyve</p>
  </div>

  <div style={{ maxWidth: 720, marginTop: 40 }}>
  <p className="doc-body-text">Biz toprağın sahibi olduğumuza değil, ona bir süreliğine eşlik ettiğimize inanıyoruz.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Bugün üzerinde üretim yaptığımız toprak, bizden önce de vardı; bizden sonra da var olacak. Bu yüzden toprağı yalnızca ürün yetiştirdiğimiz bir kaynak olarak değil, bizden sonraki nesillere bırakacağımız bir emanet olarak görüyoruz.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Kabia’da üretimin ölçüsü yalnızca bu yıl aldığımız ürün miktarı değil. Asıl mesele, bugün üretirken toprağın yarın ne durumda olacağı.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Daha fazla ürün uğruna toprağı yormak, onu dışarıdan sürekli beslemeye bağımlı hâle getirmek ya da canlılığını azaltmak bize göre gerçek bir üretim değildir. Biz hızlı olanı değil, doğru olanı ve kalıcı olanı arıyoruz.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Toprağın içinde görünmeyen ama bütün yaşamı taşıyan bir dünya olduğuna inanıyoruz. Mikroorganizmalar, mantarlar, kökler, böcekler, yabani otlar, su ve organik madde… Hepsi aynı döngünün parçası. Bu nedenle toprağı sterilize edilmesi gereken bir zemin değil, yaşayan bir ekosistem olarak ele alıyoruz.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Her uygulamamızda kendimize aynı soruyu soruyoruz:</p>
  <p className="doc-body-text" style={{ marginTop: 6, fontStyle: "italic", fontWeight: 500, color: "var(--text-heading)" }}>“Bunu bugün yaptığımızda, yarının toprağına ne bırakıyoruz?”</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Çünkü bizim için her hasat yalnızca topladığımız ürün değildir. Aynı zamanda bir sonraki yılın toprağına bıraktığımız bir nottur.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Kabia’nın amacı toprağı tüketerek üretmek değil; toprakla birlikte üretmek.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Bugünün verimini, yarının bereketinden çalmadan elde edebilmek.<br />Toprağın organik maddesini, canlılığını ve üretme gücünü korumak.<br />Suya, ağaca, canlılara ve mevsimlerin doğal ritmine mümkün olduğunca saygı göstermek.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Belki bu yol daha yavaş.<br />Belki her zaman en yüksek verimi vaat etmiyor.<br />Ama bizce iyi tarımın gerçek ölçüsü, bir tarladan bugün ne kadar aldığınız değil; yarın orada ne bırakabildiğinizdir.</p>
  <p className="doc-body-text" style={{ marginTop: 14 }}>Çünkü toprak bize miras kalmadı.</p>
  <p className="doc-body-text" style={{ marginTop: 2, fontWeight: 600, color: "var(--text-heading)" }}>Biz onu gelecekten ödünç aldık.</p>
  </div>
  <div style={{ maxWidth: 720, marginTop: 40 }}>
  <p className="doc-eyebrow">RAKAMLARLA EMANET</p>
  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 14 }}>
  {RAKAMLAR.map((r) => (
  <div key={r.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", padding: 18 }}>
  <p style={{ fontFamily: "var(--font-heading)", fontSize: 28, margin: 0, color: "var(--primary-accent)" }}>{r.value}</p>
  <p className="doc-muted" style={{ marginTop: 6, fontSize: 12 }}>{r.label}</p>
  </div>
  ))}
  </div>
  </div>

  <div style={{ maxWidth: 720, marginTop: 40 }}>
  <p className="doc-eyebrow">EMANET İLKELERİ</p>
  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", padding: "24px 24px 20px", marginTop: 14 }}>
  <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 14 }}>
  {ILKELER.map((ilke, i) => (
  <li key={ilke} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
  <span style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", color: "var(--primary-accent)", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
  <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-body)" }}>{ilke}</span>
  </li>
  ))}
  </ol>
  <p className="doc-muted" style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-color)", fontSize: 11 }}>Kabia Ekolojik · Sabırlar Köyü, Kılıçkaya Vadisi, Geyve</p>
  </div>
  </div>

  <div style={{ maxWidth: 720, marginTop: 40 }}>
  <p className="doc-eyebrow">TOPRAK NOTLARI</p>
  <h2 className="doc-heading" style={{ fontSize: 24, marginTop: 10 }}>Her hasat, bir sonraki<br />yılın toprağına bırakılan nottur.</h2>
  <div style={{ marginTop: 20, display: "grid", gap: 0 }}>
  {NOTLAR.map((n) => (
  <div key={n.year} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--border-color)" }}>
  <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 600, color: n.year === "2025" ? "var(--secondary-accent)" : "var(--primary-accent)" }}>{n.year}</span>
  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--text-body)" }}>{n.text}</p>
  </div>
  ))}
  </div>
  </div>

  <div style={{ maxWidth: 720, marginTop: 40 }}>
  <h2 className="doc-heading doc-heading--lg" style={{ fontSize: 26, lineHeight: 1.25, color: "var(--text-heading)" }}>2025 yılında yaşadığımız <em style={{ color: "var(--secondary-accent)", fontStyle: "italic" }}>doğal afet niteliğindeki don olayı</em> bize ne öğretti?</h2>
  <p className="doc-body-text" style={{ marginTop: 8 }}>2025 Mart’ında 4 gün süren şiddetli don, aylarca emek verdiğimiz hasadı bir gecede aldı. Bahçeye çıktığımız o sabah, her şey sessizdi. Zordu — saklamadık, abartmadık da. O yıl sepete koyacak ürünümüz olmadı. Ama toprak dinlendi, biz de durup dinlemeyi öğrendik. O kış bize şunu fısıldadı: kontrol edemeyiz, ama dinleyebiliriz. Emanete sadakat, bazen hiç hasat yapmamayı da göze almaktır.</p>
  </div>
  <div style={{ maxWidth: 720, marginTop: 40 }}>
  <p className="doc-eyebrow">SIKÇA SORULANLAR</p>
  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
  {faqs.emanet.map((f) => (
  <details key={f.q} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "14px 18px" }}>
  <summary style={{ fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text-heading)", listStyle: "none" }}>{f.q}</summary>
  <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: "var(--text-body)" }}>{f.a}</p>
  </details>
  ))}
  </div>
  </div>
  <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
  <Link href="/ciftlik" className="doc-btn doc-btn--ghost">Çiftliği gör →</Link>
  <Link href="/magaza" className="doc-btn doc-btn--primary">Hasat Listesini gör →</Link>
  </div>

  <Link href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 24 }}>← Ana sayfaya dön</Link>
  </div>
  </div>
  );
}
