/**
 * Müşteri kargo takibi — saf yardımcılar (istemci + sunucu).
 *
 * `tracking_carrier` / `tracking_number`, yöneticinin yazdığı alanlardır
 * (orders tablosu, `updateTrackingAction`). Müşteri kendi siparişini
 * `orders_select_own` politikasıyla okur; politika satır düzeyindedir ve
 * sütun kısıtı yoktur, yani bu iki alan `select("*")` ile zaten gelir —
 * politika değişikliği gerekmedi (2026-09-27 canlıda doğrulandı).
 *
 * Takip bağlantısı kuralı: yalnızca resmi sitesinde GET ile derin bağlantı
 * biçimi doğrulanmış taşıyıcılar bağlanır; doğrulanamayan için bağlantı
 * gösterilmez (tahmin yürütülmez). 2026-09-27 doğrulama turu:
 *   - Aras (araskargo.com.tr): ana sayfadaki takip JS widget'ı, GET biçimi yok.
 *   - Yurtiçi (yurticikargo.com/.../gonderi-sorgula): JS ile sorgu, GET biçimi yok.
 *   - MNG → DHL eCommerce (mngkargo.com.tr): /gonderi-takip'e captcha'lı POST.
 *   - PTT (gonderitakip.ptt.gov.tr): siteden erişilemedi; bilinen biçim POST tabanlı.
 *   - Sürat (suratkargo.com.tr/KargoTakip/): captcha'lı POST (`action="/KargoTakip/"`).
 * Sonuç: bugün doğrulanmış taşıyıcı yok — liste bilerek boş. Bir taşıyıcının
 * resmi sitesinde GET biçimi doğrulanınca buraya tek satır eklenir.
 */

/** Doğrulanmış taşıyıcı anahtarı → takip sayfası kurucusu. Bugün boş. */
const VERIFIED_CARRIER_TRACKING_URLS: Record<string, (trackingNumber: string) => string> = {}

/** Yönetici serbest metnini (`Örn. Aras Kargo`) kanonik anahtara indirir. */
export function normalizeCarrierName(carrier: string | null | undefined): string | null {
  if (typeof carrier !== "string") return null
  const lowered = carrier.trim().toLocaleLowerCase("tr-TR")
  if (lowered === "") return null
  if (lowered.includes("aras")) return "aras"
  if (lowered.includes("yurtiçi") || lowered.includes("yurtici")) return "yurtici"
  if (lowered === "mng" || lowered.includes("mng kargo") || lowered.includes("dhl ecommerce") || lowered === "dhl") return "mng"
  if (lowered.includes("ptt")) return "ptt"
  if (lowered.includes("sürat") || lowered.includes("surat")) return "surat"
  if (lowered.includes("ups")) return "ups"
  if (lowered.includes("fedex")) return "fedex"
  return lowered
}

function cleanNumber(trackingNumber: string | null | undefined): string | null {
  if (typeof trackingNumber !== "string") return null
  const trimmed = trackingNumber.trim()
  return trimmed === "" ? null : trimmed
}

/** Sabit taban + kodlanmış takip numarası. */
export function buildTrackingUrl(base: string, trackingNumber: string): string {
  return `${base}${encodeURIComponent(trackingNumber)}`
}

/**
 * Doğrulanmış taşıyıcı takip URL'si; doğrulanmamış, bilinmeyen ya da
 * numarasız durumda null (bağlantı gösterilmez).
 */
export function carrierTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const number = cleanNumber(trackingNumber)
  if (!number) return null
  const key = normalizeCarrierName(carrier)
  if (!key) return null
  const build = VERIFIED_CARRIER_TRACKING_URLS[key]
  if (!build) return null
  return build(number)
}

/** İkisinden biri doluysa takip bilgisi var sayılır (boşluk sayılmaz). */
export function hasTracking(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): boolean {
  return normalizeCarrierName(carrier) !== null || cleanNumber(trackingNumber) !== null
}

/** Liste satırı için kısa özet; yoksa null (yer tutucu metin yok). */
export function formatTrackingLine(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const name = typeof carrier === "string" ? carrier.trim() : ""
  const number = cleanNumber(trackingNumber)
  if (name !== "" && number) return `${name} · Takip no: ${number}`
  if (name !== "") return name
  if (number) return `Takip no: ${number}`
  return null
}
