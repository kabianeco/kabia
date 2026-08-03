import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { fetchAdminCategories, fetchAdminPostList, ADMIN_PAGE_SIZE } from "@/lib/blog/queries"
import { BLOG_POST_STATUSES, BLOG_STATUS_LABELS, type AdminPostSort } from "@/lib/blog/types"
import { formatDate } from "@/lib/admin/format"
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
import { BlogStatusTag } from "@/components/admin/ui/status"
import { ClearFilters, FilterBar, FilterSelect, SearchField } from "@/components/admin/ui/filters"

export const metadata: Metadata = { title: "Blog" }
export const dynamic = "force-dynamic"

const SORT_KEYS: AdminPostSort[] = ["updated_at", "published_at", "title"]

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageBlog")
  const params = await searchParams

  const page = pickPage(params)
  const sort = pickEnum<AdminPostSort>(params, "sirala", SORT_KEYS, "updated_at")
  const dir = pickEnum(params, "yon", ["asc", "desc"] as const, "desc")
  const status = pickEnum(params, "durum", BLOG_POST_STATUSES)
  const categoryId = pickString(params, "kategori", 60)
  const q = pickString(params, "q", 60)

  const [result, categories] = await Promise.all([
    fetchAdminPostList(supabase, { status, categoryId, query: q, sort, dir, page, perPage: ADMIN_PAGE_SIZE }),
    fetchAdminCategories(supabase),
  ])

  const href = hrefBuilder("/admin/blog", params)
  const hasFilters = Boolean(q || status || categoryId)

  return (
    <>
      <PageHeader
        title="Blog"
        description="Yazıları yönetin. Yayınlanan yazılar mağaza ile aynı yayın anında gösterilir."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Blog" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/blog/categories"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-5 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
            >
              Kategoriler ve etiketler
            </Link>
            <Link
              href="/admin/blog/new"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
            >
              Yazı ekle
            </Link>
          </div>
        }
      />

      <FilterBar>
        <SearchField label="Ara" placeholder="Başlık veya özet" />
        <FilterSelect
          label="Durum"
          paramName="durum"
          options={BLOG_POST_STATUSES.map((s) => ({ value: s, label: BLOG_STATUS_LABELS[s] }))}
        />
        <FilterSelect
          label="Kategori"
          paramName="kategori"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <ClearFilters params={["q", "durum", "kategori"]} />
      </FilterBar>

      <Panel bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          {!result ? (
            <ErrorState description="Yazı listesi alınamadı. Sayfayı yenilemeyi deneyin." />
          ) : result.items.length === 0 ? (
            <EmptyState
              title={hasFilters ? "Sonuç bulunamadı" : "Henüz yazı yok"}
              description={hasFilters ? "Arama veya filtreleri değiştirerek tekrar deneyin." : "İlk yazınızı ekleyerek blogu oluşturmaya başlayın."}
              action={
                hasFilters ? undefined : (
                  <Link
                    href="/admin/blog/new"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
                  >
                    Yazı ekle
                  </Link>
                )
              }
            />
          ) : (
            <>
              <TableScroll className="hidden md:block">
                <Table caption="Blog yazıları">
                  <thead>
                    <tr>
                      <SortableTh field="title" activeField={sort} activeDir={dir} buildHref={(f, d) => href({ sirala: f, yon: d, sayfa: null })}>
                        Yazı
                      </SortableTh>
                      <Th>Kategori</Th>
                      <Th>Durum</Th>
                      <Th>Yazar</Th>
                      <SortableTh field="published_at" align="right" activeField={sort} activeDir={dir} buildHref={(f, d) => href({ sirala: f, yon: d, sayfa: null })}>
                        Yayın
                      </SortableTh>
                      <SortableTh field="updated_at" align="right" activeField={sort} activeDir={dir} buildHref={(f, d) => href({ sirala: f, yon: d, sayfa: null })}>
                        Güncellendi
                      </SortableTh>
                      <Th align="right">
                        <span className="sr-only">İşlemler</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((post) => (
                      <Tr key={post.id}>
                        <Td>
                          <Link href={`/admin/blog/${post.id}`} prefetch={false} className="font-medium text-ink transition-colors duration-200 hover:text-brand">
                            {post.title}
                          </Link>
                          <span className="mt-0.5 block text-xs text-ink/45">
                            /blog/{post.slug}
                            {post.featured && " · Öne çıkan"}
                          </span>
                        </Td>
                        <Td>{post.categoryName ?? "—"}</Td>
                        <Td>
                          <BlogStatusTag status={post.status} />
                        </Td>
                        <Td>{post.authorName ?? "—"}</Td>
                        <Td align="right">{formatDate(post.publishedAt)}</Td>
                        <Td align="right">{formatDate(post.updatedAt)}</Td>
                        <Td align="right">
                          <Link href={`/admin/blog/${post.id}`} prefetch={false} className="inline-flex min-h-11 items-center text-sm text-brand transition-colors duration-300 hover:text-forest">
                            Düzenle
                          </Link>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>

              <RecordList>
                {result.items.map((post) => (
                  <RecordCard key={post.id} href={`/admin/blog/${post.id}`} title={post.title} meta={`/blog/${post.slug}`}>
                    <RecordField label="Kategori">{post.categoryName ?? "—"}</RecordField>
                    <RecordField label="Durum">
                      <BlogStatusTag status={post.status} />
                    </RecordField>
                    <RecordField label="Yazar">{post.authorName ?? "—"}</RecordField>
                    <RecordField label="Güncellendi">{formatDate(post.updatedAt)}</RecordField>
                  </RecordCard>
                ))}
              </RecordList>
            </>
          )}
        </div>

        {result && result.items.length > 0 && (
          <div className="border-t border-ink/10 px-4 py-3 md:px-5">
            <Pagination page={page} perPage={ADMIN_PAGE_SIZE} total={result.total} buildHref={(next) => href({ sayfa: next === 1 ? null : next })} />
          </div>
        )}
      </Panel>
    </>
  )
}
