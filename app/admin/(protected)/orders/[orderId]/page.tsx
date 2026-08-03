import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { adminPageContext } from "@/lib/admin/auth"
import { formatCurrency, formatDateTime, toNumber } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { OrderStatusTag, ORDER_STATUS_LABELS, type OrderStatusValue } from "@/components/admin/ui/status"
import { Table, TableScroll, Td, Th, Tr } from "@/components/admin/ui/table"
import { OrderNoteForm, OrderStatusControls, TrackingForm } from "./order-controls"

export const metadata: Metadata = { title: "Sipariş Detayı" }
export const dynamic = "force-dynamic"

interface ShippingAddress {
  label?: string
  recipientName?: string
  phone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  district?: string
  postalCode?: string
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { session, supabase } = await adminPageContext("manageOrders")
  const { orderId } = await params

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, subtotal, shipping_cost, total, full_name, email,
       shipping_address, payment_method_snapshot, created_at, user_id,
       tracking_carrier, tracking_number,
       order_items(id, product_id, product_name_snapshot, variant_label_snapshot,
                   product_slug_snapshot, product_image_snapshot, unit_price_snapshot,
                   quantity, line_total)`,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) logQueryError("orders:detail", error)
  if (!data) notFound()

  const [historyRes, notesRes] = await Promise.all([
    supabase
      .from("order_status_history")
      .select("id, status, changed_at")
      .eq("order_id", orderId)
      .order("changed_at", { ascending: true }),
    supabase
      .from("order_notes")
      .select("id, note, created_at, admin_user_id")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ])

  if (historyRes.error) logQueryError("orders:history", historyRes.error)
  if (notesRes.error) logQueryError("orders:notes", notesRes.error)

  type OrderRecord = {
    id: string
    order_number: string
    status: OrderStatusValue
    subtotal: number | string
    shipping_cost: number | string
    total: number | string
    full_name: string
    email: string
    shipping_address: ShippingAddress | null
    payment_method_snapshot: { method?: string; label?: string; brand?: string; last4?: string } | null
    created_at: string
    user_id: string
    tracking_carrier: string | null
    tracking_number: string | null
    order_items: {
      id: string
      product_id: string | null
      product_name_snapshot: string
      variant_label_snapshot: string
      product_slug_snapshot: string
      product_image_snapshot: string
      unit_price_snapshot: number | string
      quantity: number
      line_total: number | string
    }[]
  }

  const order = data as unknown as OrderRecord
  const address = order.shipping_address ?? {}
  const history = (historyRes.data ?? []) as { id: string; status: OrderStatusValue; changed_at: string }[]
  const notes = (notesRes.data ?? []) as { id: string; note: string; created_at: string }[]

  return (
    <>
      <PageHeader
        title={order.order_number}
        description={`${formatDateTime(order.created_at)} · ${order.full_name}`}
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Siparişler", href: "/admin/orders" },
          { label: order.order_number },
        ]}
        actions={<OrderStatusTag status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Sipariş kalemleri" bodyClassName="px-0 py-0 md:px-0">
            <div className="px-4 py-4 md:px-5">
              <TableScroll>
                <Table caption="Sipariş kalemleri" className="min-w-[36rem]">
                  <thead>
                    <tr>
                      <Th width="3rem">
                        <span className="sr-only">Görsel</span>
                      </Th>
                      <Th>Ürün</Th>
                      <Th align="right">Birim fiyat</Th>
                      <Th align="right">Adet</Th>
                      <Th align="right">Tutar</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map((item) => (
                      <Tr key={item.id}>
                        <Td>
                          <span className="relative block h-9 w-9 overflow-hidden rounded-media bg-ink/[0.06]">
                            {item.product_image_snapshot && (
                              <Image
                                src={item.product_image_snapshot}
                                alt=""
                                fill
                                sizes="36px"
                                className="object-cover"
                                unoptimized
                              />
                            )}
                          </span>
                        </Td>
                        <Td>
                          {item.product_id ? (
                            <Link
                              href={`/admin/products/${item.product_id}`}
                              prefetch={false}
                              className="text-ink transition-colors duration-200 hover:text-brand"
                            >
                              {item.product_name_snapshot}
                            </Link>
                          ) : (
                            <span className="text-ink">{item.product_name_snapshot}</span>
                          )}
                          <span className="mt-0.5 block text-xs text-ink/45">
                            {item.variant_label_snapshot}
                            {!item.product_id && " · ürün kataloğdan kaldırılmış"}
                          </span>
                        </Td>
                        <Td align="right" numeric>
                          {formatCurrency(toNumber(item.unit_price_snapshot))}
                        </Td>
                        <Td align="right" numeric>
                          {item.quantity}
                        </Td>
                        <Td align="right" numeric>
                          {formatCurrency(toNumber(item.line_total))}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            </div>

            <dl className="space-y-2 border-t border-ink/10 px-4 py-4 text-sm md:px-5">
              <div className="flex justify-between">
                <dt className="text-ink/60">Ara toplam</dt>
                <dd className="figure text-ink">{formatCurrency(toNumber(order.subtotal))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/60">Kargo</dt>
                <dd className="figure text-ink">
                  {toNumber(order.shipping_cost) === 0
                    ? "Ücretsiz"
                    : formatCurrency(toNumber(order.shipping_cost))}
                </dd>
              </div>
              <div className="flex justify-between border-t border-ink/10 pt-2">
                <dt className="font-medium text-ink">Toplam</dt>
                <dd className="figure text-lg text-ink">{formatCurrency(toNumber(order.total))}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Durum yönetimi">
            <OrderStatusControls
              orderId={order.id}
              orderNumber={order.order_number}
              status={order.status}
              isSuperAdmin={session.role === "super_admin"}
            />
          </Panel>

          <Panel
            title="Kargo bilgisi"
            description="Girilen bilgi sipariş kaydına yazılır ve denetim kaydına düşer."
          >
            <TrackingForm
              orderId={order.id}
              carrier={order.tracking_carrier}
              number={order.tracking_number}
            />
          </Panel>

          <Panel title="İç notlar" description="Yalnızca yöneticilere görünür.">
            <OrderNoteForm orderId={order.id} />
            {notes.length > 0 && (
              <ul className="mt-6 space-y-3 border-t border-ink/10 pt-4">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-[3px] border border-ink/10 bg-ivory/60 p-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                      {note.note}
                    </p>
                    <p className="mt-2 text-xs text-ink/45">{formatDateTime(note.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Müşteri">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="label text-olive">Ad soyad</dt>
                <dd className="mt-0.5 text-ink">{order.full_name}</dd>
              </div>
              <div>
                <dt className="label text-olive">E-posta</dt>
                <dd className="mt-0.5 break-all text-ink">{order.email}</dd>
              </div>
              {address.phone && (
                <div>
                  <dt className="label text-olive">Telefon</dt>
                  <dd className="mt-0.5 text-ink">{address.phone}</dd>
                </div>
              )}
              <div className="pt-1">
                <Link
                  href={`/admin/customers/${order.user_id}`}
                  prefetch={false}
                  className="text-sm text-brand transition-colors duration-300 hover:text-forest"
                >
                  Müşteri kaydını aç →
                </Link>
              </div>
            </dl>
          </Panel>

          <Panel title="Teslimat adresi">
            {address.addressLine1 ? (
              <address className="space-y-0.5 text-sm not-italic leading-relaxed text-ink/80">
                {address.recipientName && <p className="text-ink">{address.recipientName}</p>}
                <p>{address.addressLine1}</p>
                {address.addressLine2 && <p>{address.addressLine2}</p>}
                <p>
                  {address.district}
                  {address.district && address.city ? " / " : ""}
                  {address.city}
                </p>
                {address.postalCode && <p>{address.postalCode}</p>}
              </address>
            ) : (
              <p className="text-sm text-ink/45">Adres bilgisi kayıtlı değil.</p>
            )}
          </Panel>

          <Panel title="Ödeme">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="label text-olive">Yöntem</dt>
                <dd className="mt-0.5 text-ink">
                  {order.payment_method_snapshot?.method === "cod"
                    ? "Kapıda ödeme"
                    : order.payment_method_snapshot?.label || "Kart"}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <InlineAlert tone="info">
                Bu projede ödeme sağlayıcısı entegrasyonu yok. Kayıtlı bilgi yalnızca
                maskelenmiş bir özettir ve panelden iade işlemi başlatılamaz.
              </InlineAlert>
            </div>
          </Panel>

          <Panel title="Sipariş geçmişi">
            {history.length === 0 ? (
              <p className="text-sm text-ink/45">Durum kaydı yok.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-ink/10 pl-4">
                    <p className="text-sm text-ink">{ORDER_STATUS_LABELS[entry.status]}</p>
                    <p className="mt-0.5 text-xs text-ink/45">
                      {formatDateTime(entry.changed_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
