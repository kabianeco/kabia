import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Ön Bilgilendirme Formu",
  description:
    "Kabia Ekolojik ön bilgilendirme formu — mesafeli sözleşme öncesi ürün, fiyat, teslimat, cayma hakkı ve iletişim bilgileri.",
  alternates: { canonical: "/on-bilgilendirme-formu" },
};

export default function Page() {
  return (
    <LegalLayout
      title="Ön Bilgilendirme Formu"
      description="Mesafeli Sözleşmeler Yönetmeliği md. 5 uyarınca, sipariş onayından önce tüketiciye sunulması zorunlu bilgilerin özetidir. Satın alma sırasında bu formu onaylamanız istenir."
    >
      <h2>1. Satıcıya ilişkin bilgiler</h2>
      <ul>
        <li>Unvan: Kabia Ekolojik Tarım Ürünleri — Geyve / Sakarya</li>
        <li>Adres: Sabırlar Köyü, 54700 Geyve / Sakarya</li>
        <li>E-posta: info@kabia.com · Telefon: +90 553 744 76 74</li>
        <li>MERSİS / KEP / ETBİS: Fatura ve ETBİS kaydında sunulur; eticaret.gov.tr üzerinden doğrulanabilir.</li>
      </ul>

      <h2>2. Ürünün temel nitelikleri</h2>
      <p>
        Kabia ekolojik bademleri Sakarya Geyve’de kimyasal gübre ve ilaç kullanılmadan yetiştirilir. Ürün adı, gramajı,
        içeriği, alerjen uyarısı, son tüketim tarihi ve saklama koşulları ürün detay sayfasında ve etiketinde yer alır.
        Görseller temsilidir; hasat dönemine göre tane iriliği/doğal renk farklılıkları oluşabilir.
      </p>

      <h2>3. Fiyat, vergiler ve ek masraflar</h2>
      <table>
        <thead>
          <tr>
            <th>Kalem</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Birim fiyat</td>
            <td>Ürün sayfasında ve sepette KDV dahil gösterilir.</td>
          </tr>
          <tr>
            <td>Kargo</td>
            <td>500 ₺ üzeri ücretsiz; altında 29,90 ₺ (kampanyaya göre değişebilir).</td>
          </tr>
          <tr>
            <td>Toplam</td>
            <td>Ara toplam + kargo + varsa indirim = ödenecek tutar.</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Ödeme ve teslimat</h2>
      <ul>
        <li>Ödeme: Kredi/banka kartı (tek çekim) veya kapıda ödeme.</li>
        <li>Teslimat: 1–3 iş günü içinde kargoya verilir; kargo süresi 2–5 iş günüdür. 30 günü aşan gecikmede Alıcı sözleşmeyi feshedebilir.</li>
        <li>Kargo firması: Anlaşmalı kargo; takip numarası e-posta/SMS ile bildirilir.</li>
      </ul>

      <h2>5. Cayma hakkı ve istisnaları</h2>
      <p>
        Tüketici, malı teslim aldıktan sonra <strong>14 gün</strong> içinde cayma hakkını kullanabilir. Cayma bildirimi
        yazılı (e-posta) veya kalıcı veri saklayıcısı ile yapılmalıdır. Gıda ürünlerinde <strong>ambalajı açılmış</strong>,
        bozulabilecek veya hijyen nedeniyle iade edilemeyecek ürünlerde cayma hakkı yoktur. Kabia ürünleri ambalajı
        açılmamış ve ürün/hijyen bozulmamış ise 14 gün içinde iade edilebilir.
      </p>

      <h3>Örnek cayma bildirimi metni</h3>
      <blockquote>
        “Sipariş no: … tarihli, … ürününe ilişkin cayma hakkımı kullanmak istiyorum. Ad Soyad, Adres, Tarih, İmza (e-posta
        için ad-soyad yeterlidir).” — Gönderim: info@kabia.com
      </blockquote>

      <h2>6. Şikâyet ve uyuşmazlık</h2>
      <p>
        Şikâyetlerinizi info@kabia.com veya +90 553 744 76 74 üzerinden iletebilirsiniz. Uyuşmazlıklarda Tüketici Hakem
        Heyetleri ve Tüketici Mahkemeleri yetkilidir.
      </p>

      <h2>7. Onay</h2>
      <p>
        Alıcı, bu formdaki bilgileri okuyup anladığını, Mesafeli Satış Sözleşmesi ile birlikte elektronik ortamda
        onaylayarak siparişini oluşturduğunu kabul eder.
      </p>
    </LegalLayout>
  );
}
