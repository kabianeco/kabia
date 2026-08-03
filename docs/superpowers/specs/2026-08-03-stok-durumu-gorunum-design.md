# Stok durumu: admin hızlı işaretleme, mağaza ibaresi, görünüm kontrolü — tasarım

**Tarih:** 2026-08-03
**Durum:** Onaylandı, uygulanacak

## Amaç

Üç bağımsız ama ilişkili değişiklik:

1. Admin panelde stok düzenleme diyaloguna, ürünü tek adımda "stokta yok" durumuna çeken bir kısayol eklemek.
2. Mağaza tarafında (ürün kartı ve ürün detay sayfası) stokta olmayan ürünlerde "Stokta yok" ibaresinin hem görselde hem de ürün bilgisinin hemen altında açıkça belirtilmesini sağlamak.
3. Bu "Stokta yok" rozetinin görünümünü (görünürlük, renk, dolgu, konum, kenar boşluğu, köşe yuvarlaklığı) admin panelindeki Görünüm ekranından kontrol edilebilir hale getirmek.

## Kapsam dışı

- Stok hareketinin denetim (audit) mekanizması değişmiyor — her hareket hâlâ gerekçeli ve `admin_adjust_stock` RPC'si üzerinden, hâlâ negatife düşemiyor.
- Rozetin metni ("Stokta yok") serbest metin olarak düzenlenebilir değil; sabit.
- Renk serbest renk seçici değil, sitenin onaylı renk paletinden (Görünüm motorunun geri kalanıyla aynı "kısıtlı sözlük" ilkesi).

## 1. Admin — stok diyaloguna "Stokta yok olarak işaretle"

`app/admin/(protected)/inventory/adjust-stock.tsx`:

- Diyalog başlığının hemen altına, "Yön" alanından önce bir buton eklenir: **"Stokta yok olarak işaretle"**.
- Tıklanınca: `direction` → `"decrease"`, `quantity` → mevcut stok miktarına eşitlenir (`String(currentStock)`), `reason` → yeni eklenen `"Stokta yok"` gerekçesine ayarlanır. Kullanıcı hâlâ "Güncelle"ye basarak onaylar.
- `currentStock === 0` iken buton devre dışı bırakılır (yapılacak bir şey yok).
- `REASONS` listesine `"Stokta yok"` eklenir (ikinci sıra, `"Sayım düzeltmesi"`den hemen sonra).
- `admin_adjust_stock` RPC'si, denetim tablosu ve negatife düşmeme kuralı değişmeden aynen kullanılır.

## 2. Mağaza — "Stokta yok" ibaresi

`components/shop/product-entry.tsx` (mağaza listesi, favoriler, benzer ürünler — hepsi bu bileşeni paylaşıyor) ve `components/shop/product-detail.tsx`:

- Görsel üzerindeki mevcut rozet metni "Tükendi" → **"Stokta yok"** olarak değiştirilir.
- Ürün adı/fiyatın hemen altına, `!available` durumunda ayrı bir satır eklenir: **"Stokta yok"** (clay tonunda, `label` stiliyle). Bu satır, aşağıdaki 3. bölümdeki görünürlük kontrolünden **etkilenmez** — her zaman görünür kalır, çünkü asıl "açıkça belirtsin" isteğini karşılayan budur.
- `product-detail.tsx`'teki devre dışı "Sepete ekle" butonu, tutarlılık için "Tükendi" yerine "Stokta yok" yazar.
- Admin paneldeki stok tablosu rozeti ("Tükendi", `components/admin/ui/status.tsx`) değişmez — bu iç/yönetim terminolojisi, kapsam dışı.

## 3. Görünüm paneli — rozet kontrolü

Mevcut Görünüm motoru (`ThemeOverrides` → `schema.ts` doğrulama → `resolve.ts` CSS değişkenleri → İnce Ayar paneli grupları), kısıtlı/onaylı değer listeleriyle çalışıyor; serbest CSS girişi yok. Aynı deseni izleyen yeni bir **`stockBadge`** override grubu eklenir — yalnızca **görsel üzerindeki rozeti** etkiler, kartın altındaki sabit "Stokta yok" metnini etkilemez.

### Veri modeli — `lib/theme-engine/types.ts`

