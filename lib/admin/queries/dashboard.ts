import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logQueryError } from "@/lib/admin/errors"
import { toNumber } from "@/lib/admin/format"
import type { OrderStatusValue } from "@/components/admin/ui/status"

/**
 * Everything the overview needs, in one place.
 *
 * Counting happens in Postgres. Nothing here fetches a table in order to call
 * `.length` on it: headline figures come from aggregation RPCs, list panels are
 * `LIMIT`-ed, and the counts on the list screens use `head: true` so no rows
 * cross the wire at all.
 *
 * Every read goes through the administrator's own session, so RLS is what
 * decides what is visible — the aggregation functions additionally re-check the
 * caller's role in their own bodies.
 */

export interface DashboardMetrics {
  revenueTotal: number
  revenuePeriod: number
  ordersTotal: number
  ordersPeriod: number
  ordersPreparing: number
  ordersShipped: number
  ordersDelivered: number
  ordersCancelled: number
  averageOrderValue: number
  customersTotal: number
  customersPeriod: number
  productsActive: number
  productsArchived: number
  productsOutOfStock: number
  productsLowStock: number
}

export const EMPTY_METRICS: DashboardMetrics = {
  revenueTotal: 0,
  revenuePeriod: 0,
  ordersTotal: 0,
  ordersPeriod: 0,
  ordersPreparing: 0,
  ordersShipped: 0,
  ordersDelivered: 0,
  ordersCancelled: 0,
  averageOrderValue: 0,
  customersTotal: 0,
  customersPeriod: 0,
  productsActive: 0,
  productsArchived: 0,
  productsOutOfStock: 0,
  productsLowStock: 0,
}

export interface SeriesPoint {
  date: string
  revenue: number
  orders: number
  customers: number
}

export interface TopProduct {
  productId: string
  name: string
  slug: string
  unitsSold: number
  revenue: number
}

export interface RecentOrder {
  id: string
  orderNumber: string
  fullName: string
  email: string
  total: number
  status: OrderStatusValue
  createdAt: string
}

export interface StockRisk {
  productId: string
  productName: string
  productSlug: string
  variantId: string
  variantLabel: string
  sku: string | null
  stock: number
  threshold: number
}

export interface RecentCustomer {
  id: string
  fullName: string
  createdAt: string
}

export interface RecentAdminAction {
  id: string
  action: string
  entityType: string
  entityId: string | null
  adminRole: string
  createdAt: string
  metadata: Record<string, unknown> | null
}

export interface DashboardData {
  metrics: DashboardMetrics
  series: SeriesPoint[]
  topProducts: TopProduct[]
  recentOrders: RecentOrder[]
  stockRisks: StockRisk[]
  recentCustomers: RecentCustomer[]
  recentActions: RecentAdminAction[]
  /** True when at least one query failed, so the page can say so honestly. */
  degraded: boolean
}

