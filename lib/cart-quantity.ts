// Server is authoritative (create_order range-checks 1..99 and cart_items
// carries cart_items_quantity_range); this keeps every client write inside
// the same bound so a tampered localStorage value or console call can never
// stage an out-of-range quantity. Pure module: safe to unit-test database-free.

export const CART_QTY_MIN = 1
export const CART_QTY_MAX = 99

export function clampCartQuantity(q: unknown): number {
  const n = Math.floor(Number(q))
  if (!Number.isFinite(n)) return CART_QTY_MIN
  if (n < CART_QTY_MIN) return CART_QTY_MIN
  if (n > CART_QTY_MAX) return CART_QTY_MAX
  return n
}
