# Kabia — Product Marketing Context

> Read first before any SEO audit or copy work. Source: PLAN.md intent + content/ files + live catalog.

## Site type
Turkish ecological food e-commerce. Sells: almonds from own orchard in Sabırlar, Geyve, Sakarya (19 dönüm, 946 Marinada trees), plus vetted small-producer foods (walnuts, hazelnuts, honey, linden, tarhana, erişte, tomato paste, vinegars). Brand: Kabia Ekolojik. Seller company (legal): Epilantis Kozmetik Estetik Medikal San. Dış Tic. Ltd. Şti.

## Business goal for SEO
Organic discovery of product + producer story pages in Turkish search, then purchase in /magaza and /shop/[slug]. Story pages (/ciftlik, /secki, /ureticiler/[slug], /gunluk) support purchase intent, not replace it.

## Audience
Turkish shoppers seeking clean, additive-free, traceable food; willing to pay for known producer and production method.-brand voice (binding): calm, plain, concrete, no hype. No invented facts, no fabricated ratings/reviews/prices/availability/awards/addresses/hours. All copy Turkish.

## Priority topics (from actual catalog + pages)
- Kendi bahçe: kabuklu badem, Marinada badem, Geyve badem, Sabırlar / Kılıçkaya
- Seçki: doğal fındık / kabuklu fındık (Setçe), kabuklu ceviz (Kayadibi), doğal bal / Kılıçkaya balı (sabit kovan), ıhlamur (Akıncı)
- Mutfak: ev tarhanası, erişte, domates salçası, elma sirkesi, alıç sirkesi
- Yaklaşım: ekolojik tarım, organik tarım, katkısız, sentetik girdisiz, toprağı sürmeden

## Priority Turkish keywords (derive from catalog, verify in Search Console later)
organik badem, kabuklu badem, Geyve badem, Marinada badem, doğal fındık, kabuklu fındık, kabuklu ceviz, doğal bal, Kılıçkaya balı, ıhlamur, ev tarhanası, erişte, domates salçası, elma sirkesi, alıç sirkesi, ekolojik tarım, katkısız gıda, Geyve, Sakarya

## Route map (public, indexable)
- / (homepage, three-source intro + collection)
- /magaza (store), /shop/[slug] (product detail, canonical product URL)
- /magaza/[producer-slug] (producer store)
- /secki (producer grid), /ureticiler (story index), /ureticiler/[slug] (producer story)
- /ciftlik (farm narrative + timeline + approach), /mutfak, /badem
- /gunluk, /gunluk/[slug] (journal)
- /iletisim, legal pages (mesafeli-satis, on-bilgilendirme, gizlilik, kvkk, acik-riza, cerez, teslimat-iade, kullanim-kosullari)
- Private / noindex: /admin, /api, /sepet, /odeme, /hesabim, /giris, /kayit

## Facts that must stay true
- All product stock currently 0 by choice → availability = OutOfStock in structured data.
- aggregateRating only from real account-backed reviews.
- No LocalBusiness block unless address/hours are stated on site (address known: Sabırlar, 54700 Geyve/Sakarya; phone +90 553 744 76 74; email info@kabia.com).
- Social profiles in code (unverified with owner): instagram.com/kabiaekolojik, facebook.com/kabiaekolojik, x.com/kabiaekolojik. Confirm real URLs before claiming.
- Canonical domain target: kabiaekolojik.com (currently live on kabia-revised.vercel.app). Single env var switch required.
