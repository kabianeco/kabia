import Link from "next/link";
import { HarvestSystem } from "@/components/documentary/harvest-system";
import { MutfakHikayeleri } from "@/components/documentary/mutfak-hikayeleri";
import "../documentary.css";

export const metadata = { title: "Üreticiler — Kabia Ekolojik", description: "Tüm üreticiler: Kabia Çiftliği, Seçki ve Mutfak. Tanıdığımız üretim, izlenebilir." };

export default function UreticilerPage() {
  return (
    <div className="doc-body">
      <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
        <Link href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></Link>
        <p className="doc-eyebrow">ÜRETİCİLER</p>
        <h1 className="doc-heading doc-heading--lg">Tüm üreticiler<br /><em>tek bir yerde.</em></h1>
        <p className="doc-body-text" style={{ marginTop: 12, maxWidth: 600 }}>Kabia Çiftliği, Seçki ve Mutfak — tanıdığımız, üretim yerini bildiğimiz herkes burada. Hikâyesiyle, hasadıyla.</p>

        <div style={{ marginTop: 32 }}>
          <p className="doc-eyebrow">KABİA ÇİFTLİĞİ</p>
          <div style={{ marginTop: 14 }}><HarvestSystem only="ciftlik" /></div>
        </div>

        <div style={{ marginTop: 40 }}>
          <p className="doc-eyebrow">KABİA SEÇKİ</p>
          <div style={{ marginTop: 14 }}><HarvestSystem only="secki" /></div>
        </div>

        <div style={{ marginTop: 40 }}>
          <p className="doc-eyebrow">KABİA MUTFAK</p>
          <div style={{ marginTop: 14 }}><MutfakHikayeleri /></div>
        </div>

        <Link href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 32 }}>← Ana sayfaya dön</Link>
      </div>
    </div>
  );
}
