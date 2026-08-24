import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description:
    "Kabia Ekolojik gizlilik politikası — hangi verileri topladığımız, nasıl kullandığımız ve haklarınız.",
  alternates: { canonical: "/gizlilik-politikasi" },
};

export default function Page() {
  return (
    <LegalLayout
      title="Gizlilik Politikası"
      description="Bu politika, kabiaekolojik.com’u ziyaret ettiğinizde veya alışveriş yaptığınızda kişisel verilerinizin nasıl işlendiğini şeffaf şekilde açıklar. KVKK Aydınlatma Metni ile birlikte okunmalıdır."
    >
      <h2>1. Topladığımız veriler</h2>
      <ul>
        <li>
          <strong>Hesap ve iletişim:</strong> ad soyad, e-posta, telefon, şifre (hash’li), adresler.
        </li>
        <li>
          <strong>Sipariş ve finans:</strong> sepet, sipariş geçmişi, fatura bilgileri, ödeme yöntemi (kart numarası bizde
          saklanmaz; ödeme kuruluşu işler), kargo takip.
        </li>
        <li>
          <strong>Teknik:</strong> IP, cihaz/tarayıcı, çerezler, site kullanım istatistikleri.
        </li>
        <li>
          <strong>Destek:</strong> bize yazdığınız mesajlar ve talepler.
        </li>
      </ul>

      <h2>2. İşleme amaçları</h2>
      <ul>
        <li>Siparişi almak, ödemeyi tahsil etmek, kargolamak ve faturalandırmak</li>
        <li>Hesabınızı yönetmek, destek vermek, iade/değişim süreçlerini yürütmek</li>
        <li>Yasal yükümlülükleri yerine getirmek (vergi, tüketici hukuku, e-ticaret mevzuatı)</li>
        <li>Siteyi güvenli tutmak, dolandırıcılığı önlemek</li>
        <li>
          Açık rızanız varsa pazarlama iletileri ve kişiselleştirme (her zaman vazgeçebilirsiniz)
        </li>
      </ul>

      <h2>3. Hukuki sebepler</h2>
      <p>
        KVKK md. 5/2 kapsamında: sözleşmenin kurulması/ifası, hukuki yükümlülük, meşru menfaat; pazarlama için ise md.
        5/1 açık rıza.
      </p>

      <h2>4. Paylaşım</h2>
      <ul>
        <li>Kargo firmaları, ödeme kuruluşları, e-fatura/e-arşiv sağlayıcıları, barındırma (hosting) ve e-posta altyapısı</li>
        <li>Yetkili kamu kurumları (talep halinde, mevzuat gereği)</li>
        <li>
          Verileriniz, açık rızanız olmadan pazarlama amacıyla üçüncü kişilere satılmaz. Hizmet sağlayıcılarla KVKK
          uyumlu sözleşmeler yapılır.
        </li>
      </ul>

      <h2>5. Saklama süreleri</h2>
      <ul>
        <li>Sipariş/fatura: 10 yıl (Vergi Usul Kanunu, TTK)</li>
        <li>Hesap verileri: üyelik sürdüğü sürece + mevzuat süreleri</li>
        <li>Destek yazışmaları: 3 yıl</li>
        <li>Çerez/log: 2 yıla kadar</li>
      </ul>

      <h2>6. Haklarınız</h2>
      <p>
        KVKK md. 11’deki haklarınız (erişim, düzeltme, silme, itiraz, zarar giderimi vb.) için{" "}
        <a href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</a>’ndeki başvuru yöntemlerine bakın. Taleplerinizi{" "}
        <a href="mailto:info@kabia.com">info@kabia.com</a> üzerinden iletebilirsiniz; en geç 30 gün içinde yanıtlarız.
      </p>

      <h2>7. Güvenlik</h2>
      <p>
        Veriler şifreli bağlantı (TLS), erişim kısıtları ve düzenli yedekleme ile korunur. Kart bilgileriniz bizde
        tutulmaz; PCI-DSS uyumlu ödeme altyapısı kullanılır. İhlal şüphesinde derhal sizi ve KVK Kurulu’nu
        bilgilendiririz.
      </p>

      <h2>8. Çocuklar</h2>
      <p>Site 18 yaş altına yönelik değildir. Ebeveyn izni olmadan çocuk verisi işlediğimizi fark edersek sileriz.</p>

      <h2>9. Değişiklikler ve iletişim</h2>
      <p>
        Bu politika güncellenebilir; güncel sürüm her zaman bu sayfada yayınlanır. Sorularınız için: info@kabia.com · +90
        553 744 76 74
      </p>
    </LegalLayout>
  );
}
