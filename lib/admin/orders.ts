/**
 * Order and stock vocabulary — pure data, no JSX.
 *
 * Kept separate from components/admin/ui/status.tsx so the rules can be
 * imported by anything: server actions, tests, and the badge components alike.
 * The status components re-export these, so there is still one import site for
 * UI code.
 */

export const ORDER_STATUSES = [
  "hazirlaniyor",
  "kargoda",
  "teslim_edildi",
  "iptal_edildi",
] as const

export type OrderStatusValue = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  hazirlaniyor: "Hazırlanıyor",
  kargoda: "Kargoda",
  teslim_edildi: "Teslim edildi",
  iptal_edildi: "İptal edildi",
}

/**
 * Which status moves are legal.
 *
 * This mirrors the `enforce_order_status_transition` trigger exactly. The
 * database is authoritative — this copy exists so the interface never offers a
 * button that is guaranteed to fail, and so the rule can be unit-tested without
 * a database round trip.
 *
 * Delivered and cancelled are terminal: there is no path out of either, and in
 * particular no "un-cancel", because with no payment provider integrated a
 * cancellation cannot be financially reversed from here.
 */
export const ORDER_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  hazirlaniyor: ["kargoda", "teslim_edildi", "iptal_edildi"],
  kargoda: ["hazirlaniyor", "teslim_edildi", "iptal_edildi"],
  teslim_edildi: ["hazirlaniyor", "kargoda", "iptal_edildi"],
  iptal_edildi: ["hazirlaniyor", "kargoda", "teslim_edildi"],
}

export function canTransition(from: OrderStatusValue, to: OrderStatusValue): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

export type StockLevel = "out" | "low" | "healthy"

/** Compared against the product's own threshold, not a global constant. */
export function stockLevel(quantity: number, threshold: number): StockLevel {
  if (quantity <= 0) return "out"
  if (quantity <= threshold) return "low"
  return "healthy"
}

export function stockLevelFromStatus(status: "tukendi" | "kritik" | "yeterli"): StockLevel {
  if (status === "tukendi") return "out"
  if (status === "kritik") return "low"
  return "healthy"
}
