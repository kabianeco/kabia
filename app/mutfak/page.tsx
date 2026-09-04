import { MutfakHikayeleri } from "@/components/documentary/mutfak-hikayeleri";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/content/faqs";
import "../documentary.css";

export const metadata = { title: "Mutfak — Kabia Ekolojik", description: "Üreticilerin mutfağından. Erişte, tarhana, sirke, salça, reçel." };

export default function MutfakPage() {
  return (
  <div className="doc-body">
  <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.mutfak.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
  <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <p className="doc-eyebrow">KABİA MUTFAK</p>
 <h1 className="doc-heading doc-heading--lg">Üreticilerin<br /><em>mutfağından.</em></h1>
 <p className="doc-body-text" style={{ marginTop: 12, maxWidth: 600 }}>Erişte, tarhana, sirke, salça, reçel — güvendiğimiz üreticilerin geleneksel mutfağından. Her ürünün üreticisi ve hikayesi görünür.</p>
 <p className="doc-muted" style={{ marginTop: 8 }}>Kendimiz üretiyorsak anlatırız. Başkası üretiyorsa üreticisini anlatırız.</p>
 <div style={{ marginTop: 32 }}>
 <MutfakHikayeleri />
 </div>
 <a href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 32 }}>← Ana sayfaya dön</a>
 </div>
 </div>
 );
}
