import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { sanitizeSearch } from "@/lib/admin/queries/products"
import { formatCurrency, formatDate, formatDateTime, formatInteger, toNumber } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { can } from "@/lib/admin/roles"
import { pickString } from "@/lib/admin/url"
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { OrderStatusTag, type OrderStatusValue } from "@/components/admin/ui/status"

export const metadata: Metadata = { title: "Arama" }
export const dynamic = "force-dynamic"

const LIMIT = 8

/**
 * Cross-entity search for the top bar.
 *
 * Three bounded queries against indexed columns — product name/slug/SKU, order
 * number/name/email, customer name/phone — each capped at 8 rows. It is
 * deliberately not a live-as-you-type endpoint: it runs once on submit, from a
 * real URL, so a search is shareable and never fires a query per keystroke.
 */
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { session, supabase } = await adminPageContext()
  const params = await searchParams
  const raw = pickString(params, "q", 60)
  const term = sanitizeSearch(raw)

  if (term.length < 2) {
    return (
      <>
        <PageHeader
          title="Arama"
          description="Ürün, sipariş ve müşteri kayıtlarında arama yapın."
          breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Arama" }]}
        />
        <EmptyState
          title="Arama terimi girin"
          description="Üst çubuktaki arama kutusunu kullanın. En az 2 karakter gerekir."
        />
      </>
    )
  }

  const canProducts = can(session.role, "manageCatalogue")
  const canOrders = can(session.role, "manageOrders")
  const canCustomers = can(session.role, "viewCustomers")

  const [productsRes, ordersRes, customersRes] = await Promise.all([
    canProducts
      ? supabase
          .from("admin_product_overview")
          .select("id, name, slug, base_price, total_stock, is_active")
          .or(`name.ilike.%${term}%,slug.ilike.%${term}%,skus.ilike.%${term}%`)
          .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),
    canOrders
      ? supabase
          .from("orders")
          .select("id, order_number, full_name, total, status, created_at")
          .or(`order_number.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%`)
          .order("created_at", { ascending: false })
          .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),
    canCustomers
      ? supabase
          .from("admin_customer_overview")
          .select("id, full_name, phone, order_count, total_spent, created_at")
          .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(LIMIT)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (productsRes.error) logQueryError("search:products", productsRes.error)
  if (ordersRes.error) logQueryError("search:orders", ordersRes.error)
  if (customersRes.error) logQueryError("search:customers", customersRes.error)

  const products = (productsRes.data ?? []) as {
    id: string
    name: string
    slug: string
    base_price: number | string
    total_stock: number
    is_active: boolean
  }[]
  const orders = (ordersRes.data ?? []) as {
    id: string
    order_number: string
    full_name: string
    total: number | string
    status: OrderStatusValue
    created_at: string
  }[]
  const customers = (customersRes.data ?? []) as {
    id: string
    full_name: string
    phone: string | null
    order_count: number
    total_spent: number | string
    created_at: string
  }[]

  const totalResults = products.length + orders.length + customers.length

  return (
    <>
      <PageHeader
        title={`“${term}” için sonuçlar`}
        description={`${totalResults} kayıt bulundu. Her bölüm en fazla ${LIMIT} sonuç gösterir.`}
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Arama" }]}
      />

      {totalResults === 0 ? (
        <EmptyState
          title="Sonuç bulunamadı"
          description="Farklı bir terim deneyin: ürün adı, SKU, sipariş numarası, müşteri adı veya e-posta."
        />
      ) : (
        <div className="space-y-6">
          {canProducts && (
            <Panel title="Ürünler" description={`${products.length} sonuç`} bodyClassName="px-0 py-0 md:px-0">
              {products.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink/45 md:px-5">Eşleşen ürün yok.</p>
              ) : (
                <ul className="divide-y divide-ink/[0.07]">
                  {products.map((product) => (
                    <li key={product.id}>
                      <Link
                        href={`/admin/products/${product.id}`}
                        prefetch={false}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.02] md:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{product.name}</span>
                          <span className="block truncate text-xs text-ink/45">
                            /{product.slug}
                            {!product.is_active && " · arşivde"}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="figure block text-sm text-ink">
                            {formatCurrency(toNumber(product.base_price))}
                          </span>
                          <span className="figure block text-xs text-ink/45">
                            {formatInteger(product.total_stock)} adet
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {canOrders && (
            <Panel title="Siparişler" description={`${orders.length} sonuç`} bodyClassName="px-0 py-0 md:px-0">
              {orders.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink/45 md:px-5">Eşleşen sipariş yok.</p>
              ) : (
                <ul className="divide-y divide-ink/[0.07]">
                  {orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        prefetch={false}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.02] md:px-5"
                      >
                        <span className="min-w-0">
                          <span className="figure block text-sm text-ink">
                            {order.order_number}
                          </span>
                          <span className="block truncate text-xs text-ink/45">
                            {order.full_name} · {formatDateTime(order.created_at)}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="figure text-sm text-ink">
                            {formatCurrency(toNumber(order.total))}
                          </span>
                          <OrderStatusTag status={order.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {canCustomers && (
            <Panel title="Müşteriler" description={`${customers.length} sonuç`} bodyClassName="px-0 py-0 md:px-0">
              {customers.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink/45 md:px-5">Eşleşen müşteri yok.</p>
              ) : (
                <ul className="divide-y divide-ink/[0.07]">
                  {customers.map((customer) => (
                    <li key={customer.id}>
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        prefetch={false}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.02] md:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">
                            {customer.full_name}
                          </span>
                          <span className="block truncate text-xs text-ink/45">
                            {customer.phone ?? "—"} · {formatDate(customer.created_at)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="figure block text-sm text-ink">
                            {formatCurrency(toNumber(customer.total_spent))}
                          </span>
                          <span className="figure block text-xs text-ink/45">
                            {formatInteger(customer.order_count)} sipariş
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  )
}
