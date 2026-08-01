import { cn } from "@/lib/utils"
import type { AppRole } from "@/lib/admin/roles"
import { ROLE_LABELS } from "@/lib/admin/roles"
import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  stockLevel,
  type OrderStatusValue,
  type StockLevel,
} from "@/lib/admin/orders"

// The rules live in lib/admin/orders.ts (pure, no JSX, unit-testable). They are
// re-exported here so UI code keeps a single import site.
export { ORDER_STATUS_LABELS, ORDER_TRANSITIONS, stockLevel }
export type { OrderStatusValue, StockLevel }

/**
 * Status indicators.
 *
 * Every one carries its meaning in *text*, with colour and a marker shape as
 * reinforcement rather than as the signal — a status must still be readable
 * when colour is unavailable or indistinguishable. The markers differ in shape
 * as well as hue for the same reason.
 */

const ORDER_STATUS: Record<OrderStatusValue, { label: string; tone: string; marker: string }> = {
  hazirlaniyor: { label: "Hazırlanıyor", tone: "text-shell", marker: "rounded-full bg-shell" },
  kargoda: { label: "Kargoda", tone: "text-olive", marker: "bg-olive" },
  teslim_edildi: {
    label: "Teslim edildi",
    tone: "text-brand",
    marker: "rounded-full bg-brand",
  },
  iptal_edildi: {
    label: "İptal edildi",
    tone: "text-clay",
    marker: "rotate-45 bg-clay",
  },
}

export function OrderStatusTag({
  status,
  className,
}: {
  status: OrderStatusValue
  className?: string
}) {
  const config = ORDER_STATUS[status] ?? ORDER_STATUS.hazirlaniyor
  return (
    <span className={cn("inline-flex items-center gap-2", config.tone, className)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0", config.marker)} />
      <span className="label whitespace-nowrap">{config.label}</span>
    </span>
  )
}

const STOCK: Record<StockLevel, { label: string; tone: string; marker: string }> = {
  out: { label: "Tükendi", tone: "text-clay", marker: "rotate-45 bg-clay" },
  low: { label: "Kritik", tone: "text-shell", marker: "rounded-full bg-shell" },
  healthy: { label: "Stokta", tone: "text-brand", marker: "rounded-full bg-brand" },
}

export function StockTag({ level, className }: { level: StockLevel; className?: string }) {
  const config = STOCK[level]
  return (
    <span className={cn("inline-flex items-center gap-2", config.tone, className)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0", config.marker)} />
      <span className="label whitespace-nowrap">{config.label}</span>
    </span>
  )
}

export function PublishTag({ active }: { active: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", active ? "text-brand" : "text-ink/45")}>
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 shrink-0", active ? "rounded-full bg-brand" : "bg-ink/30")}
      />
      <span className="label whitespace-nowrap">{active ? "Yayında" : "Arşivde"}</span>
    </span>
  )
}

export function RoleTag({ role, active = true }: { role: AppRole; active?: boolean }) {
  const isSuper = role === "super_admin"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        !active ? "text-ink/40" : isSuper ? "text-brand" : "text-ink/70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 shrink-0",
          !active ? "bg-ink/25" : isSuper ? "rounded-full bg-brand" : "bg-olive",
        )}
      />
      <span className="label whitespace-nowrap">{ROLE_LABELS[role]}</span>
    </span>
  )
}
