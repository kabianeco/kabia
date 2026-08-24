import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi",
  description:
    "Kabia Ekolojik mesafeli satış sözleşmesi — 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca taraflar, ürün, fiyat, teslimat ve cayma hakları.",
  alternates: { canonical: "/mesafeli-satis-sozlesmesi" },
};

export default function Page() {
  return (
    <LegalLayout
      title="Mesafeli Satış Sözleşmesi"
      description="6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği (RG 27.11.2014/29188) uyarınca düzenlenmiştir. Siparişi onayladığınızda bu sözleşmeyi okuyup kabul etmiş sayılırsınız."
    >
      <p>
        <strong>Satıcı</strong> bilgileri sipariş özetinde, faturada ve sitenin iletişim bölümünde yer alır. Aşağıdaki metinde
        “Satıcı” Kabia Ekolojik’i, “Alıcı” sipariş veren tüketiciyi, “Site”{" "}
        <strong>kabiaekolojik.com</strong>’u ifade eder.
      </p>

      <h2>1. Taraflar</h2>
      <table>
        <tbody>
          <tr>
            <th>Satıcı</th>
            <td>
              Kabia Ekolojik Tarım Ürünleri — Sakarya Geyve, Sabırlar Köyü 54700
              <br />
              E-posta: info@kabia.com · Tel: +90 553 744 76 74
              <br />
              MERSİS / Vergi No: Faturada ve ETBİS kaydında yer almaktadır.
            </td>
          </tr>
          <tr>
            <th>Alıcı</th>
            <td>
              Ad, soyad, adres, telefon ve e-posta bilgileri sipariş formunda Alıcı tarafından beyan edilen kişidir. Alıcı,
              bilgilerin doğruluğundan sorumludur.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>2. Konu</h2>
      <p>
        İşbu sözleşmenin konusu, Alıcı’nın Site üzerinden elektronik ortamda sipariş verdiği, nitelikleri ve satış fiyatı
        Site’de ve sipariş özetinde belirtilen ürün/ürünlerin satışı ve teslimi ile buna ilişkin tarafların hak ve
        yükümlülüklerinin belirlenmesidir.
      </p>

      <h2>3. Sözleşme konusu ürün, fiyat ve ödeme</h2>
      <ul>
        <li>
          Ürünün cinsi, miktarı, birim fiyatı, varyantı (gramaj) ve KDV dahil toplam bedeli sipariş özetinde gösterilir.
          Kabia ekolojik badem ve ilgili gıda ürünleri, kimyasal gübre/ilaç kullanılmadan üretilir; ürün etiketinde
          alerjen uyarısı yer alabilir.
        </li>
        <li>Kargo ücreti sepet tutarına göre değişir; 500 ₺ ve üzeri siparişlerde kargo ücretsizdir (kampanya dönemi hariç).</li>
        <li>Ödeme, kredi/banka kartı veya kapıda ödeme seçeneklerinden biri ile yapılır. Kartlı ödemelerde tahsilat, sipariş onayıyla birlikte provizyon alınarak gerçekleşir.</li>
        <li>Fiyatlarda Satıcı’nın açık hatası (ör. 1 ₺ yerine 1000 ₺) tespit edilirse Satıcı siparişi iptal edip bedeli iade edebilir.</li>
      </ul>

      <h2>4. Teslimat</h2>
      <ul>
        <li>Ürünler, stokta bulunması halinde genellikle 1–3 iş günü içinde kargoya verilir; teslimat kargo firmasının yoğunluğuna bağlı olarak 2–5 iş günü sürebilir.</li>
        <li>Teslimat adresi Alıcı tarafından beyan edilen adrestir. Kargo firması kaynaklı gecikmelerden Satıcı sorumlu tutulamaz; gecikme 30 günü aşarsa Alıcı sözleşmeyi feshedebilir.</li>
        <li>Kargo tesliminde dış ambalaj kontrol edilmeli; hasar varsa tutanak tutturulmalı ve derhal Satıcı’ya bildirilmelidir.</li>
      </ul>

      <h2>5. Cayma hakkı (14 gün)</h2>
      <p>
        Alıcı, <strong>hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin</strong> malı teslim aldığı tarihten itibaren{" "}
        <strong>14 (on dört) gün</strong> içinde cayma hakkını kullanabilir. Cayma bildirimi e-posta (
        <a href="mailto:info@kabia.com">info@kabia.com</a>) veya telefon ile yapılabilir; ardından ürünün aynı süre içinde
        Satıcı’ya gönderilmesi gerekir.
      </p>
      <ul>
        <li>
          <strong>İstisna:</strong> Gıda ürünlerinde, ambalajı açılmış, bozulabilecek, hijyen nedeniyle iade edilemeyecek
          ürünlerde cayma hakkı kullanılamaz. Kabia bademleri bu kapsamda <em>ambalajı açılmamış ve bozulmamış</em> ise cayma
          hakkına tabidir; tadil edilmiş/kullanılmış gıda iade alınmaz.
        </li>
        <li>Cayma halinde ürün bedeli, ürün Satıcı’ya ulaştıktan sonra en geç 14 gün içinde Alıcı’ya iade edilir.</li>
        <li>İade kargo ücreti, ürün ayıplı değilse Alıcı’ya aittir (mevzuat gereği).</li>
      </ul>
      <blockquote>
        Cayma hakkınızı kullanmak için sipariş numaranızla birlikte “cayma talebimdir” beyanını info@kabia.com adresine
        iletmeniz yeterlidir. Örnek cayma formu, Ön Bilgilendirme Formu ekinde sunulmaktadır.
      </blockquote>

      <h2>6. Ayıplı mal ve garanti</h2>
      <p>
        Teslim edilen ürünün ayıplı olması halinde Alıcı, 6502 sayılı Kanun’un 11. maddesindeki seçimlik haklarını
        kullanabilir (iade, değişim, bedel indirimi, ücretsiz onarım — gıda ürününün niteliğine uygun olan). Şikâyetler
        için 2 yıllık zamanaşımı süresi içinde başvurulabilir.
      </p>

      <h2>7. Genel hükümler ve uyuşmazlık</h2>
      <ul>
        <li>Alıcı, sipariş vermeden önce Ön Bilgilendirme Formu’nu okuyup onayladığını kabul eder.</li>
        <li>
          Uyuşmazlıklarda, Alıcı’nın yerleşim yerindeki veya alışverişin yapıldığı yerdeki İl/İlçe Tüketici Hakem Heyetleri
          ile Tüketici Mahkemeleri yetkilidir. Parasal sınırlar her yıl Ticaret Bakanlığı tarafından ilan edilir.
        </li>
        <li>
          Şikâyet ve başvurular için: info@kabia.com · +90 553 744 76 74 · Ayrıca{" "}
          <a href="https://www.tuketici.gov.tr" target="_blank" rel="noopener noreferrer">
            tuketici.gov.tr
          </a>{" "}
          ve e-Devlet Tüketici Şikâyeti kanalları kullanılabilir.
        </li>
      </ul>

      <h2>8. Yürürlük</h2>
      <p>
        Alıcı siparişi onayladığında bu sözleşme elektronik ortamda kurulmuş sayılır. Satıcı, sözleşmenin bir örneğini
        Alıcı’nın e-postasına ve hesabındaki sipariş detayına iletir. Sipariş numarası sözleşmenin referansıdır.
      </p>

      <hr />
      <p className="text-xs text-ink/55">
        Bu metin bilgilendirme amaçlı örnek olup gerçek sözleşmenizin eki sipariş özetiniz ve faturanızdır. Hukuki
        uyum için bir avukata danışmanız önerilir.
      </p>
    </LegalLayout>
  );
}
