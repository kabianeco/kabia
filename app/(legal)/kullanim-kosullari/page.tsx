import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Kullanım Koşulları ve Üyelik Sözleşmesi",
  description:
    "Kabia Ekolojik site kullanım koşulları ve üyelik sözleşmesi — hesap güvenliği, fikri mülkiyet ve sorumluluk.",
  alternates: { canonical: "/kullanim-kosullari" },
};

export default function Page() {
  return (
    <LegalLayout
      title="Kullanım Koşulları & Üyelik Sözleşmesi"
      description="kabiaekolojik.com’u ziyaret ederek veya üye olarak aşağıdaki koşulları kabul etmiş sayılırsınız."
    >
      <h2>1. Taraflar ve kapsam</h2>
      <p>
        Bu sözleşme, Kabia Ekolojik (“Kabia”) ile Site’ye üye olan veya ziyaret eden kişi (“Kullanıcı/Üye”) arasında
        akdedilmiştir. Site’nin tüm içerik, tasarım ve yazılımı Kabia’ya aittir.
      </p>

      <h2>2. Üyelik</h2>
      <ul>
        <li>Üye, bilgilerin doğru ve güncel olduğunu taahhüt eder.</li>
        <li>Şifre gizliliği Üye’ye aittir; paylaşılmaz. Şüpheli durumda derhal şifre değiştirilmeli ve Kabia’ya bildirilmelidir.</li>
        <li>18 yaş altı üyelik için veli izni gerekir; Kabia reşit olmayanların işlemlerini reddedebilir.</li>
      </ul>

      <h2>3. Kullanım kuralları</h2>
      <ul>
        <li>Site yalnızca hukuka uygun, kişisel amaçlarla kullanılır.</li>
        <li>Otomatik kazıma (scraping), spam, tersine mühendislik ve site güvenliğini bozacak davranışlar yasaktır.</li>
        <li>Yorum/değerlendirme yapılıyorsa hakaret, yanıltıcı beyan ve telif ihlali yasaktır; Kabia moderasyon hakkını saklı tutar.</li>
      </ul>

      <h2>4. Fikri mülkiyet</h2>
      <p>
        Logo, fotoğraflar, metinler ve “Kabia” markası Kabia’ya aittir; izinsiz kopyalanamaz. Kullanıcı’nın yüklediği
        içeriklerde sorumluluk kullanıcıya aittir; Kabia’ya yayma hakkı verilmiş sayılır.
      </p>

      <h2>5. Ürün bilgileri ve fiyatlar</h2>
      <p>
        Kabia, ürün bilgilerinde ve fiyatlarda hata/düzeltme hakkını saklı tutar. Stokta bulunmayan ürün siparişleri
        iptal edilip bedel iade edilebilir. Görseller temsilidir.
      </p>

      <h2>6. Sorumluluğun sınırları</h2>
      <p>
        Site “olduğu gibi” sunulur. Kabia, kesinti, veri kaybı veya kargo kaynaklı gecikmelerden doğan dolaylı
        zararlardan, mevzuatın izin verdiği ölçüde sorumlu tutulamaz. Gıda ürünlerinin saklama ve alerjen uyarılarına
        uyulması Kullanıcı’nın sorumluluğundadır.
      </p>

      <h2>7. Hesabın askıya alınması</h2>
      <p>
        Sahte bilgi, kötüye kullanım veya hukuka aykırılık tespitinde Kabia hesabı askıya alabilir veya kapatabilir;
        siparişleri iptal edebilir.
      </p>

      <h2>8. Değişiklikler</h2>
      <p>Kabia, bu koşulları ve site özelliklerini dilediğinde güncelleyebilir; güncel metin bu sayfada yayınlanır.</p>

      <h2>9. Uygulanacak hukuk ve uyuşmazlık</h2>
      <p>
        Türk hukuku uygulanır. Tüketici işlemlerinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri; tacir
        işlemlerinde Sakarya Mahkemeleri yetkilidir.
      </p>

      <h2>10. İletişim</h2>
      <p>
        Sorularınız için <a href="mailto:info@kabia.com">info@kabia.com</a> · +90 553 744 76 74
      </p>

      <hr />
      <p className="text-xs text-ink/55">
        Üye olurken bu sözleşme ile birlikte <a href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</a> ve{" "}
        <a href="/gizlilik-politikasi">Gizlilik Politikası</a>’nı da onaylamanız istenir.
      </p>
    </LegalLayout>
  );
}
