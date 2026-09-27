import type { PaymentData } from "./types"

/**
 * Ödeme adımında kart alınmaz: ödeme sağlayıcısı entegrasyonu yok, kart
 * bilgisiyle sipariş oluşturmak tahsilat yapılmadan sipariş üretirdi.
 * Tek yöntem kapıda ödemedir; sunucu (`create_order`) başka yöntemi
 * reddeder.
 */
export function isPaymentValid(data: PaymentData): boolean {
  return data.method === "cod"
}
