import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCER_STORIES } from "@/content/producers";
import "../../documentary.css";

export async function generateStaticParams() {
 return PRODUCER_STORIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const p = PRODUCER_STORIES.find((x) => x.slug === slug);
 if (!p) return {};
 return {
 title: `${p.name} — Kabia Ekolojik`,
 description: p.desc,
 };
}

export default async function ProducerStoryPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const p = PRODUCER_STORIES.find((x) => x.slug === slug);
 if (!p) notFound();

  return (
  <div className="doc-body">
  <div className="doc-wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>
  <Link href="/ureticiler" className="doc-logo" style={{ marginBottom: 24, display: "inline-flex", textDecoration: "none" }}>
  
  <span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span>
  </Link>

  <div style={{ position: "relative", height: 360, borderRadius: "var(--radius-card)", overflow: "hidden", marginTop: 12, border: "1px solid var(--border-color)" }}>
  <Image src={p.image} alt={p.name} fill style={{ objectFit: "cover" }} priority sizes="100vw" />
  <span className="doc-producer__badge" style={{ position: "absolute", left: 16, top: 16 }}>{p.badge}</span>
  </div>

 <p className="doc-eyebrow" style={{ marginTop: 24 }}>{p.region}</p>
 <h1 className="doc-heading doc-heading--lg" style={{ marginTop: 8 }}>{p.name}</h1>
 <p className="doc-body-text" style={{ marginTop: 12, maxWidth: 640 }}>{p.desc}</p>

  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
  {p.tags.map((t) => (
  <span key={t} className="doc-tag">{t}</span>
  ))}
  </div>

 <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border-color)", maxWidth: 680 }}>
 <p style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontStyle: "italic", color: "var(--primary-accent)", margin: 0 }}>“{p.quote}”</p>
  <p className="doc-body-text" style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{p.story}</p>
  {p.story.includes("PLACEHOLDER") && (
  <p className="doc-muted" style={{ marginTop: 16, fontSize: 11 }}>PLACEHOLDER — bu metin gerçek insan hikâyesi ile değiştirilecek.</p>
  )}
 </div>

 <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
 <Link href="/ureticiler" className="doc-btn doc-btn--ghost">← Tüm üreticiler</Link>
 <Link href="/magaza" className="doc-btn doc-btn--primary">Mağazaya git →</Link>
 </div>
 </div>
 </div>
 );
}
