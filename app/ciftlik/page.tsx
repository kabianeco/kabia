import Image from "next/image";
import { farmFacts } from "@/content/homepage";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/content/faqs";
import "../documentary.css";

export const metadata = { title: "Çiftlik — Kabia Ekolojik", description: "Kendi toprağımızdan. Sabırlar / Geyve / Sakarya — 946 badem ağacı, Marinada, organik." };

export default function CiftlikPage() {
  return (
  <div className="doc-body">
  <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.ciftlik.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }} />
  <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 64 }}>
  <a href="/" className="doc-logo" style={{ marginBottom: 32, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>

 <p className="doc-eyebrow">2021 · Geyve / Sakarya</p>
 <h1 className="doc-heading doc-heading--lg">Toprağa iyi bakarsanız,<br /><em>toprak da size iyi bakar.</em></h1>

 <div style={{ maxWidth: 720, marginTop: 24, display: "grid", gap: 18 }}>
 <h3 className="doc-heading" style={{ fontSize: 20 }}>Her şey bir badem ağacıyla başlamadı.</h3>
 <p className="doc-body-text">Toprağa başka türlü bakmaya karar vermekle başladı. 2021 yılında, Sakarya'nın Geyve ilçesinde, Kılıçkaya eteklerinde Kabia Ekolojik Çiftliği'ni kurduk. Bir bahçe kurmak istiyorduk. Ama yalnızca ağaçların büyüdüğü bir bahçe değil. Toprağın canlılığını koruyabildiğimiz, doğanın kendi döngülerini gözlemleyebildiğimiz ve ürettiğimiz gıdanın arkasında güvenle durabileceğimiz bir yer... Kabia böyle başladı.</p>
 </div>

 <div className="doc-facts" style={{ marginTop: 32 }}>
 {farmFacts.facts.map((f) => (
 <div key={f.label} className="doc-facts__item"><p className="doc-facts__label">{f.label}</p><p className="doc-facts__value">{f.value}</p></div>
 ))}
 </div>

 <div style={{ maxWidth: 720, marginTop: 40, display: "grid", gap: 24 }}>
  <div>
  <h3 className="doc-heading" style={{ fontSize: 20 }}>Önce toprağı düşündük.</h3>
  <p className="doc-body-text" style={{ marginTop: 8 }}>Çünkü bize göre tarımın başlangıcı bitki değil, <strong>topraktır.</strong> Toprak yalnızca köklerin tutunduğu bir zemin değildir. İçinde milyarlarca canlı organizmanın yaşadığı, köklerle mikroorganizmaların birbirleriyle ilişki kurduğu, suyun ve besinlerin sürekli hareket ettiği canlı bir ekosistemdir. Bu nedenle Kabia'da toprağı yalnızca verim almak için kullanmıyoruz. <strong>Onu beslemeye, korumaya ve canlılığını desteklemeye çalışıyoruz.</strong> Sürmeden, biçmeden, dış girdisiz ekolojik üretim modelimiz tam da bu yüzden doğdu — toprağı sterilize edilecek bir zemin değil, taklit edilecek bir orman gibi ele alıyoruz.</p>
  </div>
  <div>
  <h3 className="doc-heading" style={{ fontSize: 20 }}>Organik sertifikalıyız — ama hikâyemiz ekolojik.</h3>
  <p className="doc-body-text" style={{ marginTop: 8 }}>Kabia Ekolojik Çiftliği'nde kendi üretimimiz <strong>organik tarım sertifikalıdır.</strong> Bu bizim için yalnızca bir logo değildir — üretimin nasıl yapıldığı konusunda bize ve size karşı bir sorumluluktur. Organik tarımı bir <strong>temel</strong> olarak görüyoruz.</p>
  <p className="doc-body-text" style={{ marginTop: 12 }}>Bizim asıl modelimiz <strong>ekolojik üretim.</strong> Toprağı 5 yıldır sürmüyoruz, otları biçmiyoruz, organik sertifikalı olsa bile dışarıdan gübre almıyoruz. Beslemeyi orman kompostu, kompost çayı ve JADAM killi koruma gibi canlı toprak yöntemleriyle kendi bahçemizden sağlıyoruz. Çünkü biliyoruz ki Türkiye’de “organik” kelimesi yoruldu — biz sertifikanın ötesinde, toprağın canlılığını merkeze alan bir üretim anlatıyoruz.</p>
  <a href="/images/sertifika.jpeg" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 14, border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden", background: "var(--bg-card)" }}>
  <Image src="/images/sertifika.jpeg" alt="Organik Tarım Sertifikası — Kabia Ekolojik" width={1200} height={1600} style={{ width: "100%", height: "auto", display: "block" }} />
  </a>
  <p className="doc-muted" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>Organik Tarım Sertifikamız — büyütmek için tıklayın · Ekolojik üretim modelimiz sertifikanın ötesidir</p>
  </div>
 <div>
 <h3 className="doc-heading" style={{ fontSize: 20 }}>Badem bahçemiz</h3>
 <p className="doc-body-text" style={{ marginTop: 8 }}>Kabia'nın kalbinde badem bahçemiz var. Marinada badem ağaçlarımızla birlikte yıllardır mevsimleri takip ediyoruz. Çiçeklenmeyi. Arıları. Yağmuru. Rüzgârı. Soğuğu. Toprağın durumunu. Ve hasadı. Bir ağacın büyümesini izlemek bize sabretmeyi öğretti. <strong>Bir badem, bir yılın hikâyesidir.</strong></p>
 </div>
 <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 20 }}>
 <h3 className="doc-heading" style={{ fontSize: 18 }}>Doğayı kontrol edemeyiz. Ama onu dinleyebiliriz.</h3>
 <p className="doc-body-text" style={{ marginTop: 8, fontSize: 14 }}>Yağmurun ne zaman yağacağını biz belirleyemeyiz. Rüzgârı durduramayız. Bir arının bahçeye ne zaman geleceğini bilemeyiz. Ve bazen bir gecelik don, aylarca verdiğimiz emeği değiştirebilir. Biz bunu yaşadık. Bir sezon beklediğimiz hasadı alamadık. Zor bir dönemdi. Ama bize önemli bir şey öğretti: <strong>Tarım, doğaya karşı verilen bir mücadele değil. Doğayla birlikte üretmenin yollarını arama işi.</strong></p>
 </div>
 <div>
 <h3 className="doc-heading" style={{ fontSize: 20 }}>Yavaş büyüyen şeylere inanıyoruz.</h3>
 <p className="doc-body-text" style={{ marginTop: 8 }}>Bugün her şeyin daha hızlı olması bekleniyor. Biz ise toprağın ve ağacın kendi zamanına biraz daha yakın durmaya çalışıyoruz. Çünkü iyi bir toprağı bir gecede oluşturamazsınız. Güven de böyledir. Biz Kabia'yı da böyle büyütmek istiyoruz. <strong>Yavaş. Gerçek. Kalıcı.</strong></p>
 </div>
 <div>
 <h3 className="doc-heading" style={{ fontSize: 20 }}>Bugün ve gelecek</h3>
 <p className="doc-body-text" style={{ marginTop: 8 }}>2021'de başlayan yolculuğumuz devam ediyor. Badem bahçemiz büyüyor, toprağı daha iyi anlamaya çalışıyoruz. Yeni yöntemler deniyoruz. Ve çevremizde aynı değerlere inanan üreticilerle bağ kuruyoruz. Hayalimiz yalnızca kendi ürünlerimizi satmak değil — <strong>üretici ile tüketici arasında yeniden güven kurabilen bir yapı oluşturmak.</strong></p>
 </div>
 </div>

  <div style={{ display: "grid", gap: 18, marginTop: 32, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
  <figure className="doc-image"><Image src="/images/orchard-hillside.jpg" alt="Bahçe" width={2047} height={2048} /><figcaption className="doc-image__caption">— Badem ağaçları 3. yıl, Kılıçkaya yamaçları.</figcaption></figure>
  <figure className="doc-image"><Image src="/images/field-tractor.jpg" alt="Bakım" width={1200} height={1600} /><figcaption className="doc-image__caption">— Bakım bize ait. Budamadan hasada, her adım kendi ekibimizle, yerinde.</figcaption></figure>
  </div>
   <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
   <a href="/ureticiler/kabia-ciftligi" className="doc-btn doc-btn--ghost">Hikâyeyi oku →</a>
   <a href="/shop/kabuklu-badem" className="doc-btn doc-btn--primary">Mağazada gör →</a>
   <a href="/" className="doc-btn doc-btn--ghost">← Ana sayfaya dön</a>
   </div>
  </div>
  </div>
  );
}
