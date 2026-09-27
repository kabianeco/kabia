"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import type { OrderItemRow, OrderRow } from "@/lib/supabase/rows"

export type OrderStatus = "hazirlaniyor" | "kargoda" | "teslim-edildi" | "iptal-edildi"

export interface OrderItem {
  id: string
  slug: string
  name: string
  variant: string
  price: number
  quantity: number
  image: string
  variantId: string | null
  productId: string | null
}

export interface OrderAddress {
  label: string
  recipientName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  district: string
  postalCode: string
}

export interface OrderRecord {
  id: string
  date: string // ISO
  status: OrderStatus
  items: OrderItem[]
  subtotal: number
  shippingCost: number
  total: number
  fullName: string
  email: string
  address: OrderAddress
  paymentLabel: string
  /** Yöneticinin girdiği kargo firması (yoksa null). */
  trackingCarrier: string | null
  /** Yöneticinin girdiği takip numarası (yoksa null). */
  trackingNumber: string | null
  /** Recorded status changes, oldest first (order_status_history). */
  history: { status: OrderStatus; at: string }[]
}

/** A single-order read: the order, "not found", or a failed read. */
export type OrderLookup = { status: "found"; order: OrderRecord } | { status: "missing" } | { status: "error" }

interface OrdersContextValue {
  orders: OrderRecord[]
  fetchOrder: (orderNumber: string) => Promise<OrderLookup>
  refresh: () => Promise<void>
  hydrated: boolean
  /** True when the last list read failed — distinct from "no orders". */
  error: boolean
}

const OrdersContext = createContext<OrdersContextValue | null>(null)

function mapStatus(s: string): OrderStatus {
  if (s === "teslim_edildi") return "teslim-edildi"
  if (s === "iptal_edildi") return "iptal-edildi"
  return s as OrderStatus
}

function mapOrderItem(i: OrderItemRow): OrderItem {
  return {
    id: `${i.product_slug_snapshot}__${i.variant_label_snapshot}`,
    slug: i.product_slug_snapshot,
    name: i.product_name_snapshot,
    variant: i.variant_label_snapshot,
    price: Number(i.unit_price_snapshot),
    quantity: i.quantity,
    image: i.product_image_snapshot,
    variantId: i.variant_id,
    productId: i.product_id,
  }
}

function mapOrder(o: OrderRow): OrderRecord {
  const carrier = typeof o.tracking_carrier === "string" && o.tracking_carrier.trim() !== ""
    ? o.tracking_carrier.trim()
    : null
  const number = typeof o.tracking_number === "string" && o.tracking_number.trim() !== ""
    ? o.tracking_number.trim()
    : null
  return {
    id: o.order_number,
    date: o.created_at,
    status: mapStatus(o.status),
    items: (o.order_items ?? []).map(mapOrderItem),
    subtotal: Number(o.subtotal),
    shippingCost: Number(o.shipping_cost),
    total: Number(o.total),
    fullName: o.full_name,
    email: o.email,
    address: o.shipping_address ?? {
      label: "", recipientName: "", phone: "", addressLine1: "", addressLine2: "", city: "", district: "", postalCode: "",
    },
    paymentLabel: o.payment_method_snapshot?.label ?? "",
    trackingCarrier: carrier,
    trackingNumber: number,
    history: (o.order_status_history ?? [])
      .map((h) => ({ status: mapStatus(h.status), at: h.changed_at }))
      .sort((a, b) => a.at.localeCompare(b.at)),
  }
}

const ORDER_SELECT = "*, order_items(*), order_status_history(status, changed_at)"

export function OrdersProvider({ children }: { children: ReactNode }) {
  // §8.3: no render-time client — acquired inside async work only.
  const { userId, hydrated: authHydrated } = useAuth()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setOrders([])
      setError(false)
      return
    }
    const supabase = await getSupabaseBrowserClient()
    // Filtered by user_id explicitly. Administrators can now SELECT every order
    // for the dashboard, so an unfiltered select would hand an admin the whole
    // order book on their own account page.
    const { data, error: readError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
    setError(!!readError)
    if (!readError) setOrders((data ?? []).map(mapOrder))
  }, [userId])

  useEffect(() => {
    if (!authHydrated) return
    ;(async () => {
      await refresh()
      setHydrated(true)
    })()
  }, [authHydrated, refresh])

  const fetchOrder = useCallback(
    async (orderNumber: string): Promise<OrderLookup> => {
      if (!userId) return { status: "missing" }
      const supabase = await getSupabaseBrowserClient()
      const { data, error: readError } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("order_number", orderNumber)
        .eq("user_id", userId)
        .maybeSingle()
      if (readError) return { status: "error" }
      return data ? { status: "found", order: mapOrder(data) } : { status: "missing" }
    },
    [userId],
  )

  const value = useMemo(
    () => ({ orders, fetchOrder, refresh, hydrated, error }),
    [orders, fetchOrder, refresh, hydrated, error],
  )

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider")
  return ctx
}