export async function loadDashboard(
  supabase: SupabaseClient,
  range: { from: Date; to: Date },
): Promise<DashboardData> {
  const fromIso = range.from.toISOString()
  const toIso = range.to.toISOString()
  let degraded = false

  const [
    metricsRes,
    seriesRes,
    topRes,
    ordersRes,
    stockRes,
    customersRes,
    actionsRes,
  ] = await Promise.all([
    supabase.rpc("admin_dashboard_metrics", { p_from: fromIso, p_to: toIso }),
    supabase.rpc("admin_timeseries", { p_from: fromIso, p_to: toIso }),
    supabase.rpc("admin_top_products", { p_from: fromIso, p_to: toIso, p_limit: 5 }),
    supabase
      .from("orders")
      .select("id, order_number, full_name, email, total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("product_variants")
      .select("id, label, sku, stock_quantity, products!inner(id, name, slug, is_active, low_stock_threshold)")
      .eq("products.is_active", true)
      .order("stock_quantity", { ascending: true })
      .limit(30),
    supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("admin_audit_logs")
      .select("id, action, entity_type, entity_id, admin_role, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(6),
  ])

  for (const [label, res] of [
    ["metrics", metricsRes],
    ["series", seriesRes],
    ["topProducts", topRes],
    ["recentOrders", ordersRes],
    ["stockRisk", stockRes],
    ["recentCustomers", customersRes],
    ["recentActions", actionsRes],
  ] as const) {
    if (res.error) {
      degraded = true
      logQueryError(`dashboard:${label}`, res.error)
    }
  }

  const rawMetrics = (metricsRes.data ?? {}) as Record<string, unknown>
  const metrics: DashboardMetrics = {
    revenueTotal: toNumber(rawMetrics.revenue_total as number),
    revenuePeriod: toNumber(rawMetrics.revenue_period as number),
    ordersTotal: toNumber(rawMetrics.orders_total as number),
    ordersPeriod: toNumber(rawMetrics.orders_period as number),
    ordersPreparing: toNumber(rawMetrics.orders_preparing as number),
    ordersShipped: toNumber(rawMetrics.orders_shipped as number),
    ordersDelivered: toNumber(rawMetrics.orders_delivered as number),
    ordersCancelled: toNumber(rawMetrics.orders_cancelled as number),
    averageOrderValue: toNumber(rawMetrics.average_order_value as number),
    customersTotal: toNumber(rawMetrics.customers_total as number),
    customersPeriod: toNumber(rawMetrics.customers_period as number),
    productsActive: toNumber(rawMetrics.products_active as number),
    productsArchived: toNumber(rawMetrics.products_archived as number),
    productsOutOfStock: toNumber(rawMetrics.products_out_of_stock as number),
    productsLowStock: toNumber(rawMetrics.products_low_stock as number),
  }

  const series: SeriesPoint[] = (
    (seriesRes.data ?? []) as {
      bucket_date: string
      revenue: number | string
      order_count: number
      new_customers: number
    }[]
  ).map((row) => ({
    date: row.bucket_date,
    revenue: toNumber(row.revenue),
    orders: toNumber(row.order_count),
    customers: toNumber(row.new_customers),
  }))

  const topProducts: TopProduct[] = (
    (topRes.data ?? []) as {
      product_id: string
      name: string
      slug: string
      units_sold: number
      revenue: number | string
    }[]
  ).map((row) => ({
    productId: row.product_id,
    name: row.name,
    slug: row.slug,
    unitsSold: toNumber(row.units_sold),
    revenue: toNumber(row.revenue),
  }))

  const recentOrders: RecentOrder[] = (
    (ordersRes.data ?? []) as {
      id: string
      order_number: string
      full_name: string
      email: string
      total: number | string
      status: OrderStatusValue
      created_at: string
    }[]
  ).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    fullName: row.full_name,
    email: row.email,
    total: toNumber(row.total),
    status: row.status,
    createdAt: row.created_at,
  }))

  // The variant query is ordered by stock ascending and capped, then filtered
  // to genuine risks here — a variant is "at risk" relative to its product's
  // own threshold, which SQL cannot express in a simple ORDER BY.
  type VariantRow = {
    id: string
    label: string
    sku: string | null
    stock_quantity: number
    products: {
      id: string
      name: string
      slug: string
      low_stock_threshold: number
    } | null
  }
  const stockRisks: StockRisk[] = ((stockRes.data ?? []) as unknown as VariantRow[])
    .filter((row) => row.products && row.stock_quantity <= row.products.low_stock_threshold)
    .slice(0, 8)
    .map((row) => ({
      productId: row.products!.id,
      productName: row.products!.name,
      productSlug: row.products!.slug,
      variantId: row.id,
      variantLabel: row.label,
      sku: row.sku,
      stock: row.stock_quantity,
      threshold: row.products!.low_stock_threshold,
    }))

  const recentCustomers: RecentCustomer[] = (
    (customersRes.data ?? []) as { id: string; full_name: string; created_at: string }[]
  ).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    createdAt: row.created_at,
  }))

  const recentActions: RecentAdminAction[] = (
    (actionsRes.data ?? []) as {
      id: string
      action: string
      entity_type: string
      entity_id: string | null
      admin_role: string
      created_at: string
      metadata: Record<string, unknown> | null
    }[]
  ).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    adminRole: row.admin_role,
    createdAt: row.created_at,
    metadata: row.metadata,
  }))

  return {
    metrics,
    series,
    topProducts,
    recentOrders,
    stockRisks,
    recentCustomers,
    recentActions,
    degraded,
  }
}
