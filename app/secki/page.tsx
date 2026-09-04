import Image from "next/image";
import Link from "next/link";
import { PRODUCER_STORIES } from "@/content/producers";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/content/faqs";
import "../documentary.css";

export const metadata = { title: "Seçki — Kabia Ekolojik", description: "Tanıdığımız üreticilerden, güvendiğimiz ürünler. Ceviz, fındık, bal, ıhlamur." };

const SECKI_SLUGS = ["geyce-setce-findik", "ege-ceviz", "anadolu-bal", "akinci-ihlamur"];
const PRODUCT_MAP: Record<string, string> = {
  "geyce-setce-findik": "findik-ici",
  "ege-ceviz": "ceviz-ici",
  "anadolu-bal": "cicek-bali",
  "akinci-ihlamur": "ihlamur",
};
const PRODUCT_NAMES: Record<string, string> = {
  "geyce-setce-findik": "Kabuklu Fındık",
  "ege-ceviz": "Kabuklu Ceviz",
  "anadolu-bal": "Kılıçkaya Vadisi Balı",
  "akinci-ihlamur": "Doğal Ihlamur",
};

export default function SeckiPage() {
 const stories = PRODUCER_STORIES.filter((p) => SECKI_SLUGS.includes(p.slug));
 return (
  <div className="doc-body">
  <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.secki.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
  <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <p className="doc-eyebrow">KABİA SEÇKİ</p>
 <h1 className="doc-heading doc-heading--lg">Tanıdığımız üreticilerden,<br /><em>güvendiğimiz ürünler.</em></h1>
 <p className="doc-body-text" style={{ marginTop: 12, maxWidth: 600 }}>Kabia Seçki — bizim üretmediğimiz ama üreticisini tanıdığımız, üretim biçimine güvendiğimiz ürünler. Her ürünün üreticisi, bölgesi ve hikayesi açıkça yazılır.</p>
 <p className="doc-muted" style={{ marginTop: 8 }}>Kendimiz üretiyorsak anlatırız. Başkası üretiyorsa üreticisini anlatırız.</p>

 <div style={{ marginTop: 32 }}>
 <div className="doc-producers">
  {stories.map((p) => (
  <article key={p.slug} className="doc-producer">
  <div className="doc-producer__media">
  <Image src={p.image} alt={p.name} fill style={{ objectFit: "cover" }} sizes="(min-width:860px) 300px, 100vw" />
  <span className="doc-producer__badge">{p.badge}</span>
  </div>
  <div className="doc-producer__body">
  <h3 className="doc-producer__name">{p.region}</h3>
  <p className="doc-producer__region">{PRODUCT_NAMES[p.slug] ?? p.name}</p>
  {p.desc ? <p className="doc-producer__desc">{p.desc}</p> : null}
 <div className="doc-producer__meta">
 {p.tags.map((t) => (
 <span key={t} className="doc-tag">{t}</span>
 ))}
 </div>
 <p className="doc-muted" style={{ marginTop: 8, fontSize: 12 }}>{p.harvest}</p>
 </div>
 <div className="doc-producer__aside">
 <p className="doc-producer__harvest"><strong>{p.harvest}</strong></p>
  {p.note ? <p className="doc-producer__note">{p.note}</p> : null}
 <Link href={`/ureticiler/${p.slug}`} className="doc-journal__link" style={{ marginTop: 10, display: "inline-flex", fontSize: 12 }}>Hikâyeyi oku →</Link>
 <Link href={`/shop/${PRODUCT_MAP[p.slug]}`} className="doc-journal__link" style={{ marginTop: 6, display: "inline-flex", fontSize: 12, color: "var(--text-muted)" }}>Mağazada gör →</Link>
 </div>
 </article>
 ))}
 </div>
 </div>

 <a href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 32 }}>← Ana sayfaya dön</a>
 </div>
 </div>
 );
}
