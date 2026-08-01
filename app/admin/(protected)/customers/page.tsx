import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { sanitizeSearch } from "@/lib/admin/queries/products"
import { loadEmailsFor, type CustomerRow } from "@/lib/admin/queries/customers"
import { formatCurrency, formatDate, formatInteger, toNumber } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { hrefBuilder, pickEnum, pickPage, pickString } from "@/lib/admin/url"
import { EmptyState, ErrorState, InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
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
import { ClearFilters, FilterBar, FilterSelect, SearchField } from "@/components/admin/ui/filters"

export const metadata: Metadata = { title: "Müşteriler" }
export const dynamic = "force-dynamic"

const PER_PAGE = 25
const SORTS = {
  created_at: "created_at",
  total_spent: "total_spent",
  order_count: "order_count",
  last_order_at: "last_order_at",
  full_name: "full_name",
} as const
type SortKey = keyof typeof SORTS

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("viewCustomers")
  const params = await searchParams

  const page = pickPage(params)
  const sort = pickEnum<SortKey>(params, "sirala", Object.keys(SORTS) as SortKey[], "created_at")
  const dir = pickEnum(params, "yon", ["asc", "desc"] as const, "desc")
  const activity = pickEnum(params, "durum", ["siparisli", "siparissiz"] as const)
  const q = pickString(params, "q", 60)

  const offset = (page - 1) * PER_PAGE

  let query = supabase
    .from("admin_customer_overview")
    .select("id, full_name, phone, created_at, order_count, cancelled_count, total_spent, last_order_at", {
      count: "exact",
    })

  const term = sanitizeSearch(q)
  if (term.length >= 2) {
    query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
  }
  if (activity === "siparisli") query = query.gt("order_count", 0)
  if (activity === "siparissiz") query = query.eq("order_count", 0)

  const { data, error, count } = await query
    .order(SORTS[sort], { ascending: dir === "asc", nullsFirst: false })
    .order("id", { ascending: true })
    .range(offset, offset + PER_PAGE - 1)

  if (error) logQueryError("customers:list", error)

  type Raw = {
    id: string
    full_name: string
    phone: string | null
    created_at: string
    order_count: number
    cancelled_count: number
    total_spent: number | string
    last_order_at: string | null
  }

  const rows: CustomerRow[] = ((data ?? []) as Raw[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    createdAt: row.created_at,
    orderCount: row.order_count,
    cancelledCount: row.cancelled_count,
    totalSpent: toNumber(row.total_spent),
    lastOrderAt: row.last_order_at,
  }))

  // Emails live in auth.users, reachable only through the Auth Admin API.
  const emails = await loadEmailsFor(rows.map((row) => row.id))

  const href = hrefBuilder("/admin/customers", params)
  const hasFilters = Boolean(q || activity)

  return (
    <>
      <PageHeader
        title="Müşteriler"
        description="Kayıtlı müşteriler, sipariş sayıları ve toplam harcamaları."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Müşteriler" }]}
      />

      {emails.size === 0 && rows.length > 0 && (
        <div className="mb-6">
          <InlineAlert tone="info">
            E-posta adresleri Supabase Auth üzerinden okunur ve bunun için sunucu tarafı
            servis anahtarı gerekir. Anahtar yapılandırılmadığı için bu sütun boş görünüyor;
            diğer tüm veriler gerçek.
          </InlineAlert>
        </div>
      )}

      <FilterBar>
        <SearchField label="Ara" placeholder="Ad soyad veya telefon" hint="En az 2 karakter" />
        <FilterSelect
          label="Sipariş"
          paramName="durum"
          options={[
            { value: "siparisli", label: "Sipariş vermiş" },
            { value: "siparissiz", label: "Hiç sipariş vermemiş" },
          ]}
        />
        <ClearFilters params={["q", "durum"]} />
      </FilterBar>

      <Panel bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          {error ? (
            <ErrorState description="Müşteri listesi alınamadı." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "Sonuç bulunamadı" : "Henüz müşteri yok"}
              description={
                hasFilters
                  ? "Arama veya filtreleri değiştirerek tekrar deneyin."
                  : "İlk kayıt olduğunda müşteriler burada listelenecek."
              }
            />
          ) : (
            <>
              <TableScroll className="hidden md:block">
                <Table caption="Müşteri listesi">
                  <thead>
                    <tr>
                      <SortableTh
                        field="full_name"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Müşteri
                      </SortableTh>
                      <Th>E-posta</Th>
                      <SortableTh
                        field="created_at"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Kayıt
                      </SortableTh>
                      <SortableTh
                        field="order_count"
                        align="right"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Sipariş
                      </SortableTh>
                      <SortableTh
                        field="total_spent"
                        align="right"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Toplam harcama
                      </SortableTh>
                      <SortableTh
                        field="last_order_at"
                        align="right"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Son sipariş
                      </SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((customer) => (
                      <Tr key={customer.id}>
                        <Td>
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            prefetch={false}
                            className="font-medium text-ink transition-colors duration-200 hover:text-brand"
                          >
                            {customer.fullName}
                          </Link>
                          {customer.phone && (
                            <span className="mt-0.5 block text-xs text-ink/45">
                              {customer.phone}
                            </span>
                          )}
                        </Td>
                        <Td>
                          <span className="break-all text-xs text-ink/70">
                            {emails.get(customer.id) ?? "—"}
                          </span>
                        </Td>
                        <Td>{formatDate(customer.createdAt)}</Td>
                        <Td align="right" numeric>
                          {formatInteger(customer.orderCount)}
                        </Td>
                        <Td align="right" numeric>
                          {formatCurrency(customer.totalSpent)}
                        </Td>
                        <Td align="right">
                          {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>

              <RecordList>
                {rows.map((customer) => (
                  <RecordCard
                    key={customer.id}
                    href={`/admin/customers/${customer.id}`}
                    title={customer.fullName}
                    meta={emails.get(customer.id) ?? customer.phone ?? undefined}
                  >
                    <RecordField label="Sipariş" numeric>
                      {formatInteger(customer.orderCount)}
                    </RecordField>
                    <RecordField label="Harcama" numeric>
                      {formatCurrency(customer.totalSpent)}
                    </RecordField>
                    <RecordField label="Kayıt">{formatDate(customer.createdAt)}</RecordField>
                    <RecordField label="Son sipariş">
                      {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                    </RecordField>
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
