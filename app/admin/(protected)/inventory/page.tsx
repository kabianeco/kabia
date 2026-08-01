import type { Metadata } from "next"
import Link from "next/link"
import { adminContext } from "@/lib/admin/auth"
import { sanitizeSearch } from "@/lib/admin/queries/products"
import { formatCurrency, formatDateTime, formatInteger, formatRelative } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { toNumber } from "@/lib/admin/format"
import { hrefBuilder, pickEnum, pickPage, pickString } from "@/lib/admin/url"
import { EmptyState, ErrorState, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import {
  Pagination,
  RecordCard,
  RecordField,
  RecordList,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
} from "@/components/admin/ui/table"
import { StockTag } from "@/components/admin/ui/status"
import { ClearFilters, FilterBar, FilterSelect, SearchField } from "@/components/admin/ui/filters"
import { AdjustStockButton } from "./adjust-stock"

export const metadata: Metadata = { title: "Stok" }
export const dynamic = "force-dynamic"

const PER_PAGE = 25

interface InventoryRow {
  variant_id: string
  variant_label: string
  sku: string | null
  price: number | string
  stock_quantity: number
  product_id: string
  product_name: string
  product_slug: string
  is_active: boolean
  low_stock_threshold: number
  stock_status: "tukendi" | "kritik" | "yeterli"
  last_adjusted_at: string | null
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminContext("manageInventory")
  const params = await searchParams

  const page = pickPage(params)
  const status = pickEnum(params, "durum", ["tukendi", "kritik", "yeterli", "riskli"] as const)
  const publish = pickEnum(params, "yayin", ["aktif", "arsiv"] as const)
  const q = pickString(params, "q", 60)

  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  let query = supabase
    .from("admin_inventory_overview")
    .select(
      "variant_id, variant_label, sku, price, stock_quantity, product_id, product_name, product_slug, is_active, low_stock_threshold, stock_status, last_adjusted_at",
      { count: "exact" },
    )

  const term = sanitizeSearch(q)
  if (term.length >= 2) {
    query = query.or(
      `product_name.ilike.%${term}%,sku.ilike.%${term}%,variant_label.ilike.%${term}%`,
    )
  }
  // "riskli" is the union the top-bar alert links to: anything needing action.
  if (status === "riskli") query = query.in("stock_status", ["tukendi", "kritik"])
  else if (status) query = query.eq("stock_status", status)
  if (publish === "aktif") query = query.eq("is_active", true)
  if (publish === "arsiv") query = query.eq("is_active", false)

  const { data, error, count } = await query
    .order("stock_quantity", { ascending: true })
    .order("product_name", { ascending: true })
    .range(from, to)

  if (error) logQueryError("inventory:list", error)

  const rows = (data ?? []) as InventoryRow[]
  const href = hrefBuilder("/admin/inventory", params)
  const hasFilters = Boolean(q || status || publish)

  return (
    <>
      <PageHeader
        title="Stok"
        description="Stok yalnızca gerekçeli düzeltmeyle değişir ve her hareket denetim kaydına yazılır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Stok" }]}
      />

      <FilterBar>
        <SearchField label="Ara" placeholder="Ürün adı, seçenek veya SKU" hint="En az 2 karakter" />
        <FilterSelect
          label="Stok durumu"
          paramName="durum"
          options={[
            { value: "riskli", label: "Riskli (tükenen + kritik)" },
            { value: "tukendi", label: "Tükendi" },
            { value: "kritik", label: "Kritik" },
            { value: "yeterli", label: "Stokta" },
          ]}
        />
        <FilterSelect
          label="Yayın"
          paramName="yayin"
          options={[
            { value: "aktif", label: "Yayında" },
            { value: "arsiv", label: "Arşivde" },
          ]}
        />
        <ClearFilters params={["q", "durum", "yayin"]} />
      </FilterBar>

      <Panel bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          {error ? (
            <ErrorState description="Stok listesi alınamadı. Sayfayı yenilemeyi deneyin." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "Sonuç bulunamadı" : "Henüz ürün seçeneği yok"}
              description={
                hasFilters
                  ? "Arama veya filtreleri değiştirerek tekrar deneyin."
                  : "Ürün ekledikçe seçenekleri burada listelenir."
              }
            />
          ) : (
            <>
              <TableScroll className="hidden md:block">
                <Table caption="Stok listesi">
                  <thead>
                    <tr>
                      <Th>Ürün</Th>
                      <Th>Seçenek</Th>
                      <Th>SKU</Th>
                      <Th align="right">Fiyat</Th>
                      <Th align="right">Stok</Th>
                      <Th align="right">Eşik</Th>
                      <Th>Durum</Th>
                      <Th align="right">Son hareket</Th>
                      <Th align="right">
                        <span className="sr-only">İşlem</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <Tr key={row.variant_id}>
                        <Td>
                          <Link
                            href={`/admin/products/${row.product_id}`}
                            prefetch={false}
                            className="font-medium text-ink transition-colors duration-200 hover:text-brand"
                          >
                            {row.product_name}
                          </Link>
                          {!row.is_active && (
                            <span className="label ml-2 text-ink/40">Arşivde</span>
                          )}
                        </Td>
                        <Td>{row.variant_label}</Td>
                        <Td>{row.sku ?? "—"}</Td>
                        <Td align="right" numeric>
                          {formatCurrency(toNumber(row.price))}
                        </Td>
                        <Td align="right" numeric>
                          {formatInteger(row.stock_quantity)}
                        </Td>
                        <Td align="right" numeric>
                          {formatInteger(row.low_stock_threshold)}
                        </Td>
                        <Td>
                          <StockTag
                            level={
                              row.stock_status === "tukendi"
                                ? "out"
                                : row.stock_status === "kritik"
                                  ? "low"
                                  : "healthy"
                            }
                          />
                        </Td>
                        <Td align="right">
                          {row.last_adjusted_at ? formatRelative(row.last_adjusted_at) : "—"}
                        </Td>
                        <Td align="right">
                          <AdjustStockButton
                            variantId={row.variant_id}
                            productName={row.product_name}
                            variantLabel={row.variant_label}
                            currentStock={row.stock_quantity}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>

              <RecordList>
                {rows.map((row) => (
                  <RecordCard
                    key={row.variant_id}
                    title={row.product_name}
                    meta={`${row.variant_label}${row.sku ? ` · ${row.sku}` : ""}`}
                    actions={
                      <AdjustStockButton
                        variantId={row.variant_id}
                        productName={row.product_name}
                        variantLabel={row.variant_label}
                        currentStock={row.stock_quantity}
                      />
                    }
                  >
                    <RecordField label="Stok" numeric>
                      {formatInteger(row.stock_quantity)}
                    </RecordField>
                    <RecordField label="Eşik" numeric>
                      {formatInteger(row.low_stock_threshold)}
                    </RecordField>
                    <RecordField label="Fiyat" numeric>
                      {formatCurrency(toNumber(row.price))}
                    </RecordField>
                    <RecordField label="Son hareket">
                      {row.last_adjusted_at ? formatDateTime(row.last_adjusted_at) : "—"}
                    </RecordField>
                    <div className="col-span-2">
                      <StockTag
                        level={
                          row.stock_status === "tukendi"
                            ? "out"
                            : row.stock_status === "kritik"
                              ? "low"
                              : "healthy"
                        }
                      />
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
