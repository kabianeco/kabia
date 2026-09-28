/**
 * Kabia Standardı — how Kabia chooses its producers and products.
 *
 * Verbatim from the KABIA 2.0 revision brief, Appendix A.8 "Kabia Standard
 * (page)" — the owner's copy block for this text (confirmed as the source by
 * the owner on 2026-09-28). Do not reword it here; change it only when the
 * owner changes the standard. The certification note is part of the standard
 * and must be shown wherever the criteria are: the Seçki and Mutfak labels are
 * Kabia's own selection approach, not organic certification.
 */
export const kabiaStandard = {
  name: "Kabia Standardı",
  lead: "Kabia'da ürün seçmek yalnızca tadına bakıp karar vermek değildir.",
  criteria: [
    "Üreticiyi tanıyoruz.",
    "Üretim yerini biliyoruz.",
    "Nasıl üretildiğini öğreniyoruz.",
    "Kullanılan girdileri sorguluyoruz.",
    "Mümkün olduğunda üretim alanını yerinde görüyoruz.",
    "Gerekli durumlarda analiz / belge / sertifika bilgilerini değerlendiriyoruz.",
    "Şeffaf olmayan ürünü seçmiyoruz.",
  ],
  closing: "Önce üretici. Sonra ürün.",
  certificationNote:
    "\"Kabia Seçki\" ve \"Kabia Mutfak\" etiketleri Kabia'nın kendi seçme ve değerlendirme yaklaşımını ifade eder; resmî organik sertifikanın yerine geçmez. Organik sertifikalı ürünlerimiz ayrıca \"Organik\" olarak belirtilir.",
} as const
