import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { logQueryError } from "@/lib/admin/errors"
import { formatDateTime } from "@/lib/admin/format"
import { hrefBuilder, pickEnum, pickPage, pickString } from "@/lib/admin/url"
import {
  counterpartOf,
  isAuthFailed,
  previewOf,
  type EmailRow,
} from "@/lib/email/rows"
import { EmptyState, ErrorState, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { Pagination } from "@/components/admin/ui/table"
import { ClearFilters, FilterBar, FilterSelect, SearchField } from "@/components/admin/ui/filters"

export const metadata: Metadata = { title: "E-posta" }
export const dynamic = "force-dynamic"

const PER_PAGE = 20
const FOLDERS = [
  { id: "gelen", label: "Gelen" },
  { id: "gonderilen", label: "Gönderilen" },
  { id: "arsiv", label: "Arşiv" },
] as const
type Folder = (typeof FOLDERS)[number]["id"]
const FOLDER_IDS = FOLDERS.map((folder) => folder.id) as [string, ...string[]]

/**
 * E-posta kutusu listesi.
 *
 * Klasör + okunmadı filtresi + gönderen/konu araması + sayfalama. Satır,
 * konuşmanın (thread) ilgili iletisine demirler; konuşmanın tamamı detayda
 * birlikte gösterilir.
 *
 * Kapsam RLS ile; `manageInbox` yetkisi olmayan yönetici bu ekranı göremez.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageInbox")
  const params = await searchParams

  const page = pickPage(params)
  const folder = (pickEnum(params, "klasor", FOLDER_IDS) ?? "gelen") as Folder
  const unreadOnly = pickString(params, "okunmamis") === "1"
  const rawQuery = pickString(params, "q", 120)
  // `.or()` sözdizimini bozacak karakterler aramadan çıkarılır.
  const query = rawQuery?.replace(/[%(),]/g, "").trim() || undefined

  let db = supabase
    .from("emails")
    .select(
      "id, thread_id, direction, from_address, to_addresses, subject, body_text, created_at, is_read, is_archived, auth_spf, auth_dkim, auth_dmarc, fetch_status",
      { count: "exact" },
    )
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  if (folder === "gelen") db = db.eq("direction", "inbound").eq("is_archived", false)
  else if (folder === "gonderilen") db = db.eq("direction", "outbound")
  else db = db.eq("is_archived", true)

  if (unreadOnly) db = db.eq("is_read", false)
  if (query) db = db.or(`from_address.ilike.%${query}%,subject.ilike.%${query}%`)

  const { data, count, error } = await db
  if (error) logQueryError("inbox:list", error)

  const href = hrefBuilder("/admin/eposta", params)
  const rows = (data ?? []) as Partial<EmailRow>[]

  return (
    <>
      <PageHeader
        title="E-posta"
        description="info@kabiaekolojik.com adresine gelenler ve panelden gönderilenler. Yanıtlar müşterinin e-posta uygulamasında aynı konuşmada görünür."
        actions={
          <Link
            href="/admin/eposta/yeni"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
          >
            Yeni e-posta
          </Link>
        }
      />

      <FilterBar>
        <FilterSelect
          label="Klasör"
          paramName="klasor"
          options={FOLDERS.map((folder) => ({ value: folder.id, label: folder.label }))}
          allLabel="Gelen"
        />
        <FilterSelect
          label="Okunma"
          paramName="okunmamis"
          options={[{ value: "1", label: "Yalnızca okunmamış" }]}
          allLabel="Tümü"
        />
        <SearchField
          label="Gönderen / konu"
          placeholder="Adres ya da konu…"
          hint="En az 2 karakter yazın."
        />
        <ClearFilters params={["klasor", "okunmamis", "q"]} />
      </FilterBar>

      {error ? (
        <ErrorState title="E-postalar yüklenemedi" description="E-postalar şu anda görüntülenemiyor." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="E-posta yok"
          description={
            query
              ? "Aramaya uyan e-posta bulunmuyor."
              : folder === "gonderilen"
                ? "Panelden henüz e-posta gönderilmemiş."
                : folder === "arsiv"
                  ? "Arşivde e-posta yok."
                  : "Gelen kutusu boş. Webhook kurulduktan sonra iletiler buraya düşer."
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const failed = row.fetch_status === "failed"
            return (
              <Panel key={row.id} bodyClassName="py-3">
                <div className="flex items-start gap-3">
                  <span
                    aria-label={row.is_read ? "Okundu" : "Okunmadı"}
                    title={row.is_read ? "Okundu" : "Okunmadı"}
                    className={
                      row.is_read
                        ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink/15"
                        : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/eposta/${row.thread_id}#ileti-${row.id}`}
                      prefetch={false}
                      className="block min-w-0"
                    >
                      <span className="block truncate text-sm font-medium text-ink hover:underline">
                        {counterpartOf({
                          direction: row.direction ?? "inbound",
                          from_address: row.from_address ?? "",
                          to_addresses: row.to_addresses ?? [],
                        })}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-ink/75">
                        {row.subject || "(konusuz)"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink/45">
                        {failed ? "Gövde çekilemedi — yeniden deneme bekliyor." : previewOf(row.body_text ?? null)}
                      </span>
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/45">
                      <span>{row.created_at ? formatDateTime(row.created_at) : ""}</span>
                      <span>{row.direction === "outbound" ? "Gönderilen" : "Gelen"}</span>
                      {isAuthFailed({
                        auth_spf: row.auth_spf ?? null,
                        auth_dkim: row.auth_dkim ?? null,
                        auth_dmarc: row.auth_dmarc ?? null,
                      }) && <span className="font-medium text-clay">Doğrulama başarısız</span>}
                    </div>
                  </div>
                </div>
              </Panel>
            )
          })}

          <Pagination
            page={page}
            perPage={PER_PAGE}
            total={count ?? 0}
            buildHref={(next) => href({ sayfa: next === 1 ? null : next })}
          />
        </div>
      )}
    </>
  )
}
