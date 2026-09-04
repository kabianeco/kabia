import Image from "next/image";
import "../../documentary.css";

export const metadata = { title: "Tozlayıcı Projesi — Kabia Ekolojik", description: "Otlar biçilmez, sürülmez — arı ve biyoçeşitlilik için." };

export default function TozlayiciPage() {
 return (
 <div className="doc-body">
 <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/projeler" className="doc-logo" style={{ marginBottom: 24, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
 <p className="doc-eyebrow">Project 02 — Tozlayıcı</p>
 <h1 className="doc-heading doc-heading--lg">Otlar biçilmez,<br /><em>arı çalışır.</em></h1>
 <p className="doc-lead" style={{ marginTop: 12 }}>Sürümsüz tarım — otlar örtü, böcekler işçi. biyoçeşitlilik gözlemi, Flamingo’nun Melipona arısı gibi.</p>
 <figure className="doc-image" style={{ marginTop: 24 }}><Image src="/images/field-tractor.jpg" alt="Biyoçeşitlilik" width={1200} height={1600} /><figcaption className="doc-image__caption"><span>—</span> Yer örtücüler ve tozlayıcılar — biçmeden, zehirsiz.</figcaption></figure>
 <div className="doc-philosophy" style={{ marginTop: 24 }}>
 <div className="doc-philosophy__card"><h3>Yer Örtücü</h3><p>Otlar sürülmez, toprağı örter, nemi tutar.</p></div>
 <div className="doc-philosophy__card"><h3>Tozlayıcı</h3><p>Arı ve böcek için çiçek şeridi, kimyasal yok.</p></div>
 </div>
 <a href="/projeler" className="doc-btn doc-btn--ghost" style={{ marginTop: 24 }}>← Projelere dön</a>
 </div>
 </div>
 );
}
