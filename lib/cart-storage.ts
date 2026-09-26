// Misafir sepeti kalıcılığı: localStorage yazımları senkron olmalı.
// Kök neden (Bug 1): addItem yalnızca setItems() çağırıp yazmayı bir
// useEffect'e bırakıyordu. Toast'taki "Sepete git" window.location.href ile
// tam sayfa yenilemesi yapar; kullanıcı hızlı tıklarsa effect çalışmadan
// sayfa yeniden yüklenir ve localStorage'daki eski (boş) değer okunur.
// Navbar Link ile gezinti aynı React state'i koruduğu için doğru görünürdü.
// Çözüm: misafir yazımlarını state güncellemesiyle aynı anda senkron yaz.
// Pure modül: database-free test edilebilir.

import { clampCartQuantity } from "@/lib/cart-quantity"

export const GUEST_CART_STORAGE_KEY = "kabia_cart"

export interface GuestCartItem {
  id: string
  slug: string
  name: string
  variant: string
  price: number
  quantity: number
  image: string
  variantId: string
  productId: string
}

/** localStorage'daki ham değeri sterilize ederek okur. */
export function readGuestCart(raw: string | null): GuestCartItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as GuestCartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((i) => ({ ...i, quantity: clampCartQuantity(i?.quantity) }))
  } catch {
    return []
  }
}

/** Bir sonraki misafir sepetini hesaplar (pure, test edilebilir). */
export function nextGuestCartAfterAdd(
  prev: GuestCartItem[],
  item: Omit<GuestCartItem, "quantity"> & { quantity?: number },
): GuestCartItem[] {
  const qty = clampCartQuantity(item.quantity ?? 1)
  const existing = prev.find((i) => i.id === item.id)
  if (existing) {
    return prev.map((i) => (i.id === item.id ? { ...i, quantity: Math.min(99, i.quantity + qty) } : i))
  }
  return [...prev, { ...item, quantity: qty }]
}

/** Sonraki miktarı hesaplar; quantity <= 0 ise satırı düşürür. */
export function nextGuestCartAfterQuantity(prev: GuestCartItem[], id: string, quantity: number): GuestCartItem[] {
  if (quantity <= 0) return prev.filter((i) => i.id !== id)
  return prev.map((i) => (i.id === id ? { ...i, quantity: clampCartQuantity(quantity) } : i))
}

/** Senkron yazım: effect beklenmeden çağrılmalı. */
export function writeGuestCart(items: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Kota/gizlilik hatası sepeti bozmamalı.
  }
}
