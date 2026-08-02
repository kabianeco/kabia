# Mağaza sayfası hero banner — tasarım

**Tarih:** 2026-08-02
**Durum:** Onaylandı, uygulanacak

## Amaç

Mağaza sayfasının (`/shop`) en tepesine, ürün listesinden önce, satış/dönüşüm odaklı bir kampanya banner'ı eklemek. Admin tarafından açılıp kapatılabilen ve içeriği (başlık, alt metin, görsel, CTA) admin panelinden düzenlenebilen tek bir banner.

## Kapsam

- Tek banner, aç/kapa anahtarlı. Çoklu banner, sıralama veya zamanlama yok.
- İçerik tamamen admin tarafından manuel girilir — otomatik ürün seçimi yok.
- Banner kapalıyken veya zorunlu alanlar boşken hiçbir şey render edilmez; sayfa bugünkü haliyle çalışmaya devam eder.

## Yerleşim ve görsel tasarım

- Banner, `app/shop/page.tsx` içinde mevcut "Mağaza / Bahçeden sofraya" başlık bloğundan **önce**, sayfanın en tepesinde yer alır.
- Tam genişlikte (edge-to-edge, `wrap` sınırlaması olmadan) bir görsel; üzerine koyu bir gradient scrim ile başlık, alt metin ve isteğe bağlı bir CTA butonu bindirilir ("tam bindirmeli görsel + üzerinde metin" deseni).
- Header her zaman opak olduğundan (mağaza sayfası `isHome` değil, dolayısıyla `site-header.tsx`'teki `surfaced` her zaman `true`), banner header'ın hemen altından başlar — header ile çakışma riski yok. Banner, `.page-top` yardımcı sınıfının sağladığı ekstra boşluk (3–4rem) olmadan, yalnızca sabit header'ı temizleyecek kadar (`--header-offset` / `--header-offset-desktop`) üst boşlukla açılır. Bugün en tepede olan başlık bloğu, banner'ın altına daha küçük bir üst boşlukla kayar.
- Yükseklik: masaüstünde ve mobilde farklı oranlar (ör. mobilde daha kısa, masaüstünde geniş bir "hero" oranı) — kesin ölçüler uygulama sırasında sitenin diğer tam-genişlik bölümleriyle (`FinalCta`, `EditorialImage`) görsel tutarlılık gözetilerek belirlenir.
- CTA butonu isteğe bağlıdır: `cta_label` veya `cta_href` boşsa buton hiç render edilmez, banner yalnızca görsel + metin olarak kalır.
- Reduced-motion ve mevcut `Reveal` giriş animasyonu deseniyle tutarlı, sade bir fade/slide girişi olabilir; zorunlu değildir.

## Veri modeli

Yeni bir tablo yerine mevcut `public.site_settings` anahtar/değer deseni genişletilir (bkz. `supabase/migrations/20260801000700_site_settings.sql`). Bu tablo tam olarak bu tür "işletmeyle birlikte değişen operasyonel içerik" için tasarlanmış.

Yeni migration ile:

1. `group_key` check kısıtına `'shop_banner'` eklenir.
2. Aşağıdaki 6 satır eklenir (`is_public = true`, `is_sensitive = false`):

| key | value_type | label | varsayılan |
|---|---|---|---|
| `shop_banner_enabled` | boolean | Banner yayında | `false` |
| `shop_banner_headline` | string | Başlık | `""` |
| `shop_banner_subtext` | string | Alt metin | `""` |
| `shop_banner_image_url` | string | Görsel URL | `""` |
| `shop_banner_cta_label` | string | Buton metni | `""` |
| `shop_banner_cta_href` | string | Buton linki | `""` |

Mevcut `site_settings_no_script_check` kısıtı bu yeni string alanlar için de otomatik olarak geçerli olur (script/`javascript:`/`on*=` içeren değerler DB seviyesinde reddedilir) — ek bir sanitizasyon gerekmez.

`lib/settings.ts`:
- `KEY_MAP` bu 6 anahtarı `PublicSettings` üzerindeki yeni alanlara eşler (ör. `shopBanner: { enabled, headline, subtext, imageUrl, ctaLabel, ctaHref }`).
- `SETTINGS_FALLBACK` bu alanlar için `enabled: false` ve boş string varsayılanları taşır, böylece `site_settings` satırları eksik olsa bile sayfa kırılmaz.

## Admin arayüzü

`app/admin/(protected)/content/page.tsx` içine, mevcut "Duyuru ve iletişim" panelinin (`SettingsGroupForm group="content"`) hemen altına, ikinci bir panel eklenir:

```
<SettingsGroupForm
  group="shop_banner"
  title="Mağaza banner'ı"
  description="Mağaza sayfasının en üstünde gösterilen kampanya banner'ı."
  settings={groups.shop_banner ?? []}
  canEditSensitive={canEditSensitive}
  longFields={["shop_banner_subtext"]}
/>
```

- `SettingsGroupForm` ve `updateSettingsAction` zaten grup-agnostik çalışıyor; yeni alan tipi veya özel bileşen gerekmez (checkbox için `shop_banner_enabled`, tek satır input'lar için diğerleri, textarea için `shop_banner_subtext`).
- Görsel için ayrı bir medya seçici **yok** — `seo_social_image` alanında olduğu gibi düz bir URL input'u. Panel açıklamasına kısa bir not eklenir: görseli önce Medya kütüphanesine yükleyip URL'sini buraya yapıştırması gerektiği.
- `app/admin/(protected)/settings/actions.ts:100`'deki audit log etiketleme mantığı (`group === "content" ? "content.update" : "settings.update"`) `shop_banner` grubunu da `"content.update"` olarak işaretleyecek şekilde güncellenir (mağaza içerik değişikliği olduğu için).

## Genel site tarafı

- Yeni bileşen: `components/shop/shop-hero-banner.tsx`. `getPublicSettings()`'ten okunan `shopBanner` alanlarını props olarak alır (ya da fonksiyonu kendi çağırır — sayfanın diğer server-fetch deseniyle tutarlı olacak şekilde uygulama sırasında karar verilir).
- `enabled` false ise veya `headline`/`imageUrl` boşsa bileşen `null` döner.
- `app/shop/page.tsx`'te `<PageShell>` içinde, mevcut `<section aria-labelledby="shop-heading">`'dan önce render edilir.
- `next/image` `fill` ile kullanılacağından, admin'in yapıştıracağı URL'in `next.config`'te zaten izinli olan Supabase storage alan adından geldiği varsayılır (mevcut ürün görselleriyle aynı yol).

## Erişilebilirlik

- Banner bir `<section>` içinde, görseli dekoratif (`alt=""`) veya headline'ı `alt` olarak taşıyan bir `Image` ile kurulur (kesin karar: metin zaten görselin üzerine HTML olarak render edildiği için görsel dekoratif kabul edilir, `alt=""`).
- Scrim, WCAG kontrastını karşılayacak şekilde yeterince koyu olmalı (metin rengi `cream`/`on-brand`, mevcut `on-dark` yardımcı sınıfları örnek alınabilir).
- CTA linki gerçek bir `<a>`/`<Link>` olarak render edilir, buton değil.

## Test planı

- `getPublicSettings()` / `KEY_MAP` genişlemesi için mevcut settings testleri (varsa) yeni alanları kapsayacak şekilde güncellenir.
- Yeni bir test: banner `enabled=false` iken veya `headline`/`imageUrl` boşken `ShopHeroBanner`'ın `null` döndüğünü doğrular.
- Yeni bir test: tüm alanlar doluyken başlık, alt metin ve CTA'nın (varsa) render edildiğini doğrular; CTA alanları boşken butonun render edilmediğini doğrular.
- Admin formu: mevcut `SettingsGroupForm`/`updateSettingsAction` zaten test edilmiş genel bir yol olduğundan, yeni grup için ayrı bir admin testi gerekmeyebilir — migration'ın `group_key` kısıtını genişlettiğini ve satırların eklendiğini doğrulayan bir migration/smoke kontrolü yeterli.
