import Image from "next/image";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPublicPostList } from "@/lib/blog/queries";
import "../documentary.css";

export const metadata = { title: "Çiftlikten — Kabia Ekolojik", description: "Kabia’nın yaşayan günlüğü. Bahçeden gelişmeler, hasat, çiçeklenme, toprak notları." };

export default async function CiftliktenPage() {
 const supa = await createSupabaseServerClient();
 const res = await fetchPublicPostList(supa, { page: 1, perPage: 12 });
 const posts = res.status === "ok" ? res.items : [];
 return (
 <div className="doc-body">
 <div className="doc-wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
 <a href="/" className="doc-logo" style={{ marginBottom: 24, display: "inline-flex" }}><span className="doc-logo__word">KABİA <span>EKOLOJİK</span></span></a>
  <p className="doc-eyebrow">ÇİFTLİKTEN — YAŞAYAN GÜNLÜK</p>
  <h1 className="doc-heading doc-heading--lg">Bahçeden<br /><em>notlar.</em></h1>
   <p className="doc-body-text" style={{ marginTop: 12, maxWidth: 640 }}>Hasadın sessizliği, çiçeklenmenin ilk izi, toprağın canlanışı, üreticinin emeği — yalnızca iz bırakmaya değer anlar paylaşılır. Her gün değil, anlatmaya değer olduğunda. Burası bir takvim değil, tarlanın tuttuğu günlük.</p>

  <article style={{ marginTop: 32, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
  <div style={{ position: "relative", background: "var(--bg-card)" }}>
  <Image src="/images/resim22.jpg" alt="2019 Kasım — Bahçe kurulmadan önce, Sabırlar" width={1600} height={1200} style={{ width: "100%", height: "auto", display: "block" }} />
  <span style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--text-muted)" }}>2019 KASIM · KURULMADAN ÖNCE</span>
  </div>
  <div style={{ padding: 22 }}>
  <p className="doc-eyebrow">2019 KASIM — OLMAZ DENİLENİ YAPMAK</p>
  <h2 className="doc-heading" style={{ fontSize: 22, marginTop: 6 }}>Burada badem olmaz dediler. Biz toprağa kulak verdik.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>2019 Kasım, Sabırlar. Hasat sonrası anızda tek bir meşe, uzakta kavaklar. Boş sanılan bu yamaç için “burada badem tutmaz” deniyordu. Bizim niyetimiz yapılmayanı denemekti — verim cetveline değil, toprağın kendi hafızasına güvenmek. O gün anızın üzerine düşen gölgemizle ilk kez sürmeye değil, dinlemeye geldik.</p>
  <p className="doc-body-text" style={{ marginTop: 10 }}>O kışı analize, rüzgara ve don çukurlarını öğrenmeye ayırdık. Bir yıl boyunca tek bir fidan dikmeden yalnızca gözlemledik. Çünkü Kabia’da hikaye fidanla değil, toprakla başlar. Bu sessiz tarla iki yıl sonra 946 Marinada ile tanışacaktı — cesaret o gün, bu anızda filizlendi.</p>
  </div>
  </article>

  <article style={{ marginTop: 24, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
  <div style={{ position: "relative", background: "var(--bg-card)" }}>
  <Image src="/images/marina-ilk-dikim.jpeg" alt="2021 Temmuz — 946 Marinada fidan dikimi" width={1600} height={1200} style={{ width: "100%", height: "auto", display: "block" }} />
  <span style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--primary-accent)", fontWeight: 600 }}>2021 TEMMUZ · İLK DİKİM</span>
  </div>
  <div style={{ padding: 22 }}>
  <p className="doc-eyebrow">2021 TEMMUZ — 946 FİDAN TOPRAKLA BULUŞTU</p>
  <h2 className="doc-heading" style={{ fontSize: 22, marginTop: 6 }}>946 çukur, 946 söz.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>2019’da dinlediğimiz o boş yamaç, iki yaz sonra Temmuz sıcağında tek tek can buldu. Her çukur elle açıldı, her Marinada kökleri incitmeden yerleştirildi, can suyu aynı gün verildi. “Olmaz” denilen yamaç, o gün ilk kez bahçe oldu.</p>
  <p className="doc-body-text" style={{ marginTop: 10 }}>O yaz suyu değil, sabrı konuştuk. Tutmayan fidanı gece suladık, tutanı sessizce izledik. 946 fidan aynı anda büyümedi — kimi erken uyandı, kimi bir mevsim bekledi. Ama hepsi aynı toprağı paylaştı, aynı rüzgarı duydu. Bu dikim bir hasat değil, bir emanetin toprağa bırakılışıydı.</p>
  </div>
  </article>

  <article style={{ marginTop: 24, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
  <div style={{ position: "relative", background: "var(--bg-card)" }}>
  <Image src="/images/marinada-2022.jpeg" alt="2022 Mayıs — Bahçenin genel görünümü, Kılıçkaya" width={1600} height={1200} style={{ width: "100%", height: "auto", display: "block" }} />
  <span style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--primary-accent)", fontWeight: 600 }}>2022 MAYIS · BİR YIL SONRA</span>
  </div>
  <div style={{ padding: 22 }}>
  <p className="doc-eyebrow">2022 MAYIS — BAHÇE UYANDI</p>
  <h2 className="doc-heading" style={{ fontSize: 22, marginTop: 6 }}>Bir kış sonra, yamaç yeşile durdu.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>Temmuz’un çelimsiz fidanları bir kışı atlatıp Mayıs’ta taze sürgün verdi. Önde tek bir Marinada, arkasında sıra sıra genç ağaçlar — hepsi kazıklarında, rüzgarla birlikte salınıyor. Altlarında biçmediğimiz otlar ve ilk kır çiçekleri: örtüyü korumanın, toprağa emaneti hatırlatmanın sessiz ödülü.</p>
  <p className="doc-body-text" style={{ marginTop: 10 }}>O bahar hiçbir fidanın yerini değiştirmedik. Sadece izledik. Hangisinin erken uyandığını, hangisinin rüzgarda yattığını not ettik. Bahçe bize acele etmemeyi öğretiyordu — bir yıl sonra artık boş bir tarla değil, nefes alan bir yamaç vardı Kılıçkaya’da.</p>
  </div>
  </article>

  <article style={{ marginTop: 24, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
  <div style={{ position: "relative", background: "var(--bg-card)" }}>
  <Image src="/images/marinada-2023.jpeg" alt="2023 Temmuz — 2. yılda Marinada gelişimi" width={1600} height={1200} style={{ width: "100%", height: "auto", display: "block" }} />
  <span style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--primary-accent)", fontWeight: 600 }}>2023 TEMMUZ · İKİNCİ YAZ</span>
  </div>
  <div style={{ padding: 22 }}>
  <p className="doc-eyebrow">2023 TEMMUZ — AĞAÇ KENDİNİ GÖSTERDİ</p>
  <h2 className="doc-heading" style={{ fontSize: 22, marginTop: 6 }}>İki yaz sonra, dal sürgün verdi.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>Temmuz 2023, ikinci yaz. Önde tek bir Marinada artık çelimsiz değil — boy verdi, yan dallar açtı, yaprakları rüzgarla birlikte gölge yapıyor. Altında yine biçmediğimiz otlar, bu kez mavi ve sarı kır çiçekleriyle karışık. Arkada sıra sıra diğer ağaçlar da aynı ritimde, biri erken, biri geç ama hepsi ayakta.</p>
  <p className="doc-body-text" style={{ marginTop: 10 }}>O yaz ilk kez budamayı değil, dallanmayı konuştuk. Hangi dalın güneşi gördüğünü, hangisinin gölgede kaldığını izledik. Toprak artık daha koyu, daha nemli, daha canlı — orman kompostu ve kompost çayının izi. Bahçe bize şunu hatırlattı: ağaç acele etmez, kök zaman ister.</p>
  </div>
  </article>

  <article style={{ marginTop: 24, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
  <div style={{ position: "relative", background: "var(--bg-card)" }}>
  <Image src="/images/marinada-2024.jpeg" alt="2024 Ocak — Kış günü, bahçe uykuda" width={1600} height={1200} style={{ width: "100%", height: "auto", display: "block" }} />
  <span style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--text-muted)" }}>2024 OCAK · KIŞ UYKUSU</span>
  </div>
  <div style={{ padding: 22 }}>
  <p className="doc-eyebrow">2024 OCAK — BAHÇE UYKUDA</p>
  <h2 className="doc-heading" style={{ fontSize: 22, marginTop: 6 }}>Kar altında, sabır çalışır.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>Ocak 2024, Kılıçkaya bembeyaz. 946 Marinada karın altında usul usul bekliyor — dalları çıplak ama kökleri sıcak. Toprak donmuyor, çünkü yıllardır sürmediğimiz, biçmediğimiz o örtü karı koynunda tutuyor. Tepede sis, yamaçta sadece bizim ayak izlerimiz ve sessizlik.</p>
  <p className="doc-body-text" style={{ marginTop: 10 }}>Dışarıdan bakan “kışın ne işin var bahçede” der. Var. Eğilen kazığı düzeltmek, karın yükünü hafifletmek, sessizce kontrol etmek. Eller üşür ama içimiz sıcaktır. Çünkü biliriz — ağaç uyurken bile kök çalışır. Bahçe en çok kışın öğretir: hiçbir şey yokmuş gibi görünen o bembeyazlıkta, aslında bir sonraki bahar usul usul hazırlanır. Biz de toprak gibi bekleriz, acele etmeden.</p>
  </div>
  </article>

  <article style={{ marginTop: 24, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
  <div style={{ position: "relative", background: "var(--bg-card)" }}>
  <Image src="/images/marinada-2025-ilkcicek.jpeg" alt="2025 Mart — Erken uyanan bahçe, ilk çiçekler" width={1600} height={1200} style={{ width: "100%", height: "auto", display: "block" }} />
  <span style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--text-muted)" }}>2025 MART · ERKEN BAHAR</span>
  </div>
  <div style={{ padding: 22 }}>
  <p className="doc-eyebrow">2025 MART — DOĞA ERKEN UYANDI</p>
  <h2 className="doc-heading" style={{ fontSize: 22, marginTop: 6 }}>Hava sıcaktı, bahçe sabredemedi.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>Mart 2025, hava normalden sıcaktı. Kılıçkaya’da kış erken çekildi, bahçe erken uyandı. Önde tek bir Marinada bembeyaz çiçeklerle kaplı — arkasında sıra sıra diğerleri, hepsi aynı heyecanla. Yamaç bir anda gelin gibi açtı.</p>
  <p className="doc-body-text" style={{ marginTop: 10 }}>O çiçekleri görünce hem sevindik hem içimiz burkuldu. Çünkü biliyorduk — erken uyanan bahçe, ayaza daha açıktır. Yine de o anı sevdik. Bademin çiçeği narindir, bir rüzgar ister, bir arı bekler. Biz de bekledik, sessizce. Doğa acele ettirmişti, biz ona eşlik ettik — endişeyle, umutla, içten içe.</p>
  </div>
  </article>

  <article style={{ marginTop: 24, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-card)", overflow: "hidden" }}>
  <div style={{ position: "relative", background: "var(--bg-card)" }}>
  <Image src="/images/marinada-2025-don.jpeg" alt="2025 18 Mart — 4 gün süren don, çiçekte yakalandı" width={1600} height={1200} style={{ width: "100%", height: "auto", display: "block" }} />
  <span style={{ position: "absolute", left: 14, top: 14, background: "rgba(255,255,255,0.92)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 10px", fontFamily: "var(--font-label)", fontSize: 9, letterSpacing: "0.08em", color: "var(--secondary-accent)", fontWeight: 600 }}>18 MART 2025 · DON</span>
  </div>
  <div style={{ padding: 22 }}>
  <p className="doc-eyebrow">18 MART 2025 — ÇİÇEKTEN DONA</p>
  <h2 className="doc-heading" style={{ fontSize: 22, marginTop: 6 }}>Dört gün, dört gece — tam çiçekte yakalandık.</h2>
  <p className="doc-body-text" style={{ marginTop: 12 }}>18 Mart’ta hava döndü. Dört gün süren soğuk ve kar, tam da ağaçlar çiçekteyken geldi. Bir hafta önce bembeyaz açan dallar, bir sabah kahverengiye döndü — çiçekler kavrulmuş, arılar gelmeden donmuştu. Yerde kar, dalda buz, içimizde sessizlik.</p>
  <p className="doc-body-text" style={{ marginTop: 10 }}>O 4 gün boyunca sobayı değil, bahçeyi düşündük. Yapacak bir şey yoktu — doğa kararını vermişti. Erken uyanmanın bedeli, tam çiçekte yakalanmaktı. O yıl hasat beklemedik, toprağı dinlendirdik. Kayıp gibi görünen o don, bize en içten dersi verdi: emanet bazen beklemeyi, hatta vazgeçmeyi de bilmektir.</p>
  </div>
  </article>

  {posts.length > 0 && (
  <ul style={{ listStyle: "none", padding: 0, marginTop: 24, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
  {posts.map((p) => (
  <li key={p.slug} className="doc-journal__card">
  <div className="doc-journal__body">
  <p className="doc-journal__date">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("tr-TR") : ""}</p>
  <h3 className="doc-journal__title"><Link href={`/blog/${p.slug}`} style={{ color: "inherit", textDecoration: "none" }}>{p.title}</Link></h3>
  <p className="doc-journal__excerpt">{p.excerpt ?? ""}</p>
  </div>
  </li>
  ))}
  </ul>
  )}
 <a href="/" className="doc-btn doc-btn--ghost" style={{ marginTop: 24 }}>← Ana sayfaya dön</a>
 </div>
 </div>
 );
}
