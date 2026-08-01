import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { ClearFilters, FilterBar, FilterSelect, SearchField } from "@/components/admin/ui/filters"
import { Pagination } from "@/components/admin/ui/table"
import { hrefBuilder, pickEnum, pickPage, pickString } from "@/lib/admin/url"
import { loadMediaPage, loadMediaUsage, type MediaSort } from "@/lib/admin/queries/media"
import {
  MEDIA_MIME_LABELS,
  MEDIA_PAGE_SIZE,
  type MediaUsage,
} from "@/lib/admin/media"
import { MediaGrid, MediaUploader } from "./media-manager"

export const metadata: Metadata = { title: "Medya" }
export const dynamic = "force-dynamic"

/**
 * Media library.
 *
 * The catalogue is read from `media_assets` rather than by listing Storage:
 * that is what makes search, type filtering, sorting, counting and pagination
 * possible at all, and it means the browser never receives more than one page
 * of records regardless of how large the bucket becomes. The first version of
 * this screen walked every YYYY-MM/ prefix in the bucket on every render.
 *
 * Everything runs through the administrator's own session, so RLS decides what
 * is visible. Public product images still load on the storefront because the
 * bucket itself is public and object URLs do not consult those policies.
 */

const SORTS = ["newest", "oldest", "name", "largest"] as const
const SORT_LABELS: Record<MediaSort, string> = {
  newest: "En yeni",
  oldest: "En eski",
  name: "Ada göre",
  largest: "En büyük",
}

const MIME_VALUES = Object.keys(MEDIA_MIME_LABELS)

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageMedia")
  const params = await searchParams

  // Every one of these is attacker-controlled, so each is clamped to an
  // allow-list before it reaches a query.
  const search = pickString(params, "q", 80)
  const mimeType = pickEnum(params, "tur", MIME_VALUES)
  const sort = pickEnum(params, "sirala", SORTS, "newest")
  const page = pickPage(params)

  const result = await loadMediaPage(supabase, { search, mimeType, sort, page })

  const usageMap = await loadMediaUsage(supabase, result.assets)
  const usage: Record<string, MediaUsage[]> = {}
  for (const [id, entries] of usageMap) usage[id] = entries

  const href = hrefBuilder("/admin/media", params)

  return (
    <>
      <PageHeader
        title="Medya"
        description="Ürün görselleri Supabase Storage'daki product-media kovasında saklanır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Medya" }]}
      />

      <div className="mb-6">
        <InlineAlert tone="info">
          Bir görsel herhangi bir üründe kullanılıyorsa silinemez. Önce ürünün görsel
          listesinden kaldırın; böylece mağazadaki hiçbir ürün görseli kırılmaz.
        </InlineAlert>
      </div>

      <div className="space-y-6">
        <MediaUploader />

        <Panel
          title="Kütüphane"
          description={
            result.total === 0
              ? "Kayıt yok"
              : `${result.total} görsel · sayfa ${result.page}/${result.pageCount}`
          }
        >
          <FilterBar>
            <SearchField
              placeholder="badem…"
              label="Görsel ara"
              hint="Dosya adı, görünen ad ve alt metinde arar."
            />
            <FilterSelect
              paramName="tur"
              label="Dosya türü"
              options={MIME_VALUES.map((value) => ({
                value,
                label: MEDIA_MIME_LABELS[value],
              }))}
              allLabel="Tüm türler"
            />
            <FilterSelect
              paramName="sirala"
              label="Sırala"
              // "newest" is the default, and FilterSelect already renders the
              // default as its empty-value option — listing it again would put
              // "En yeni" in the dropdown twice.
              options={SORTS.filter((value) => value !== "newest").map((value) => ({
                value,
                label: SORT_LABELS[value],
              }))}
              allLabel="En yeni"
            />
            <ClearFilters params={["q", "tur", "sirala", "sayfa"]} />
          </FilterBar>

          <MediaGrid assets={result.assets} usage={usage} />

          {result.total > MEDIA_PAGE_SIZE && (
            <div className="mt-6">
              <Pagination
                page={result.page}
                perPage={result.pageSize}
                total={result.total}
                buildHref={(next) => href({ sayfa: next === 1 ? null : next })}
              />
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
