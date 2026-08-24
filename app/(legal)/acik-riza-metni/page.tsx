import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Açık Rıza Metni",
  description:
    "Kabia Ekolojik açık rıza metni — ticari elektronik ileti, kişiselleştirme ve çerezler için rıza kapsamı.",
  alternates: { canonical: "/acik-riza-metni" },
};

export default function Page() {
  return (
    <LegalLayout
      title="Açık Rıza Metni"
      description="6698 sayılı KVKK md. 5/1 ve 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun uyarınca, belirli işlemler için açık rızanıza başvururuz. Rızanızı her zaman geri alabilirsiniz."
    >
      <h2>1. Neden açık rıza istiyoruz?</h2>
      <p>
        Bazı veri işleme faaliyetleri ancak <strong>özgür iradenizle, bilgilendirilmiş ve açık</strong> rızanızla
        yapılabilir. Kabia’da açık rıza gerektiren başlıca haller:
      </p>
      <ul>
        <li>Ticari elektronik ileti (e-posta/SMS/push ile kampanya, bülten, kişiye özel teklif)</li>
        <li>Kişiselleştirme ve pazarlama amaçlı profilleme/segmentasyon</li>
        <li>Zorunlu olmayan çerezler (analitik, pazarlama — Çerez Politikası’na bakın)</li>
      </ul>

      <h2>2. Rıza kapsamı</h2>
      <p>
        “Ticari elektronik ileti almak istiyorum” kutusunu işaretlediğinizde; e-posta ve/veya SMS yoluyla kampanya,
        indirim, yeni ürün ve size özel öneriler göndermemize izin vermiş olursunuz. “Kişiselleştirme” izni verirseniz
        alışveriş geçmişinize göre öneriler ve ölçümleme yapabiliriz.
      </p>

      <h2>3. Rıza zorunlu mu?</h2>
      <p>
        Hayır. Sipariş vermek veya üye olmak için ticari ileti izni <strong>zorunlu değildir</strong>. Yalnızca
        sözleşme ve yasal yükümlülük için gerekli veriler zorunludur. Rıza vermemeniz hizmet almanızı engellemez.
      </p>

      <h2>4. Rızayı geri alma</h2>
      <ul>
        <li>E-postadaki “abonelikten çık” bağlantısı</li>
        <li>Hesabım → Bildirimler ayarları</li>
        <li>
          <a href="mailto:info@kabia.com">info@kabia.com</a>’a “Ticari ileti iznimi geri alıyorum” e-postası
        </li>
        <li>İleti Yönetim Sistemi (İYS) üzerinden ret (ticari iletiler İYS’ye bildirilir)</li>
      </ul>
      <p>Geri alma, ileriye dönük etkilidir; daha önce rızaya dayanarak yapılan işlemler hukuka uygun kalır.</p>

      <h2>5. İYS bilgilendirmesi</h2>
      <p>
        6563 sayılı Kanun gereği ticari elektronik iletiler İleti Yönetim Sistemi’ne (İYS) kaydedilir ve alıcılar
        izinlerini <a href="https://iys.org.tr" target="_blank" rel="noopener noreferrer">iys.org.tr</a> üzerinden de
        yönetebilir.
      </p>

      <h2>6. Saklama ve ispat</h2>
      <p>Rıza kayıtları, ispat yükümlülüğü gereği rıza geri alınıncaya kadar ve sonrasında 3 yıl saklanır.</p>

      <h2>7. Örnek rıza beyanı</h2>
      <blockquote>
        “Kabia Ekolojik tarafından, kampanya ve duyuruların e-posta/SMS ile gönderilmesi amacıyla kişisel verilerimin
        işlenmesine ve bu amaçla saklanmasına açık rıza veriyorum. Rızamı her zaman geri alabileceğimi biliyorum.”
      </blockquote>

      <p className="text-xs text-ink/55">
        Bu metin KVKK Aydınlatma Metni ve Gizlilik Politikası ile birlikte okunmalıdır.
      </p>
    </LegalLayout>
  );
}
