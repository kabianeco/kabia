"use client";

import Image from "next/image";
import Link from "next/link";

type KitchenStory = {
 slug: string;
 name: string;
 region: string;
 badge: string;
 image: string;
 desc: string;
 tags: string[];
 season: string;
 price: string;
 note: string;
};

const KITCHEN_STORIES: KitchenStory[] = [
 {
  slug: "domates-salcasi",
  name: "Domates Salçası",
  region: "Geyve — Mevsiminde",
  badge: "MUTFAK · Geleneksel",
  image: "/images/domates1.jpeg",
 desc: "Mevsiminde olgunlaşan domatesler, güneşte ağır ağır kurutulur. Katkısız, sadece tuz ve emek. Geleneksel yöntem, cam kavanozda.",
 tags: ["Güneşte kurutma", "Cam kavanoz", "Katkısız"],
 season: "Yaz Hasadı — Ağustos",
 price: "450g · ₺180",
 note: "Elde doğranmış, taş fırın yüzeyinde.",
 },
  {
  slug: "elma-sirkesi",
  name: "Elma Sirkesi",
  region: "Geyve — Doğal Fermentasyon",
  badge: "MUTFAK · Geleneksel",
  image: "/images/orchard-hillside.jpg",
  desc: "Geyve'nin elmalarından, annelerimizin yaptığı gibi. Doğal fermentasyon, filtre edilmez, tortulu. 6 ay dinlendirilir.",
  tags: ["Doğal fermentasyon", "Tortulu", "6 ay"],
  season: "Dört mevsim — Sabırla",
  price: "500ml · ₺150",
  note: "Annesinin sirkesi, torunun lezzeti.",
  },
  {
  slug: "alic-sirkesi",
  name: "Alıç Sirkesi",
  region: "Geyve — Doğal Fermentasyon",
  badge: "MUTFAK · Geleneksel",
  image: "/images/alic1.jpeg",
  desc: "Geyve alıçlarından, elma sirkesi gibi — buruk, derin, tortulu. 6 ay dinlendirilir.",
  tags: ["Doğal fermentasyon", "Tortulu", "6 ay"],
  season: "Dört mevsim — Sabırla",
  price: "500ml · ₺160",
  note: "Alıç sirkesi, 6 ay sabır.",
  },
 {
 slug: "eriste",
 name: "Erişte",
 region: "Geyve — Elde Kesme",
 badge: "MUTFAK · Geleneksel",
 image: "/images/field-tractor.jpg",
 desc: "Un, yumurta ve tuz. Ovalarda kurutulan yufka, elle kesilir. Makine yok, acele yok. Geleneksel mutfakta hazırlanan erişte.",
 tags: ["Elde kesme", "Güneşte kurutma", "Yumurtalı"],
 season: "Sonbahar — Ekim",
 price: "500g · ₺140",
 note: "Makine yok, elle kesme, doğal kurutma.",
 },
 {
 slug: "tarhana",
 name: "Tarhana",
 region: "Geyve — Geleneksel",
 badge: "MUTFAK · Geleneksel",
 image: "/images/almonds-drying.jpg",
 desc: "Domates, biber, yoğurt ve un. Geleneksel tarhana fermantasyonu, 3-4 gün doğal süreç. Sonra güneşte kurutulur, elle kırılır.",
 tags: ["Fermantasyon", "Güneşte kurutma", "Elle kırma"],
 season: "Sonbahar — Ekim-Kasım",
 price: "500g · ₺160",
 note: "3 gün fermentasyon, sonra güneş ve zaman.",
 },
];

const KITCHEN_PRODUCT_MAP: Record<string, string> = {
  "domates-salcasi": "domates-salcasi",
  "elma-sirkesi": "elma-sirkesi",
  "alic-sirkesi": "alic-sirkesi",
  "eriste": "eriste",
  "tarhana": "tarhana",
};

export function MutfakHikayeleri() {

 return (
 <div className="doc-producers">
 {KITCHEN_STORIES.map((story) => (
 <article key={story.slug} className="doc-producer">
 <div className="doc-producer__media">
 <Image
 src={story.image}
 alt={story.name}
 fill
 style={{ objectFit: "cover" }}
 sizes="(min-width:860px) 300px, 100vw"
 />
 <span className="doc-producer__badge">{story.badge}</span>
 </div>
 <div className="doc-producer__body">
 <h3 className="doc-producer__name">{story.name}</h3>
 <p className="doc-producer__region">{story.region}</p>
 <p className="doc-producer__desc">{story.desc}</p>
 <div className="doc-producer__meta">
 {story.tags.map((t) => (
 <span key={t} className="doc-tag">
 {t}
 </span>
 ))}
 </div>
 <p className="doc-muted" style={{ marginTop: 8, fontSize: 12 }}>{story.season}</p>
 </div>
 <div className="doc-producer__aside">
 <p className="doc-producer__harvest">
 <strong>{story.season}</strong>
 </p>
  {story.note ? <p className="doc-producer__note">{story.note}</p> : null}
 <Link
 href={`/ureticiler/${story.slug}`}
 className="doc-journal__link"
 style={{ marginTop: 10, display: "inline-flex", fontSize: 12 }}
 >
 Hikâyeyi oku →
 </Link>
 <Link
 href={`/shop/${KITCHEN_PRODUCT_MAP[story.slug]}`}
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