```ts
stockBadge?: {
  visible?: boolean;        // varsayılan true
  tone?: "clay" | "ink" | "brand" | "olive" | "shell";   // varsayılan "clay"
  fill?: "solid" | "outline" | "text";                    // varsayılan "solid"
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"; // varsayılan "top-left"
  inset?: number;            // px, varsayılan 8 (bugünkü bitişik/0 yerine)
  radius?: number;           // px, kendi bağımsız kontrolü — "Etiket" (badge) yarıçapından ayrı
};
```

### Doğrulama — `lib/theme-engine/schema.ts`

`themeOverridesSchema` içine `stockBadge` alanı eklenir:
- `visible`: boolean (string `"true"/"false"` da kabul edilir, mevcut boolean alan deseniyle tutarlı).
- `tone`: `optionalEnum(["clay", "ink", "brand", "olive", "shell"])`.
- `fill`: `optionalEnum(["solid", "outline", "text"])`.
- `position`: `optionalEnum(["top-left", "top-right", "bottom-left", "bottom-right"])`.
- `inset`: `numField` ile `[0, 2, 4, 8, 12, 16]` allowlist'i.
- `radius`: `numField` ile mevcut `radiusValues` allowlist'i (`[0, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 999]`).

### Çözümleme — `lib/theme-engine/resolve.ts`

Yeni CSS değişkenleri üretilir:
- `--theme-stock-badge-display`: `visible` → `inline-flex` / `none`.
- `--theme-stock-badge-color`: `tone` → `var(--color-clay|ink|brand|olive|shell)`.
- `--theme-stock-badge-bg`, `--theme-stock-badge-border`: `fill`'e göre — `solid` bugünkü `bg-ivory/95`'e karşılık gelen değer + kenarlıksız; `outline` saydam arka plan + `1px solid currentColor`; `text` saydam arka plan + kenarlıksız.
- `--theme-stock-badge-top/right/bottom/left`: `position` hangi köşeyse o iki kenara `inset`px, diğer iki kenara `auto`.
- `--theme-stock-badge-radius`: `radius`px (mevcut `--theme-radius-badge`'den bağımsız, ayrı bir değişken).

Preset'ler bu grup için varsayılan üretmez (radius/border/shadow gibi preset'e bağlı değil) — tamamen override + sabit varsayılan; `ov.stockBadge?.x ?? DEFAULT`.

### Editör arayüzü — `components/theme/fine-tune-controls.tsx`

İnce Ayar panelinde, "Yoğunluk" grubundan sonra yeni bir **"Stok rozeti"** grubu eklenir; mevcut `Segmented` bileşeni yeniden kullanılır (yeni bir UI birincili gerekmez):

- Görünürlük: Göster / Gizle (`Segmented<boolean>`, `labels={{ true: "Göster", false: "Gizle" }}`).
- Renk: Kil / İnk / Marka / Zeytin / Kabuk.
- Dolgu: Dolu / Anahat / Sade metin.
- Konum: Sol üst / Sağ üst / Sol alt / Sağ alt.
- Kenar boşluğu: 0 / 2 / 4 / 8 / 12 / 16 (px etiketli).
- Köşe yuvarlaklığı: mevcut `RADIUS_VALUES` listesi, mevcut radius `Segmented` kontrolleriyle aynı görünüm.

`editor-logic.ts`'te değişiklik gerekmez — `applyOverride`/`resetGroup` zaten herhangi bir grup/anahtar için jenerik çalışıyor.

### Tüketen bileşenler — `product-entry.tsx`, `product-detail.tsx`

Rozet `<span>`'lerindeki sabit `absolute left-0 top-0 bg-ivory/95 ...` Tailwind sınıfları kaldırılıp, `style` üzerinden yukarıdaki CSS değişkenlerini okuyan bir yapıya geçilir (`display`, `color`, `background`, `border`, `top/right/bottom/left`, `border-radius`). Taslak/yayın/sürüm geçmişi akışı (`saveDraftAction`, `publishThemeFormAction`, önizleme) hiç değişmeden aynen çalışır — bu yalnızca var olan mekanizmaya yeni bir kayıtlı grup eklemektir.

## Test / doğrulama

- `npm run build` / `tsc` tip kontrolü.
- Görünüm panelinde her yeni kontrolün taslağı kaydedip yayınladıktan sonra mağaza sayfasında ve ürün detayında (stoksuz bir ürünle) doğru yansıdığının manuel kontrolü.
- Stok diyalogunda "Stokta yok olarak işaretle" akışının: normal stoklu bir varyantta sıfıra çektiğini, zaten sıfır olan varyantta butonun devre dışı olduğunu doğrulamak.
