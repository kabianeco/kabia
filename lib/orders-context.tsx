"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
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
}

interface OrdersContextValue {
  orders: OrderRecord[]
  fetchOrder: (orderNumber: string) => Promise<OrderRecord | null>
  refresh: () => Promise<void>
  hydrated: boolean
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
  }
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const supabase = createSupabaseBrowserClient()
  const { userId, hydrated: authHydrated } = useAuth()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [hydrated, setHydrated] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setOrders([])
      return
    }
    // Filtered by user_id explicitly. Administrators can now SELECT every order
    // for the dashboard, so an unfiltered select would hand an admin the whole
    // order book on their own account page.
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
    setOrders((data ?? []).map(mapOrder))
  }, [supabase, userId])

  useEffect(() => {
    if (!authHydrated) return
    ;(async () => {
      await refresh()
      setHydrated(true)
    })()
  }, [authHydrated, refresh])

  const fetchOrder = useCallback(
    async (orderNumber: string): Promise<OrderRecord | null> => {
      if (!userId) return null
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("order_number", orderNumber)
        .eq("user_id", userId)
        .maybeSingle()
      return data ? mapOrder(data) : null
    },
    [supabase, userId],
  )

  const value = useMemo(
    () => ({ orders, fetchOrder, refresh, hydrated }),
    [orders, fetchOrder, refresh, hydrated],
  )

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const ctx = useContext(OrdersContext)
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider")
  return ctx
}
