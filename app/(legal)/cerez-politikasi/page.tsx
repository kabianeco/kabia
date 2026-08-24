import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Çerez Politikası",
  description:
    "Kabia Ekolojik çerez politikası — kullandığımız çerez türleri, amaçları ve tercihlerinizi nasıl yöneteceğiniz.",
  alternates: { canonical: "/cerez-politikasi" },
};

export default function Page() {
  return (
    <LegalLayout
      title="Çerez Politikası"
      description="Çerezler, siteyi çalışır, güvenli ve size daha uygun hale getirmek için cihazınıza yerleştirilen küçük metin dosyalarıdır. Bu politika hangi çerezleri neden kullandığımızı açıklar."
    >
      <h2>1. Çerez türleri</h2>
      <table>
        <thead>
          <tr>
            <th>Türü</th>
            <th>Örnek</th>
            <th>Zorunlu mu?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Zorunlu</td>
            <td>Oturum, sepet, güvenlik, dil/tema</td>
            <td>Evet — site çalışması için gerekli</td>
          </tr>
          <tr>
            <td>İşlevsel</td>
            <td>Giriş hatırlama, tercihleri saklama</td>
            <td>Hayır</td>
          </tr>
          <tr>
            <td>Analitik</td>
            <td>Ziyaret ölçümü, performans (anonim)</td>
            <td>Hayır — izninizle</td>
          </tr>
          <tr>
            <td>Pazarlama</td>
            <td>Kişiselleştirme, kampanya ölçümü</td>
            <td>Hayır — izninizle</td>
          </tr>
        </tbody>
      </table>

      <h2>2. Kullandığımız çerezlere örnekler</h2>
      <ul>
        <li>
          <strong>supabase-auth-token:</strong> oturumunuzu sürdürür (zorunlu, süre: oturum + 7 gün)
        </li>
        <li>
          <strong>kabia_cart:</strong> misafir sepetinizi hatırlar (zorunlu, localStorage, 30 gün)
        </li>
        <li>
          <strong>theme:</strong> açık/koyu tema tercihiniz (işlevsel, 1 yıl)
        </li>
        <li>
          <strong>_ga / _gid (varsa):</strong> anonim analitik (yalnızca izin verirseniz, 13 ay)
        </li>
      </ul>

      <h2>3. Hukuki sebep</h2>
      <p>
        Zorunlu çerezler “meşru menfaat” ve “sözleşmenin ifası” ile; diğerleri açık rızanızla (KVKK md.5) işlenir.
      </p>

      <h2>4. Tercihlerinizi yönetme</h2>
      <ul>
        <li>Tarayıcı ayarlarından çerezleri silebilir/engelleyebilirsiniz (Chrome: Ayarlar → Gizlilik → Çerezler).</li>
        <li>Zorunlu çerezleri engellerseniz sepet/giriş çalışmayabilir.</li>
        <li>Yakında sitede bir çerez tercih paneli sunacağız; o zamana kadar tarayıcı ayarlarınız geçerlidir.</li>
      </ul>

      <h2>5. Üçüncü taraf çerezleri</h2>
      <p>
        Ödeme, kargo takip, harita veya analitik sağlayıcıları kendi çerezlerini kullanabilir. Bu sağlayıcıların
        politikaları kendi sitelerinde yer alır.
      </p>

      <h2>6. İletişim</h2>
      <p>
        Sorularınız için <a href="mailto:info@kabia.com">info@kabia.com</a> · Bu politika güncellendiğinde bu sayfada
        ilan edilir.
      </p>
    </LegalLayout>
  );
}
