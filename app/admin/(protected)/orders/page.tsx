import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { sanitizeSearch } from "@/lib/admin/queries/products"
import { formatCurrency, formatDateTime, toNumber } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { hrefBuilder, pickEnum, pickPage, pickString } from "@/lib/admin/url"
import { EmptyState, ErrorState, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import {
  Pagination,
  RecordCard,
  RecordField,
  RecordList,
  SortableTh,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui/table"
import { OrderStatusTag, type OrderStatusValue } from "@/components/admin/ui/status"
import {
  ClearFilters,
  DateRangeFilter,
  FilterBar,
  FilterSelect,
  SearchField,
} from "@/components/admin/ui/filters"

export const metadata: Metadata = { title: "Siparişler" }
export const dynamic = "force-dynamic"

const PER_PAGE = 25
const SORTS = { created_at: "created_at", total: "total", order_number: "order_number" } as const
type SortKey = keyof typeof SORTS

interface OrderRow {
  id: string
  order_number: string
  full_name: string
  email: string
  total: number | string
  status: OrderStatusValue
  created_at: string
  tracking_number: string | null
  payment_method_snapshot: { method?: string; label?: string } | null
}

/** A date-only input is a store-local calendar day, not a UTC instant. */
function dayBoundary(value: string | undefined, endOfDay = false): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const base = new Date(`${value}T00:00:00+03:00`)
  if (Number.isNaN(base.getTime())) return null
  if (endOfDay) base.setTime(base.getTime() + 24 * 3_600_000)
  return base.toISOString()
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageOrders")
  const params = await searchParams

  const page = pickPage(params)
  const sort = pickEnum<SortKey>(params, "sirala", Object.keys(SORTS) as SortKey[], "created_at")
  const dir = pickEnum(params, "yon", ["asc", "desc"] as const, "desc")
  const status = pickEnum(
    params,
    "durum",
    ["hazirlaniyor", "kargoda", "teslim_edildi", "iptal_edildi"] as const,
  )
  const payment = pickEnum(params, "odeme", ["cod", "card"] as const)
  const q = pickString(params, "q", 60)
  const from = pickString(params, "from", 10)
  const to = pickString(params, "to", 10)

  const offset = (page - 1) * PER_PAGE

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, full_name, email, total, status, created_at, tracking_number, payment_method_snapshot",
      { count: "exact" },
    )

  const term = sanitizeSearch(q)
  if (term.length >= 2) {
    query = query.or(
      `order_number.ilike.%${term}%,full_name.ilike.%${term}%,email.ilike.%${term}%`,
    )
  }
  if (status) query = query.eq("status", status)
  if (payment) query = query.eq("payment_method_snapshot->>method", payment)

  const fromIso = dayBoundary(from)
  const toIso = dayBoundary(to, true)
  if (fromIso) query = query.gte("created_at", fromIso)
  if (toIso) query = query.lt("created_at", toIso)

  const { data, error, count } = await query
    .order(SORTS[sort], { ascending: dir === "asc" })
    .order("id", { ascending: true })
    .range(offset, offset + PER_PAGE - 1)

  if (error) logQueryError("orders:list", error)

  const rows = (data ?? []) as OrderRow[]
  const href = hrefBuilder("/admin/orders", params)
  const hasFilters = Boolean(q || status || payment || from || to)

  return (
    <>
      <PageHeader
        title="Siparişler"
        description="Sipariş durumu, kargo bilgisi ve iç notlar. Her durum değişikliği denetim kaydına yazılır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Siparişler" }]}
      />

      <FilterBar>
        <SearchField
          label="Ara"
          placeholder="Sipariş no, ad soyad veya e-posta"
          hint="En az 2 karakter"
        />
        <FilterSelect
          label="Durum"
          paramName="durum"
          options={[
            { value: "hazirlaniyor", label: "Hazırlanıyor" },
            { value: "kargoda", label: "Kargoda" },
            { value: "teslim_edildi", label: "Teslim edildi" },
            { value: "iptal_edildi", label: "İptal edildi" },
          ]}
        />
        <FilterSelect
          label="Ödeme"
          paramName="odeme"
          options={[
            { value: "card", label: "Kart" },
            { value: "cod", label: "Kapıda ödeme" },
          ]}
        />
        <DateRangeFilter />
        <ClearFilters params={["q", "durum", "odeme", "from", "to"]} />
      </FilterBar>

      <Panel bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          {error ? (
            <ErrorState description="Sipariş listesi alınamadı. Sayfayı yenilemeyi deneyin." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "Sonuç bulunamadı" : "0 sipariş"}
              description={
                hasFilters
                  ? "Arama, tarih aralığı veya filtreleri değiştirerek tekrar deneyin."
                  : "Henüz satış verisi yok. İlk sipariş geldiğinde burada listelenecek."
              }
            />
          ) : (
            <>
              <TableScroll className="hidden md:block">
                <Table caption="Sipariş listesi">
                  <thead>
                    <tr>
                      <SortableTh
                        field="order_number"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) =>
                          href({ sirala: field, yon: nextDir, sayfa: null })
                        }
                      >
                        Sipariş no
                      </SortableTh>
                      <Th>Müşteri</Th>
                      <SortableTh
                        field="created_at"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) =>
                          href({ sirala: field, yon: nextDir, sayfa: null })
                        }
                      >
                        Tarih
                      </SortableTh>
                      <Th>Ödeme</Th>
                      <Th>Durum</Th>
                      <SortableTh
                        field="total"
                        align="right"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) =>
                          href({ sirala: field, yon: nextDir, sayfa: null })
                        }
                      >
                        Tutar
                      </SortableTh>
                      <Th align="right">
                        <span className="sr-only">İşlem</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((order) => (
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
                        <Td>
                          <span className="block truncate">{order.full_name}</span>
                          <span className="block truncate text-xs text-ink/45">
                            {order.email}
                          </span>
                        </Td>
                        <Td>{formatDateTime(order.created_at)}</Td>
                        <Td>
                          {order.payment_method_snapshot?.method === "cod"
                            ? "Kapıda"
                            : order.payment_method_snapshot?.method === "card"
                              ? "Kart"
                              : "—"}
                        </Td>
                        <Td>
                          <OrderStatusTag status={order.status} />
                        </Td>
                        <Td align="right" numeric>
                          {formatCurrency(toNumber(order.total))}
                        </Td>
                        <Td align="right">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            prefetch={false}
                            className="inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest"
                          >
                            Detay
                          </Link>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>

              <RecordList>
                {rows.map((order) => (
                  <RecordCard
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    title={order.order_number}
                    meta={`${order.full_name} · ${formatDateTime(order.created_at)}`}
                  >
                    <RecordField label="Tutar" numeric>
                      {formatCurrency(toNumber(order.total))}
                    </RecordField>
                    <RecordField label="Ödeme">
                      {order.payment_method_snapshot?.method === "cod" ? "Kapıda" : "Kart"}
                    </RecordField>
                    <div className="col-span-2">
                      <OrderStatusTag status={order.status} />
                    </div>
                  </RecordCard>
                ))}
              </RecordList>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-ink/10 px-4 py-3 md:px-5">
            <Pagination
              page={page}
              perPage={PER_PAGE}
              total={count ?? 0}
              buildHref={(next) => href({ sayfa: next === 1 ? null : next })}
            />
          </div>
        )}
      </Panel>
    </>
  )
}
