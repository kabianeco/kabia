import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "6698 sayılı KVKK uyarınca Kabia Ekolojik kişisel verilerin işlenmesi hakkında aydınlatma metni — veri sorumlusu, amaç, aktarım ve haklar.",
  alternates: { canonical: "/kvkk-aydinlatma-metni" },
};

export default function Page() {
  return (
    <LegalLayout
      title="KVKK Aydınlatma Metni"
      description="6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca, veri sorumlusu sıfatıyla Kabia Ekolojik tarafından hazırlanmıştır."
    >
      <h2>1. Veri sorumlusu</h2>
      <p>
        <strong>Kabia Ekolojik Tarım Ürünleri</strong>
        <br />
        Adres: Sabırlar Köyü, 54700 Geyve / Sakarya
        <br />
        E-posta: <a href="mailto:info@kabia.com">info@kabia.com</a> · Tel: +90 553 744 76 74
        <br />
        MERSİS/KEP: Fatura ve ETBİS kaydında sunulur.
      </p>

      <h2>2. İşlenen kişisel veri kategorileri</h2>
      <table>
        <thead>
          <tr>
            <th>Kategori</th>
            <th>Örnek</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Kimlik</td>
            <td>Ad soyad, T.C. kimlik no (fatura için gerekirse)</td>
          </tr>
          <tr>
            <td>İletişim</td>
            <td>E-posta, telefon, adres</td>
          </tr>
          <tr>
            <td>Müşteri işlem</td>
            <td>Sipariş, sepet, favori, destek talebi, iade</td>
          </tr>
          <tr>
            <td>Finans</td>
            <td>Ödeme yöntemi, fatura bilgileri (kart no saklanmaz)</td>
          </tr>
          <tr>
            <td>İşlem güvenliği</td>
            <td>IP, log, cihaz bilgisi</td>
          </tr>
          <tr>
            <td>Pazarlama</td>
            <td>İzin durumu, kampanya etkileşimi</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Toplama yöntemi ve hukuki sebep</h2>
      <p>
        Veriler; üyelik formu, sipariş akışı, çerezler, e-posta/telefon ve kargo/ödeme entegrasyonları yoluyla
        toplanır. İşleme hukuki sebepleri: KVKK md. 5/2-a (kanuni yükümlülük), 5/2-c (sözleşmenin kurulması/ifası),
        5/2-ç (veri sorumlusunun hukuki yükümlülüğü), 5/2-f (meşru menfaat); pazarlama ve çerezlerde md. 5/1 açık rıza.
      </p>

      <h2>4. İşleme amaçları</h2>
      <ul>
        <li>Üyelik ve sipariş süreçlerini yürütmek, teslimat ve faturalama yapmak</li>
        <li>Müşteri desteği, iade/değişim ve uyuşmazlık yönetimi</li>
        <li>Mevzuattan doğan saklama ve bildirim yükümlülüklerini yerine getirmek</li>
        <li>Site güvenliği, dolandırıcılık önleme ve performans ölçümü</li>
        <li>Açık rızanız varsa ticari elektronik ileti ve kişiselleştirilmiş öneri</li>
      </ul>

      <h2>5. Aktarım</h2>
      <p>Kişisel verileriniz, amaçla sınırlı ve ölçülü olarak aşağıdaki alıcı gruplarına aktarılabilir:</p>
      <ul>
        <li>Kargo, ödeme kuruluşu, e-fatura/e-arşiv, barındırma ve e-posta altyapı sağlayıcıları</li>
        <li>Yetkili kamu kurum ve kuruluşları (mahkeme, SAVCILIK, KVK Kurulu talebi vb.)</li>
        <li>Yurt dışına aktarım yapılıyorsa KVKK md. 9’a uygun (yeterlilik kararı / standart sözleşme / açık rıza) hareket edilir.</li>
      </ul>

      <h2>6. Saklama süreleri</h2>
      <ul>
        <li>Fatura/sipariş: 10 yıl</li>
        <li>Üyelik verisi: üyelik + 3 yıl (olası uyuşmazlık zamanaşımı)</li>
        <li>Log: 2 yıl</li>
        <li>Ticari ileti izni: izin geri alınıncaya kadar + 1 yıl ispat</li>
      </ul>

      <h2>7. Haklarınız (KVKK md. 11)</h2>
      <p>Her ilgili kişi, veri sorumlusuna başvurarak aşağıdaki hakları talep edebilir:</p>
      <ol>
        <li>Kişisel verisinin işlenip işlenmediğini öğrenme</li>
        <li>İşlenmişse bilgi talep etme</li>
        <li>İşleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme</li>
        <li>Yurt içinde/dışında aktarıldığı üçüncü kişileri bilme</li>
        <li>Eksik/yanlış işlenmişse düzeltilmesini isteme</li>
        <li>Kanunda öngörülen şartlarda silinmesini/yok edilmesini isteme</li>
        <li>Düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
        <li>Otomatik sistemle analiz sonucu aleyhe sonuca itiraz etme</li>
        <li>Kanuna aykırı işleme sebebiyle zarar giderimi talep etme</li>
      </ol>

      <h2>8. Başvuru yöntemi</h2>
      <p>
        Başvurularınızı; (a) Sabırlar Köyü 54700 Geyve/Sakarya adresine yazılı, (b){" "}
        <a href="mailto:info@kabia.com">info@kabia.com</a> adresine KEP veya sistemde kayıtlı e-posta ile, (c) mevzuatta
        öngörülen diğer yöntemlerle iletebilirsiniz. Talepler en geç 30 gün içinde ücretsiz sonuçlandırılır (10 sayfayı
        aşan yanıtlarda Kurul tarifesi uygulanabilir).
      </p>

      <h2>9. Güncellemeler</h2>
      <p>Bu metin mevzuat değişikliklerine göre güncellenebilir; güncel sürüm bu sayfada yayınlanır.</p>
    </LegalLayout>
  );
}
