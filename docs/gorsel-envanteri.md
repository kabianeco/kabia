# Görsel envanteri

Kapsam: `public/` altındaki tüm görsel ve videolar + `app/apple-icon.png`. Bu dosya medya optimizasyonundan sonraki durumu gösterir. "Önce", `2b3a830` (kabia-neco-revised görsellerinin içe aktarıldığı commit) içindeki boyuttur; "sonra" çalışma ağacındaki boyuttur. Kullanım bilgisi kod taramasından (`app components content lib supabase`), canlı Supabase'e yapılan SELECT-only sorgulardan (`products.main_image_url`, `product_images.image_url`, `producers.photo_url`, `site_settings`) ve üretim derlemesinin 7 görüntü alanı genişliğinde (360–1920 px, DPR 2) gezilmesinden gelir.

## Özet

| | Önce | Sonra |
|---|---|---|
| `public/images/` (JPEG'ler, SVG ve günlük videosu dahil) | 28.31 MB | 22.35 MB |
| — bunun içinde JPEG'ler (61 dosya) | 24.54 MB | 18.58 MB |
| `public/video/` (4 hero videosu + poster) | 22.75 MB | 16.60 MB |

Kurallar: yol ve uzantı hiçbir dosyada değişmedi. JPEG'ler 2× DPR'de en büyük gösterim boyutuna küçültüldü (yalnızca gerçekten daha büyükse; `next/image` en fazla 1920 px ürettiği için üst sınır 1920), mozjpeg + progressive, tüm üst veriler (EXIF/XMP/ICC/üretici segmentleri) çıkarıldı. Kalite; özgüne karşı SSIM ≥ 0,98 (2× gösterim boyutunda ve 1× CSS boyutunda, parlaklık ve RGB) sağlayan en düşük değerdir. Küçültme + kapı özgün dosyadan büyük çıkarsa dosya olduğu gibi (ya da yalnızca kayıpsız jpegtran ile) bırakıldı. GPS verisi hiçbir dosyada yoktu.

## Dosyalar

| Dosya | Biçim | Boyut (px) | Önce | Sonra | Not | 2× hedef (en büyük gösterim) | Kullanım |
|---|---|---|---|---|---|---|---|
| `public/email/kabia-logo@2x.png` | PNG | 1464×496 | 34 KB | 34 KB |  | — | kod: lib/email/layout.ts, supabase/templates/change-email.html, supabase/templates/confirm-signup.html, supabase/templates/reset-password.html; e-posta şablonları (168 px genişlik, düz &lt;img&gt;) |
| `public/icon-192.png` | PNG | 192×192 | 5 KB | 5 KB |  | — | kod: app/manifest.ts; PWA ikonu |
| `public/icon-512.png` | PNG | 512×512 | 19 KB | 17 KB |  | — | kod: app/manifest.ts; PWA ikonu |
| `public/images/acik-alic1.jpg` | JPG | 1370×1148 | 292 KB | 243 KB | q80 | 1864 px (/ureticiler/alic-sirkesi@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-badem.jpg` | JPG | 1088×1445 | 380 KB | 300 KB | q79 | 1104 px (/shop/kabuklu-badem@1280:528x660) → kaynak 1088 px | DB: products.main_image_url×1, product_images×1; kod: content/homepage.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-bal1.jpg` | JPG | 1370×1148 | 457 KB | 378 KB | q80 | 1864 px (/ureticiler/anadolu-bal@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-ceviz1.jpg` | JPG | 1370×1148 | 420 KB | 349 KB | q80 | 1864 px (/ureticiler/ege-ceviz@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-domates1.jpg` | JPG | 1371×1147 | 300 KB | 249 KB | q80 | 1864 px (/ureticiler/domates-salcasi@1024:896x504) → kaynak 1371 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-elmasirkesi1.jpg` | JPG | 1370×1148 | 428 KB | 352 KB | q80 | 1864 px (/ureticiler/elma-sirkesi@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-eriste1.jpg` | JPG | 1370×1148 | 292 KB | 231 KB | q79 | 1864 px (/ureticiler/eriste@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-findik1.jpg` | JPG | 1370×1148 | 422 KB | 347 KB | q80 | 1864 px (/ureticiler/geyve-setce-findik@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-ihlamur1.jpg` | JPG | 1370×1148 | 551 KB | 472 KB | q82 | 1864 px (/ureticiler/akinci-ihlamur@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/acik-tarhana1.jpg` | JPG | 1370×1148 | 409 KB | 327 KB | q79 | 1864 px (/ureticiler/tarhana@1024:896x504) → kaynak 1370 px | DB: products.main_image_url×1, product_images×1, producers.photo_url×1; kod: content/homepage.ts, content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 768px) 50vw, 100vw` · `120px` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/almonds-drying.jpg` | JPG | 1920×1279 | 1.26 MB | 810 KB | q92 | 2032 px (/kayit@1280:520x650) → kaynak 1920 px | kod: app/kayit/page.tsx, lib/admin/url-settings.ts; next/image (sizes: `50vw`) |
| `public/images/almonds-net.jpg` | JPG | 2048×2048 | 484 KB | 484 KB | değişmedi | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/bademagaclari.jpg` | JPG | 1254×1254 | 465 KB | 440 KB | kayıpsız | 1120 px (/ciftlik@1280:536x402) | kod: app/ciftlik/page.tsx; next/image (sizes: `(min-width: 768px) 50vw, 100vw`) |
| `public/images/bostarla.jpg` | JPG | 1289×1220 | 596 KB | 499 KB | q81 | 2336 px (/ciftlik@1280:1120x840) → kaynak 1289 px | kod: app/ciftlik/page.tsx; next/image (sizes: `(min-width: 768px) 60vw, 100vw`) |
| `public/images/catlakkabuk.jpg` | JPG | 939×1674 | 388 KB | 366 KB | q85 | 1400 px (/gunluk/2026-09-13-catlak-kabuk@768:672x504) → kaynak 939 px | kod: content/journal.ts; next/image (sizes: `160px` · `(min-width: 768px) 42rem, 100vw`) |
| `public/images/ceviz-bahce.jpeg` | JPEG | 1920×1920 | 276 KB | 255 KB | q82 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/field-tractor.jpg` | JPG | 1200×1600 | 232 KB | 190 KB | q72 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/file-badem.jpg` | JPG | 1086×1448 | 399 KB | 334 KB | q80 | 1104 px (gallery-main) → kaynak 1086 px | DB: product_images×1; kod: content/homepage.ts; next/image (sizes: `(min-width: 768px) 40vw, 100vw` · `120px`) |
| `public/images/findik1.jpeg` | JPEG | 375×375 | 117 KB | 58 KB | q95 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/findik2.jpeg` | JPEG | 800×600 | 56 KB | 46 KB | q69 | kart yedeği (ölçülmedi) | kod: content/homepage.ts |
| `public/images/findik3.jpeg` | JPEG | 528×351 | 191 KB | 65 KB | q87 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/gunluk-2026-03-01-subat-kis.jpeg` | JPEG | 1144×2040 | 289 KB | 239 KB | q72 | 1400 px (/gunluk/2026-02-25-kis-gunu@768:672x504) → kaynak 1144 px | kod: content/journal.ts; next/image (sizes: `160px` · `(min-width: 768px) 42rem, 100vw`) |
| `public/images/gunluk-2026-03-15-kaolin.mp4` | MP4/H264 | 478×850 | 3.77 MB | 3.77 MB |  | — | kod: content/journal.ts; content/journal.ts → app/gunluk/[slug]/page.tsx &lt;video controls preload=none&gt; (672×378 kutu) |
| `public/images/gunluk-2026-04-01-tomurcuk.jpeg` | JPEG | 1400×1400 | 214 KB | 110 KB | q77 | 1400 px (/gunluk/2026-04-01-tomurcuk@768:672x504) | kod: content/journal.ts; next/image (sizes: `160px` · `(min-width: 768px) 42rem, 100vw`) |
| `public/images/gunluk-2026-04-10-bakla.jpeg` | JPEG | 900×1605 | 355 KB | 290 KB | q54 | 1400 px (/gunluk/2026-04-07-mavi-legen@768:672x504) → kaynak 900 px | kod: content/journal.ts; next/image (sizes: `160px` · `(min-width: 768px) 42rem, 100vw`) |
| `public/images/gunluk-2026-04-11-mayis-tomurcuk.jpeg` | JPEG | 960×1356 | 308 KB | 258 KB | q62 | 1400 px (/gunluk/2026-04-11-tomurcuk-cicek@768:672x504) → kaynak 960 px | kod: content/journal.ts; next/image (sizes: `160px` · `(min-width: 768px) 42rem, 100vw`) |
| `public/images/gunluk-2026-08-25-yesil-kabuk.jpeg` | JPEG | 1280×1280 | 284 KB | 252 KB | q73 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/gunluk-2026-09-13-catlak-kabuk.jpeg` | JPEG | 1144×2040 | 387 KB | 387 KB | değişmedi | 976 px (/@1280:468x624) | kod: content/homepage.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/ihlamur.jpeg` | JPEG | 1400×1173 | 499 KB | 463 KB | q83 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/ilkdikim.jpg` | JPG | 1086×1448 | 516 KB | 431 KB | q81 | 1112 px (/ciftlik@1280:532x399) → kaynak 1086 px | kod: content/farm.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/kabia-badem.jpeg` | JPEG | 1536×2040 | 445 KB | 345 KB | q69 | 1864 px (/ureticiler/kabia-ciftligi@1024:896x504) → kaynak 1536 px | DB: producers.photo_url×1; kod: content/producers.ts; next/image (sizes: `(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw` · `(min-width: 1024px) 56rem, 100vw`); OG görseli (496×502 kırpma, lib/og-image.tsx) |
| `public/images/kabia-badem2.jpeg` | JPEG | 1536×2040 | 469 KB | 380 KB | q71 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/kabuklu-badem-acik.jpeg` | JPEG | 1400×1859 | 570 KB | 441 KB | q76 | kullanılmıyor | yalnızca testlerde (tests/shop-banner.test.ts); üretimde kullanılmıyor |
| `public/images/kabuklu-ceviz.jpeg` | JPEG | 527×500 | 43 KB | 37 KB | q71 | kullanılmıyor | yalnızca testlerde (tests/admin-producer-fields.test.ts, tests/admin-product-fields.test.ts, tests/admin-product-schema.test.ts, tests/affected-route-contracts.test.ts); üretimde kullanılmıyor |
| `public/images/kabuklu-ceviz1.jpeg` | JPEG | 1023×928 | 349 KB | 255 KB | q87 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/kavanoz-alic.jpg` | JPG | 1371×1148 | 210 KB | 169 KB | q79 | 1640 px (gallery-main) → kaynak 1371 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/kavanoz-bal.jpg` | JPG | 1371×1148 | 310 KB | 265 KB | q81 | 1640 px (gallery-main) → kaynak 1371 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/kavanoz-elma.jpg` | JPG | 1370×1148 | 228 KB | 182 KB | q79 | 1640 px (gallery-main) → kaynak 1370 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/kavanoz-salca.jpg` | JPG | 1370×1148 | 239 KB | 200 KB | q80 | 1640 px (gallery-main) → kaynak 1370 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/kilimbadem.jpg` | JPG | 1672×941 | 418 KB | 335 KB | q79 | 4000 px (/@1920:1920x1027) → kaynak 1672 px | kod: content/homepage.ts; next/image (sizes: `100vw`) |
| `public/images/logo.svg` | SVG | vektör | 2 KB | 2 KB |  | — | kod: app/admin/login/page.tsx, app/admin/sifre-degistir/page.tsx, app/layout.tsx, components/admin/admin-shell.tsx, components/layout/site-footer.tsx, components/layout/site-header.tsx, lib/seo.ts; düz &lt;img&gt; (logo) |
| `public/images/marina-ilk-dikim.jpeg` | JPEG | 1200×1600 | 412 KB | 361 KB | q74 | kullanılmıyor | yalnızca testlerde (tests/brand-revision.spec.ts); üretimde kullanılmıyor |
| `public/images/marinada-2022.jpeg` | JPEG | 1200×1600 | 454 KB | 454 KB | değişmedi | 1112 px (/ciftlik@1280:532x399) | kod: content/farm.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/marinada-2023.jpeg` | JPEG | 740×1600 | 258 KB | 225 KB | q74 | 1112 px (/ciftlik@1280:532x399) → kaynak 740 px | kod: content/farm.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/marinada-2024.jpeg` | JPEG | 1112×1112 | 250 KB | 94 KB | q80 | 1112 px (/ciftlik@1280:532x399) | kod: content/farm.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/marinada-2025-don.jpeg` | JPEG | 1112×1112 | 860 KB | 498 KB | q92 | 1112 px (/ciftlik@1280:532x399) | kod: content/farm.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/marinada-2025-ilkcicek.jpeg` | JPEG | 1112×1112 | 762 KB | 451 KB | q93 | 1112 px (/ciftlik@1280:532x399) | kod: content/farm.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/necmettin-sivaci.jpg` | JPG | 768×1152 | 305 KB | 230 KB | q90 | 768 px (/ciftlik@414:366x488) | kod: app/ciftlik/page.tsx; next/image (sizes: `(min-width: 768px) 33vw, 100vw`) |
| `public/images/orchard-hillside.jpg` | JPG | 1352×1353 | 824 KB | 537 KB | q88 | 1352 px (/giris@1280:520x650) | kod: app/giris/page.tsx, components/auth/auth-flow-page.tsx, components/auth/forgot-password-flow.tsx, components/auth/status-screen.tsx, content/farm.ts, content/homepage.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw` · `50vw`) |
| `public/images/orchard-winter.jpg` | JPG | 1112×1112 | 250 KB | 94 KB | q80 | 1112 px (/@1280:532x399) | kod: content/homepage.ts; next/image (sizes: `(min-width: 768px) 45vw, 100vw`) |
| `public/images/organik-sertifika.jpg` | JPG | 1056×1489 | 605 KB | 347 KB | q86 | 1104 px (gallery-main) → kaynak 1056 px | DB: product_images×1; kod: content/farm.ts; next/image (sizes: `(max-width: 767px) 100vw, 40vw` · `120px`) |
| `public/images/paketli-badem.jpg` | JPG | 1369×1149 | 260 KB | 216 KB | q80 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/paketli-ceviz.jpg` | JPG | 1369×1149 | 270 KB | 226 KB | q80 | 1640 px (gallery-main) → kaynak 1369 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/paketli-eriste.jpg` | JPG | 1371×1148 | 280 KB | 237 KB | q81 | 1640 px (gallery-main) → kaynak 1371 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/paketli-findik.jpg` | JPG | 1369×1149 | 261 KB | 218 KB | q80 | 1640 px (gallery-main) → kaynak 1369 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/paketli-ihlamur.jpg` | JPG | 1369×1149 | 242 KB | 204 KB | q80 | 1640 px (gallery-main) → kaynak 1369 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/paketli-tarhana.jpg` | JPG | 1536×1024 | 284 KB | 245 KB | q82 | 2064 px (gallery-main) → kaynak 1536 px | DB: product_images×1; next/image (sizes: `120px`) |
| `public/images/resim22.jpg` | JPG | 1080×1022 | 263 KB | 237 KB | q74 | kullanılmıyor | yalnızca testlerde (tests/brand-revision.spec.ts); üretimde kullanılmıyor |
| `public/images/sertifika.jpeg` | JPEG | 719×1014 | 498 KB | 143 KB | q86 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/uretim-bicim.jpg` | JPG | 1136×1136 | 832 KB | 474 KB | q92 | 1136 px (/ciftlik@1280:544x408) | kod: app/ciftlik/page.tsx; next/image (sizes: `(min-width: 768px) 50vw, 100vw`) |
| `public/images/uretim-surmeme.jpg` | JPG | 1136×1136 | 992 KB | 522 KB | q91 | 1136 px (/ciftlik@1280:544x408) | kod: app/ciftlik/page.tsx; next/image (sizes: `(min-width: 768px) 50vw, 100vw`) |
| `public/images/valley-ridge.jpg` | JPG | 1920×1920 | 388 KB | 307 KB | q76 | kullanılmıyor | hiçbir yerde referans yok |
| `public/images/yesilbadem.jpg` | JPG | 1254×1254 | 442 KB | 422 KB | kayıpsız | 1400 px (/gunluk/2026-08-25-yesil-kabuk@768:672x504) → kaynak 1254 px | kod: app/ciftlik/page.tsx, content/journal.ts; next/image (sizes: `(min-width: 768px) 50vw, 100vw` · `160px` · `(min-width: 768px) 42rem, 100vw`) |
| `public/og-default.jpg` | JPG | 1200×630 | 252 KB | 252 KB |  | — | kod: app/layout.tsx, lib/settings.ts; site_settings.seo_social_image (OG/Twitter, 1200×630) |
| `public/video/kabia-hero-mobile.av1.mp4` | MP4/AV1 | 720×406 | 2.46 MB | 2.33 MB |  | — | kod: components/home/intro-sequence.tsx; components/home/intro-sequence.tsx (&lt;video&gt;&lt;source&gt;) |
| `public/video/kabia-hero-mobile.mp4` | MP4/H264 | 720×406 | 2.89 MB | 3.73 MB |  | — | kod: components/home/intro-sequence.tsx; components/home/intro-sequence.tsx (&lt;video&gt;&lt;source&gt;) |
| `public/video/kabia-hero-poster.jpg` | JPG | 1280×720 | 199 KB | 376 KB |  | — | kod: components/home/intro-sequence.tsx; components/home/intro-sequence.tsx (&lt;video poster&gt; + CSS arka plan) |
| `public/video/kabia-hero.av1.mp4` | MP4/AV1 | 1280×720 | 5.21 MB | 4.24 MB |  | — | kod: components/home/intro-sequence.tsx; components/home/intro-sequence.tsx (&lt;video&gt;&lt;source&gt;) |
| `public/video/kabia-hero.mp4` | MP4/H264 | 1280×720 | 11.99 MB | 5.92 MB |  | — | kod: components/home/intro-sequence.tsx; components/home/intro-sequence.tsx (&lt;video&gt;&lt;source&gt;) |
| `app/apple-icon.png` | PNG | 180×180 | 5 KB | 5 KB |  | — | Next dosya tabanlı apple-icon |

## Video

Hero videosu `intro-sequence.tsx` içinde `<video muted loop playsInline preload="none">`; tarayıcı her kesme noktasında (≤768 / ≥769 px) önce AV1'i, desteklemiyorsa H.264'ü seçer. Dört kodlama da aynı yeni 1280×720 H.264 kaynaktan üretildi (mobil: 720×406'ya küçültülerek; SAR 406:405, önceki mobil dosyalarla aynı), 450 kare, 29,97 fps, ses yok, `moov` başta. Yeni AV1 ile yeni H.264'ün içeriği aynıydı (kare ortalama mutlak farkı ≈ 1/255, kayma yok) — AV1 dosyaları güncel olmayan içerik taşımıyordu; yine de hepsi aynı kaynağa karşı ölçülüp yeniden üretildi.

| Dosya | Önce | Sonra | VMAF (önce → sonra) | Kodlayıcı |
|---|---|---|---|---|
| `kabia-hero.mp4` | 11.99 MB | 5.92 MB | kaynak → 95,28 | x264 veryslow, CRF 28,8 |
| `kabia-hero.av1.mp4` | 5.21 MB | 4.24 MB | 96,00 → 95,53 | SVT-AV1 preset 2, CRF 53 |
| `kabia-hero-mobile.mp4` | 2.89 MB | 3.73 MB | 91,16 → 95,33 | x264 veryslow, CRF 26 |
| `kabia-hero-mobile.av1.mp4` | 2.46 MB | 2.33 MB | 87,04 → 95,49 | SVT-AV1 preset 2, CRF 49 |
| `kabia-hero-poster.jpg` | 199 KB | 376 KB | SSIM 0,981 | mozjpeg q88, yeni videonun 0. karesi |

VMAF: kaynağa karşı (mobil için kaynağın 720×406'ya lanczos ile küçültülmüşüne karşı), varsayılan `vmaf_v0.6.1` modeli. Poster önceden videonun ilk karesi değildi (SSIM 0,33; aynı sahnenin farklı, daha yumuşak bir karesi); şimdi yeni videonun ilk karesidir. VMAF ≥ 95 kuralı mobil H.264'ü öncekinden büyük yaptı (2,89 → 3,73 MB): önceki dosya kaynağa karşı VMAF 91'deydi.

`public/images/gunluk-2026-03-15-kaolin.mp4` (478×850, H.264 + AAC, 3,77 MB) değiştirilmedi: CRF 27 ile 2,0 MB'a iniyor ama VMAF 87,9'a düşüyor; ≥ 95 için mevcut bit hızının büyük kısmı gerekiyor, yani belirgin biçimde fazla büyük değil.

## Değişmeyenler

- `public/email/kabia-logo@2x.png`, `public/icon-192.png`, `app/apple-icon.png`, `public/og-default.jpg`: next/image dışında kullanılıyor; kayıpsız kazanç yok ya da sosyal önizleme tarayıcı uyumluluğu riskine değmiyor (og-default: yalnızca progressive'e çevirince %6). `icon-512.png` piksel-özdeş şekilde kayıpsız yeniden sıkıştırıldı.
- SSIM kapısıyla küçültülemeyenler: `almonds-net.jpg` (değişmedi), `bademagaclari.jpg` (yalnızca kayıpsız), `gunluk-2026-09-13-catlak-kabuk.jpeg` (değişmedi), `marinada-2022.jpeg` (değişmedi), `yesilbadem.jpg` (yalnızca kayıpsız).
