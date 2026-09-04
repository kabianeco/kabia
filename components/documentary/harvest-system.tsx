"use client";

import Image from "next/image";
import Link from "next/link";
import { PRODUCER_STORIES } from "@/content/producers";

type Producer = (typeof PRODUCER_STORIES)[number] & { organic: boolean };

const MUTFAK_SLUGS = new Set(["domates-salcasi", "elma-sirkesi", "eriste", "tarhana"]);
const PRODUCERS: Producer[] = PRODUCER_STORIES.filter((p) => !MUTFAK_SLUGS.has(p.slug)).map((p) => ({
  ...p,
  organic: p.slug === "kabia-ciftligi",
}));

const PRODUCER_PRODUCT_MAP: Record<string, string> = {
  "kabia-ciftligi": "kabuklu-badem",
  "geyce-setce-findik": "findik-ici",
  "ege-ceviz": "ceviz-ici",
  "anadolu-bal": "cicek-bali",
  "akinci-ihlamur": "ihlamur",
};

const PRODUCER_PRODUCT_NAMES: Record<string, string> = {
  "kabia-ciftligi": "Kabuklu Badem",
  "geyce-setce-findik": "Kabuklu Fındık",
  "ege-ceviz": "Kabuklu Ceviz",
  "anadolu-bal": "Kılıçkaya Vadisi Balı",
  "akinci-ihlamur": "Doğal Ihlamur",
};

export function HarvestSystem({ only }: { only?: "ciftlik" | "secki" } = {}) {
  const filtered = only === "ciftlik" ? PRODUCERS.filter((p) => p.slug === "kabia-ciftligi") : only === "secki" ? PRODUCERS.filter((p) => p.slug !== "kabia-ciftligi") : PRODUCERS;
  return (
  <div className="doc-producers">
  {filtered.map((p) => (
 <article key={p.slug} className="doc-producer">
 <div className="doc-producer__media">
 <Image src={p.image} alt={p.name} fill style={{ objectFit: "cover" }} sizes="(min-width:860px) 300px, 100vw" />
 <span className={`doc-producer__badge ${p.organic ? "doc-producer__badge--organic" : ""}`}>{p.badge}</span>
 </div>
  <div className="doc-producer__body">
  {p.slug === "kabia-ciftligi" ? (
  <>
  <h3 className="doc-producer__name">{p.name}</h3>
  <p className="doc-producer__region">{PRODUCER_PRODUCT_NAMES[p.slug] ?? p.region}</p>
  </>
  ) : (
  <>
  <h3 className="doc-producer__name">{p.region}</h3>
  <p className="doc-producer__region">{PRODUCER_PRODUCT_NAMES[p.slug] ?? p.name}</p>
  </>
  )}
  {p.desc ? <p className="doc-producer__desc">{p.desc}</p> : null}
 <div className="doc-producer__meta">
 {p.tags.map((t) => (
 <span key={t} className="doc-tag">
 {t}
 </span>
 ))}
 </div>
  {p.harvest ? <p className="doc-muted" style={{ marginTop: 8, fontSize: 12 }}>{p.harvest}</p> : null}
  </div>
  <div className="doc-producer__aside">
  {p.harvest ? (
  <p className="doc-producer__harvest">
  <strong>{p.harvest}</strong>
  </p>
  ) : null}
  {p.note ? <p className="doc-producer__note">{p.note}</p> : null}
 <Link href={`/ureticiler/${p.slug}`} className="doc-journal__link" style={{ marginTop: 10, display: "inline-flex", fontSize: 12 }}>
 Hikâyeyi oku →
 </Link>
 <Link
 href={`/shop/${PRODUCER_PRODUCT_MAP[p.slug] ?? p.slug}`}
 className="doc-journal__link"
 style={{ marginTop: 6, display: "inline-flex", fontSize: 12, color: "var(--text-muted)" }}
 >
 Mağazada gör →
 </Link>
 </div>
 </article>
 ))}
 </div>
 );
}
