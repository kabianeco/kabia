import type { Metadata } from "next"
import Link from "next/link"
import dynamicImport from "next/dynamic"
import { requireAdmin, adminClient } from "@/lib/admin/auth"
import { loadDashboard } from "@/lib/admin/queries/dashboard"
import {
  formatCurrency,
  formatDate,
  formatInteger,
  formatRelative,
  storeDayRange,
} from "@/lib/admin/format"
import { describeAuditAction, describeAuditEntity } from "@/lib/admin/audit"
import { EmptyState, InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { Metric, MetricGrid } from "@/components/admin/ui/metric"
import { OrderStatusTag, StockTag, stockLevel } from "@/components/admin/ui/status"
import { BarList, DistributionList } from "@/components/admin/charts/bar-list"

export const metadata: Metadata = { title: "Genel Bakış" }
export const dynamic = "force-dynamic"

// Charts are the only heavy client bundle in the dashboard, so they load on
// demand rather than in the server-rendered shell. The placeholder reserves the
// exact plot height, so nothing below it shifts when the chart arrives.
const RevenueChart = dynamicImport(
  () => import("@/components/admin/charts/time-series").then((m) => m.RevenueChart),
  {
    loading: () => (
      <div
        role="status"
        aria-label="Grafik yükleniyor"
        className="animate-pulse rounded-[3px] bg-ink/[0.05]"
        style={{ height: 260 }}
      />
    ),
  },
)

const MiniTrend = dynamicImport(
  () => import("@/components/admin/charts/time-series").then((m) => m.MiniTrend),
  {
    loading: () => (
      <div
        role="status"
        aria-label="Grafik yükleniyor"
        className="animate-pulse rounded-[3px] bg-ink/[0.05]"
        style={{ height: 120 }}
      />
    ),
  },
)

const RANGES = [
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
  { days: 90, label: "90 gün" },
  { days: 365, label: "1 yıl" },
] as const

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string }>
}) {
  await requireAdmin()
  const supabase = await adminClient()

  const { gun } = await searchParams
  const requested = Number(gun)
  const days = RANGES.some((r) => r.days === requested) ? requested : 30
  const range = storeDayRange(days)

  const data = await loadDashboard(supabase, range)
  const { metrics } = data

  const hasAnyOrders = metrics.ordersTotal > 0

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        description={`Son ${days} günün özeti. Gelir rakamları iptal edilen siparişleri içermez.`}
        actions={
          <nav aria-label="Tarih aralığı" className="flex flex-wrap gap-1">
            {RANGES.map((option) => {
              const active = option.days === days
              return (
                <Link
                  key={option.days}
                  href={`/admin?gun=${option.days}`}
                  prefetch={false}
                  aria-current={active ? "true" : undefined}
                  className={
                    active
                      ? "inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm text-on-brand"
                      : "inline-flex min-h-11 items-center rounded-full border border-ink/15 px-4 text-sm text-ink/70 transition-colors duration-300 hover:border-brand hover:text-brand"
                  }
                >
                  {option.label}
                </Link>
              )
            })}
          </nav>
        }
      />

      {data.degraded && (
        <div className="mb-6">
          <InlineAlert tone="danger">
            Bazı veriler yüklenemedi. Aşağıdaki rakamlar eksik olabilir; sayfayı
            yenilemeyi deneyin.
          </InlineAlert>
        </div>
      )}

      <div className="space-y-6">
        <MetricGrid>
          <Metric
            label="Dönem geliri"
            value={formatCurrency(metrics.revenuePeriod)}
            hint={`Toplam gelir: ${formatCurrency(metrics.revenueTotal)}`}
            tone="brand"
          />
          <Metric
            label="Dönem siparişi"
            value={formatInteger(metrics.ordersPeriod)}
            hint={`Toplam ${formatInteger(metrics.ordersTotal)} sipariş`}
            href="/admin/orders"
          />
          <Metric
            label="Ortalama sepet"
            value={formatCurrency(metrics.averageOrderValue)}
            hint="İptal edilenler hariç"
          />
          <Metric
            label="Yeni müşteri"
            value={formatInteger(metrics.customersPeriod)}
            hint={`Toplam ${formatInteger(metrics.customersTotal)} müşteri`}
            href="/admin/customers"
          />
        </MetricGrid>

        <MetricGrid>
          <Metric
            label="Hazırlanıyor"
            value={formatInteger(metrics.ordersPreparing)}
            hint="İşlem bekleyen siparişler"
            href="/admin/orders?durum=hazirlaniyor"
          />
          <Metric
            label="Yayındaki ürün"
            value={formatInteger(metrics.productsActive)}
            hint={`${formatInteger(metrics.productsArchived)} ürün arşivde`}
            href="/admin/products"
          />
          <Metric
            label="Kritik stok"
            value={formatInteger(metrics.productsLowStock)}
            tone={metrics.productsLowStock > 0 ? "warning" : "default"}
            hint="Eşiğin altına inen ürünler"
            href="/admin/inventory?durum=kritik"
          />
          <Metric
            label="Tükenen ürün"
            value={formatInteger(metrics.productsOutOfStock)}
            tone={metrics.productsOutOfStock > 0 ? "danger" : "default"}
            hint="Stoğu sıfırlanan ürünler"
            href="/admin/inventory?durum=tukendi"
          />
        </MetricGrid>

        {!hasAnyOrders && (
          <InlineAlert tone="info">
            Henüz satış verisi yok. Grafikler ve satış panelleri, ilk sipariş
            oluştuğunda gerçek verilerle dolacak.
          </InlineAlert>
        )}

        <Panel
          title="Gelir"
          description={`Günlük gelir — son ${days} gün, Europe/Istanbul saatiyle`}
        >
          <RevenueChart data={data.series} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Siparişler" description="Günlük sipariş adedi">
            <MiniTrend
              data={data.series}
              field="orders"
              title="Sipariş adedi"
              emptyMessage="Seçilen aralıkta sipariş yok."
            />
          </Panel>
          <Panel title="Yeni müşteriler" description="Günlük kayıt adedi">
            <MiniTrend
              data={data.series}
              field="customers"
              title="Yeni müşteri"
              emptyMessage="Seçilen aralıkta yeni kayıt yok."
            />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Sipariş durumu dağılımı" description="Tüm zamanlar">
            <DistributionList
              caption="Siparişlerin duruma göre dağılımı"
              total={metrics.ordersTotal}
              items={[
                {
                  id: "hazirlaniyor",
                  label: "Hazırlanıyor",
                  value: metrics.ordersPreparing,
                  href: "/admin/orders?durum=hazirlaniyor",
                },
                {
                  id: "kargoda",
                  label: "Kargoda",
                  value: metrics.ordersShipped,
                  href: "/admin/orders?durum=kargoda",
                },
                {
                  id: "teslim_edildi",
                  label: "Teslim edildi",
                  value: metrics.ordersDelivered,
                  href: "/admin/orders?durum=teslim_edildi",
                },
                {
                  id: "iptal_edildi",
                  label: "İptal edildi",
                  value: metrics.ordersCancelled,
                  href: "/admin/orders?durum=iptal_edildi",
                },
              ]}
            />
          </Panel>

          <Panel title="Çok satanlar" description={`Son ${days} gün — satılan adet`}>
            <BarList
              caption="En çok satan ürünler"
              valueLabel="Satılan adet"
              emptyMessage="Seçilen aralıkta satış yok."
              formatValue={formatInteger}
              items={data.topProducts.map((product) => ({
                id: product.productId,
                label: product.name,
                value: product.unitsSold,
                secondary: formatCurrency(product.revenue),
                href: `/admin/products/${product.productId}`,
              }))}
            />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Son siparişler"
            actions={
              <Link
                href="/admin/orders"
                prefetch={false}
                className="text-xs text-brand transition-colors duration-300 hover:text-forest"
              >
                Tümü →
              </Link>
            }
            bodyClassName="px-0 py-0 md:px-0"
          >
            {data.recentOrders.length === 0 ? (
              <div className="px-4 py-6 md:px-5">
                <EmptyState title="0 sipariş" description="Henüz satış verisi yok." compact />
              </div>
            ) : (
              <ul className="divide-y divide-ink/[0.07]">
                {data.recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      prefetch={false}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.02] md:px-5"
                    >
                      <span className="min-w-0">
                        <span className="figure block text-sm text-ink">
                          {order.orderNumber}
                        </span>
                        <span className="block truncate text-xs text-ink/50">
                          {order.fullName} · {formatRelative(order.createdAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="figure text-sm text-ink">
                          {formatCurrency(order.total)}
                        </span>
                        <OrderStatusTag status={order.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Dikkat gerektiren stoklar"
            actions={
              <Link
                href="/admin/inventory"
                prefetch={false}
                className="text-xs text-brand transition-colors duration-300 hover:text-forest"
              >
                Stok yönetimi →
              </Link>
            }
            bodyClassName="px-0 py-0 md:px-0"
          >
            {data.stockRisks.length === 0 ? (
              <div className="px-4 py-6 md:px-5">
                <EmptyState
                  title="Stok uyarısı yok"
                  description="Yayındaki tüm ürünlerin stoğu eşiğin üzerinde."
                  compact
                />
              </div>
            ) : (
              <ul className="divide-y divide-ink/[0.07]">
                {data.stockRisks.map((risk) => (
                  <li
                    key={risk.variantId}
                    className="flex items-center justify-between gap-3 px-4 py-3 md:px-5"
                  >
                    <span className="min-w-0">
                      <Link
                        href={`/admin/products/${risk.productId}`}
                        prefetch={false}
                        className="block truncate text-sm text-ink transition-colors duration-200 hover:text-brand"
                      >
                        {risk.productName}
                      </Link>
                      <span className="block truncate text-xs text-ink/50">
                        {risk.variantLabel}
                        {risk.sku ? ` · ${risk.sku}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="figure text-sm text-ink">{risk.stock}</span>
                      <StockTag level={stockLevel(risk.stock, risk.threshold)} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Son kayıt olan müşteriler" bodyClassName="px-0 py-0 md:px-0">
            {data.recentCustomers.length === 0 ? (
              <div className="px-4 py-6 md:px-5">
                <EmptyState title="Henüz müşteri yok" compact />
              </div>
            ) : (
              <ul className="divide-y divide-ink/[0.07]">
                {data.recentCustomers.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      prefetch={false}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.02] md:px-5"
                    >
                      <span className="truncate text-sm text-ink">{customer.fullName}</span>
                      <span className="shrink-0 text-xs text-ink/50">
                        {formatDate(customer.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Son yönetici işlemleri"
            actions={
              <Link
                href="/admin/audit-logs"
                prefetch={false}
                className="text-xs text-brand transition-colors duration-300 hover:text-forest"
              >
                Denetim kayıtları →
              </Link>
            }
            bodyClassName="px-0 py-0 md:px-0"
          >
            {data.recentActions.length === 0 ? (
              <div className="px-4 py-6 md:px-5">
                <EmptyState
                  title="Henüz işlem yok"
                  description="Yönetici işlemleri burada listelenir."
                  compact
                />
              </div>
            ) : (
              <ul className="divide-y divide-ink/[0.07]">
                {data.recentActions.map((entry) => (
                  <li key={entry.id} className="px-4 py-3 md:px-5">
                    <p className="text-sm text-ink">{describeAuditAction(entry.action)}</p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {describeAuditEntity(entry.entityType)} · {formatRelative(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
