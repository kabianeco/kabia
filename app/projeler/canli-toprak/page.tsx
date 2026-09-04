import Image from "next/image";
import "../../documentary.css";

export const metadata = { title: "Canlı Toprak Projesi — Kabia Ekolojik", description: "Kore Doğal Tarım IMO + JADAM kil ile canlı toprak. 946 ağaç." };

export default function CanliToprakPage() {
 return (
 <div className="doc-body">
 <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/projeler" className="doc-logo" style={{ marginBottom: 24, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <p className="doc-eyebrow">Project 01 — Canlı Toprak</p>
 <h1 className="doc-heading doc-heading--lg">Orman tabanından<br /><em>’ye canlı toprak.</em></h1>
 <p className="doc-lead" style={{ marginTop: 12 }}>Kore Doğal Tarım IMO kompostu + JADAM ultra-ince kil. Sentetik girdisiz, 946 Marinada ağacı için mikrobiyolojik zenginlik.</p>
 <figure className="doc-image" style={{ marginTop: 24 }}><Image src="/images/orchard-hillside.jpg" alt="Canlı toprak" width={2047} height={2048} /><figcaption className="doc-image__caption"><span>—</span> Orman toprağı IMO, Kılıçkaya Vadisi.</figcaption></figure>
 <div className="doc-philosophy" style={{ marginTop: 24 }}>
 <div className="doc-philosophy__card"><h3>IMO Kompostu</h3><p>Orman tabanından toplanan yerli mikroorganizmalar. 7 gün fermantasyon’de olgunlaşır.</p></div>
 <div className="doc-philosophy__card"><h3>JADAM Kil</h3><p>Ultra-ince kil + orman mikrobu. Yaprak nefes alsın, toprak korunsun.</p></div>
 </div>
 <p className="doc-muted" style={{ marginTop: 16 }}>Sierra Nevada’nın barley döngüsü gibi — bizde kompost → toprak → badem → kabuk → kompost.</p>
 <a href="/projeler" className="doc-btn doc-btn--ghost" style={{ marginTop: 24 }}>← Projelere dön</a>
 </div>
 </div>
 );
}
