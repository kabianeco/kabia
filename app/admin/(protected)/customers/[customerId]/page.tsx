import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { adminPageContext } from "@/lib/admin/auth"
import {
  loadAuthSummary,
  loadCustomerAddresses,
  loadCustomerOrders,
} from "@/lib/admin/queries/customers"
import { formatCurrency, formatDate, formatDateTime, formatInteger, toNumber } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { Metric, MetricGrid } from "@/components/admin/ui/metric"
import { OrderStatusTag, type OrderStatusValue } from "@/components/admin/ui/status"
import { Table, TableScroll, Td, Th, Tr } from "@/components/admin/ui/table"

export const metadata: Metadata = { title: "Müşteri" }
export const dynamic = "force-dynamic"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { supabase } = await adminPageContext("viewCustomers")
  const { customerId } = await params

  const { data, error } = await supabase
    .from("admin_customer_overview")
    .select("id, full_name, phone, created_at, order_count, cancelled_count, total_spent, last_order_at")
    .eq("id", customerId)
    .maybeSingle()

  if (error) logQueryError("customers:detail", error)
  if (!data) notFound()

  const customer = data as {
    id: string
    full_name: string
    phone: string | null
    created_at: string
    order_count: number
    cancelled_count: number
    total_spent: number | string
    last_order_at: string | null
  }

  const [orders, addresses, auth] = await Promise.all([
    loadCustomerOrders(supabase, customerId),
    loadCustomerAddresses(supabase, customerId),
    loadAuthSummary(customerId),
  ])

  const isBanned = auth?.bannedUntil ? new Date(auth.bannedUntil) > new Date() : false

  return (
    <>
      <PageHeader
        title={customer.full_name}
        description={`Kayıt tarihi: ${formatDate(customer.created_at)}`}
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Müşteriler", href: "/admin/customers" },
          { label: customer.full_name },
        ]}
      />

      <div className="space-y-6">
        <MetricGrid>
          <Metric label="Sipariş" value={formatInteger(customer.order_count)} hint="İptal edilenler hariç" />
          <Metric
            label="Toplam harcama"
            value={formatCurrency(toNumber(customer.total_spent))}
            tone="brand"
          />
          <Metric label="İptal edilen" value={formatInteger(customer.cancelled_count)} />
          <Metric
            label="Son sipariş"
            value={customer.last_order_at ? formatDate(customer.last_order_at) : "—"}
          />
        </MetricGrid>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel title="Sipariş geçmişi" bodyClassName="px-0 py-0 md:px-0">
              <div className="px-4 py-4 md:px-5">
                {orders.length === 0 ? (
                  <EmptyState title="Henüz sipariş yok" compact />
                ) : (
                  <TableScroll>
                    <Table caption="Müşterinin siparişleri" className="min-w-[32rem]">
                      <thead>
                        <tr>
                          <Th>Sipariş no</Th>
                          <Th>Tarih</Th>
                          <Th>Durum</Th>
                          <Th align="right">Tutar</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <Tr key={order.id}>
                            <Td>
                              <Link
                                href={`/admin/orders/${order.id}`}
                                prefetch={false}
                                className="figure text-ink transition-colors duration-200 hover:text-brand"
                              >
                                {order.order_number}
                              </Link>
                            </Td>
                            <Td>{formatDateTime(order.created_at)}</Td>
                            <Td>
                              <OrderStatusTag status={order.status as OrderStatusValue} />
                            </Td>
                            <Td align="right" numeric>
                              {formatCurrency(toNumber(order.total))}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableScroll>
                )}
              </div>
            </Panel>

            <Panel title="Kayıtlı adresler">
              {addresses.length === 0 ? (
                <EmptyState title="Kayıtlı adres yok" compact />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {addresses.map((address) => (
                    <li
                      key={address.id}
                      className="rounded-[3px] border border-ink/10 bg-ivory/60 p-4"
                    >
                      <p className="label text-olive">
                        {address.label}
                        {address.is_default && " · Varsayılan"}
                      </p>
                      <address className="mt-2 space-y-0.5 text-sm not-italic leading-relaxed text-ink/80">
                        <p className="text-ink">{address.full_name}</p>
                        <p>{address.address_line1}</p>
                        {address.address_line2 && <p>{address.address_line2}</p>}
                        <p>
                          {address.district} / {address.city}
                        </p>
                        <p>{address.postal_code}</p>
                        <p className="pt-1 text-ink/60">{address.phone}</p>
                      </address>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Hesap">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="label text-olive">Ad soyad</dt>
                  <dd className="mt-0.5 text-ink">{customer.full_name}</dd>
                </div>
                <div>
                  <dt className="label text-olive">E-posta</dt>
                  <dd className="mt-0.5 break-all text-ink">
                    {auth?.email ?? (
                      <span className="text-ink/45">
                        Servis anahtarı yapılandırılmadığı için okunamıyor
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="label text-olive">Telefon</dt>
                  <dd className="mt-0.5 text-ink">{customer.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="label text-olive">Kayıt</dt>
                  <dd className="mt-0.5 text-ink">{formatDate(customer.created_at)}</dd>
                </div>
                <div>
                  <dt className="label text-olive">Son giriş</dt>
                  <dd className="mt-0.5 text-ink">
                    {auth?.lastSignInAt ? formatDateTime(auth.lastSignInAt) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="label text-olive">Hesap durumu</dt>
                  <dd className="mt-0.5 text-ink">
                    {!auth
                      ? "—"
                      : isBanned
                        ? "Askıya alınmış"
                        : auth.emailConfirmedAt
                          ? "Aktif · e-posta doğrulanmış"
                          : "Aktif · e-posta doğrulanmamış"}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-relaxed text-ink/45">
                Kimlik doğrulama verileri yalnızca sunucuda okunur. Parola bilgisi, oturum
                anahtarları ve sağlayıcı gizli bilgileri hiçbir zaman bu ekrana taşınmaz.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </>
  )
}
