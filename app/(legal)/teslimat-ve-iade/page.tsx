import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Teslimat ve İade Koşulları",
  description:
    "Kabia Ekolojik teslimat, cayma, iade ve değişim koşulları — kargo süreleri, gıda ürünlerinde iade istisnaları ve ayıplı mal hakları.",
  alternates: { canonical: "/teslimat-ve-iade" },
};

export default function Page() {
  return (
    <LegalLayout
      title="Teslimat ve İade"
      description="Siparişinizin nasıl kargolandığını, ne zaman ulaşacağını ve iade/cayma haklarınızı sade dille özetledik. Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu ile birlikte geçerlidir."
    >
      <h2>1. Teslimat</h2>
      <ul>
        <li>
          <strong>Hazırlık:</strong> Siparişler genellikle aynı gün veya 1–3 iş günü içinde kargoya verilir.
        </li>
        <li>
          <strong>Kargo süresi:</strong> Türkiye içi 2–5 iş günü (kargo yoğunluğuna göre değişir).
        </li>
        <li>
          <strong>Kargo ücreti:</strong> 500 ₺ ve üzeri ücretsiz; altında 29,90 ₺. Kampanya döneminde değişiklik sitede
          ilan edilir.
        </li>
        <li>
          <strong>Takip:</strong> Kargo takip numarası e-posta/SMS ile gönderilir ve hesabınızdaki sipariş detayında
          görünür.
        </li>
        <li>
          <strong>Adres:</strong> Teslimat, siparişte beyan edilen adrese yapılır. Alıcı adreste bulunamazsa kargo
          şubeye bırakılır; 3 gün içinde teslim alınmayan ürün depoya dönebilir.
        </li>
      </ul>

      <h2>2. Teslim alırken kontrol</h2>
      <p>
        Dış ambalajı kargo görevlisi yanında kontrol edin. Ezilme/ıslanma/yırtılma varsa <strong>tutanak</strong>{" "}
        tutturun, fotoğraf çekin ve aynı gün <a href="mailto:info@kabia.com">info@kabia.com</a>’a bildirin.
      </p>

      <h2>3. Cayma hakkı (14 gün)</h2>
      <p>
        Tüketici, malı teslim aldıktan sonra 14 gün içinde hiçbir gerekçe göstermeden cayabilir. Cayma bildirimi
        e-posta/telefon ile yapılır; ürünün 14 gün içinde Satıcı’ya gönderilmesi gerekir.
      </p>
      <h3>Gıda ürünlerinde önemli istisna</h3>
      <p>
        Kabia ürünleri gıda olduğu için <strong>ambalajı açılmış, tadı/ambalajı bozulmuş veya hijyen nedeniyle iade
        edilemeyecek</strong> ürünlerde cayma hakkı yoktur. Ambalajı açılmamış, son tüketim tarihi geçmemiş ve
        saklama koşulları bozulmamış ürünler 14 gün içinde iade edilebilir. İade kargo ücreti (ayıplı değilse) Alıcı’ya
        aittir.
      </p>

      <h2>4. Ayıplı / hasarlı ürün</h2>
      <ul>
        <li>Ayıplı ürünlerde 6502 sayılı Kanun md. 11’deki seçimlik haklarınız saklıdır: bedel iadesi, değişim, bedel indirimi.</li>
        <li>Hasarlı/yanlış ürün gelirse 48 saat içinde fotoğrafla bildirin; kargo ücreti Satıcı’ya aittir.</li>
        <li>Gıda güvenliği şüphesinde ürünü tüketmeyin ve hemen bize yazın.</li>
      </ul>

      <h2>5. İade adımları</h2>
      <ol>
        <li>
          <a href="mailto:info@kabia.com">info@kabia.com</a>’a sipariş numaranızla cayma/iade talebinizi iletin.
        </li>
        <li>Onay e-postasındaki iade adresine, faturası ve tüm ekleriyle ürünü gönderin.</li>
        <li>Ürün bize ulaştıktan sonra en geç 14 gün içinde bedel, ödeme yönteminize iade edilir (bankanıza yansıması birkaç günü bulabilir).</li>
      </ol>

      <h2>6. İade edilemeyecek haller</h2>
      <ul>
        <li>Ambalajı açılmış gıda</li>
        <li>Son tüketim tarihi geçmiş veya uygunsuz saklama nedeniyle bozulmuş ürün</li>
        <li>Faturasız / eksik aksesuarlı gönderim</li>
      </ul>

      <h2>7. İptal</h2>
      <p>
        Kargoya verilmemiş siparişler, hesabınızdan veya info@kabia.com üzerinden iptal edilebilir; bedel aynı yöntemle
        iade edilir.
      </p>

      <h2>8. Destek</h2>
      <p>
        Sorularınız için info@kabia.com · +90 553 744 76 74 (hafta içi 09:00–18:00). Uyuşmazlıklarda Tüketici Hakem
        Heyetleri ve Tüketici Mahkemeleri yetkilidir.
      </p>
    </LegalLayout>
  );
}
