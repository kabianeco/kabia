import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import {
  loadCategories,
  loadProductList,
  PRODUCT_SORTS,
  type ProductSortKey,
} from "@/lib/admin/queries/products"
import { formatCurrency, formatDate, formatInteger } from "@/lib/admin/format"
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
import { PublishTag, StockTag } from "@/components/admin/ui/status"
import { ClearFilters, FilterBar, FilterSelect, SearchField } from "@/components/admin/ui/filters"

export const metadata: Metadata = { title: "Ürünler" }
export const dynamic = "force-dynamic"

const PER_PAGE = 20
const SORT_KEYS = Object.keys(PRODUCT_SORTS) as ProductSortKey[]

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageCatalogue")
  const params = await searchParams

  const page = pickPage(params)
  const sort = pickEnum<ProductSortKey>(params, "sirala", SORT_KEYS, "updated_at")
  const dir = pickEnum(params, "yon", ["asc", "desc"] as const, "desc")
  const status = pickEnum(params, "durum", ["aktif", "arsiv"] as const)
  const stock = pickEnum(params, "stok", ["tukendi", "kritik", "yeterli"] as const)
  const featured = pickEnum(params, "one-cikan", ["evet"] as const)
  const category = pickString(params, "kategori", 60)
  const q = pickString(params, "q", 60)

  const [{ rows, total, error }, categories] = await Promise.all([
    loadProductList(supabase, {
      q,
      status,
      category,
      stock,
      featured,
      sort,
      dir,
      page,
      perPage: PER_PAGE,
    }),
    loadCategories(supabase),
  ])

  const href = hrefBuilder("/admin/products", params)
  const hasFilters = Boolean(q || status || stock || category || featured)

  return (
    <>
      <PageHeader
        title="Ürünler"
        description="Kataloğu yönetin. Değişiklikler mağazada anında görünür."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Ürünler" }]}
        actions={
          <Link
            href="/admin/products/new"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Ürün ekle
          </Link>
        }
      />

      <FilterBar>
        <SearchField
          label="Ara"
          placeholder="Ürün adı, kısa ad veya SKU"
        />
        <FilterSelect
          label="Yayın durumu"
          paramName="durum"
          options={[
            { value: "aktif", label: "Yayında" },
            { value: "arsiv", label: "Arşivde" },
          ]}
        />
        <FilterSelect
          label="Stok"
          paramName="stok"
          options={[
            { value: "tukendi", label: "Tükendi" },
            { value: "kritik", label: "Kritik" },
            { value: "yeterli", label: "Stokta" },
          ]}
        />
        <FilterSelect
          label="Kategori"
          paramName="kategori"
          options={categories.map((category) => ({
            value: category.slug,
            label: category.name,
          }))}
        />
        <FilterSelect
          label="Öne çıkan"
          paramName="one-cikan"
          options={[{ value: "evet", label: "Yalnızca öne çıkanlar" }]}
        />
        <ClearFilters params={["q", "durum", "stok", "kategori", "one-cikan"]} />
      </FilterBar>

      <Panel bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          {error ? (
            <ErrorState description="Ürün listesi alınamadı. Sayfayı yenilemeyi deneyin." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "Sonuç bulunamadı" : "Henüz ürün yok"}
              description={
                hasFilters
                  ? "Arama veya filtreleri değiştirerek tekrar deneyin."
                  : "İlk ürününüzü ekleyerek kataloğu oluşturmaya başlayın."
              }
              action={
                hasFilters ? undefined : (
                  <Link
                    href="/admin/products/new"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
                  >
                    Ürün ekle
                  </Link>
                )
              }
            />
          ) : (
            <>
              <TableScroll className="hidden md:block">
                <Table caption="Ürün listesi">
                  <thead>
                    <tr>
                      <Th width="3rem">
                        <span className="sr-only">Görsel</span>
                      </Th>
                      <SortableTh
                        field="name"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Ürün
                      </SortableTh>
                      <Th>Kategori</Th>
                      <SortableTh
                        field="base_price"
                        align="right"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Fiyat
                      </SortableTh>
                      <SortableTh
                        field="total_stock"
                        align="right"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Adet
                      </SortableTh>
                      <Th>Stok</Th>
                      <Th>Durum</Th>
                      <SortableTh
                        field="updated_at"
                        align="right"
                        activeField={sort}
                        activeDir={dir}
                        buildHref={(field, nextDir) => href({ sirala: field, yon: nextDir, sayfa: null })}
                      >
                        Güncellendi
                      </SortableTh>
                      <Th align="right">
                        <span className="sr-only">İşlemler</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product) => (
                      <Tr key={product.id}>
                        <Td>
                          <span className="relative block h-9 w-9 overflow-hidden rounded-media bg-ink/[0.06]">
                            {product.mainImageUrl && (
                              <Image
                                src={product.mainImageUrl}
                                alt=""
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            )}
                          </span>
                        </Td>
                        <Td>
                          <Link
                            href={`/admin/products/${product.id}`}
                            prefetch={false}
                            className="font-medium text-ink transition-colors duration-200 hover:text-brand"
                          >
                            {product.name}
                          </Link>
                          <span className="mt-0.5 block text-xs text-ink/45">
                            /{product.slug}
                            {product.isFeatured && " · Öne çıkan"}
                          </span>
                        </Td>
                        <Td>{product.categoryName ?? "—"}</Td>
                        <Td align="right" numeric>
                          {formatCurrency(product.basePrice)}
                        </Td>
                        <Td align="right" numeric>
                          {formatInteger(product.totalStock)}
                        </Td>
                        <Td>
                          <StockTag
                            level={
                              product.stockStatus === "tukendi"
                                ? "out"
                                : product.stockStatus === "kritik"
                                  ? "low"
                                  : "healthy"
                            }
                          />
                        </Td>
                        <Td>
                          <PublishTag active={product.isActive} />
                        </Td>
                        <Td align="right">{formatDate(product.updatedAt)}</Td>
                        <Td align="right">
                          <Link
                            href={`/admin/products/${product.id}`}
                            prefetch={false}
                            className="inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest"
                          >
                            Düzenle
                          </Link>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>

              <RecordList>
                {rows.map((product) => (
                  <RecordCard
                    key={product.id}
                    href={`/admin/products/${product.id}`}
                    title={product.name}
                    meta={`/${product.slug}`}
                  >
                    <RecordField label="Fiyat" numeric>
                      {formatCurrency(product.basePrice)}
                    </RecordField>
                    <RecordField label="Adet" numeric>
                      {formatInteger(product.totalStock)}
                    </RecordField>
                    <RecordField label="Stok">
                      <StockTag
                        level={
                          product.stockStatus === "tukendi"
                            ? "out"
                            : product.stockStatus === "kritik"
                              ? "low"
                              : "healthy"
                        }
                      />
                    </RecordField>
                    <RecordField label="Kategori">{product.categoryName ?? "—"}</RecordField>
                    <RecordField label="Güncellendi">{formatDate(product.updatedAt)}</RecordField>
                    <div className="col-span-2">
                      <PublishTag active={product.isActive} />
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
              total={total}
              buildHref={(next) => href({ sayfa: next === 1 ? null : next })}
            />
          </div>
        )}
      </Panel>
    </>
  )
}
