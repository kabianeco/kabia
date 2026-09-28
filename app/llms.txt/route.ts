import { farmCertificate } from "@/content/farm"
import { routes, site } from "@/lib/site"

/**
 * /llms.txt — the site's verified facts for AI answers and search engines.
 *
 * Generated rather than a file in public/: every link comes from the configured
 * site URL, so the domain switch changes it with everything else. Every line
 * restates something the site already says, and says where:
 * - brand, seller, address, contact: lib/site.ts (/iletisim, footer, legal pages)
 * - the reply window: /iletisim ("Hafta içi 09:00–18:00 içinde dönüyoruz")
 * - the farm's method: /badem ("Bahçeye kimyasal gübre ve ilaç girmez; ürüne
 *   katkı maddesi eklenmez.")
 * - the certificate: content/farm.ts farmCertificate, shown on /ciftlik — an
 *   enterprise certificate for the farm's production, not for the producers
 * - stock: product pages ("Stokta yok")
 */
export const dynamic = "force-static"

const fact = (label: string) => farmCertificate.facts.find((f) => f.label === label)?.value ?? ""

export function GET() {
  const url = (path: string) => `${site.url}${path}`
  const body = `# ${site.name}

> ${site.region}'dan ekolojik gıda: kendi çiftliğimizden badem, güvendiğimiz
> üreticilerden seçki ve mutfak ürünleri. Bu dosya yapay zekâ cevapları ve
> arama motorları için sitenin doğrulanmış gerçeklerini özetler.

## Marka

- Ad: ${site.name}
- Satıcı (yasal): ${site.legalName}
- Yer: ${site.address}
- Site: ${site.url}
- E-posta: ${site.email}
- Telefon/WhatsApp: ${site.phone} (hafta içi 09:00–18:00 dönüş)

## Üç kaynak

- Kabia Çiftliği: kendi bahçemizden badem (Sabırlar, Geyve).
- Kabia Seçki: tanıdığımız üreticilerden fındık, ceviz, bal, ıhlamur.
- Kabia Mutfak: geleneksel yöntemle salça, sirke, erişte, tarhana.

## Sayfalar

- Mağaza: ${url(routes.store)}
- Seçki: ${url(routes.secki)}
- Çiftlik: ${url(routes.farm)}
- Üreticiler: ${url(routes.producers)}
- Mutfak: ${url(routes.mutfak)}
- Badem: ${url("/badem")}
- Saha notları: ${url(routes.journal)}
- İletişim: ${url(routes.contact)}
- Site haritası: ${url("/sitemap.xml")}

## Bilinmesi gerekenler

- Kabia Çiftliği: bahçeye kimyasal gübre ve ilaç girmez; ürüne katkı maddesi eklenmez.
- Organik sertifika: ${fact("Sertifika no")} numaralı organik tarım müteşebbis sertifikası.
  Veren kurum: ${fact("Veren kurum")}. Sahibi: ${fact("Sertifika sahibi")}.
  Kapsam: ${fact("Kapsam").toLowerCase()}. Geçerlilik: ${fact("Geçerlilik")}.
  Kabia Çiftliği'nin üretimini kapsar, Seçki ve Mutfak üreticilerini kapsamaz.
  Her ürünün sertifika durumu kendi sayfasında yazar.
- Stoklar hasatla birlikte açılır; stokta olmayan ürün alınamaz.
- Kargo ve iade koşulları: ${url(routes.deliveryAndReturn)}
- Yasal metinler: ${url(routes.kvkkDisclosure)}
`
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
