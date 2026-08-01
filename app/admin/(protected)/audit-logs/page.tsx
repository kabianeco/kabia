import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { AUDIT_ACTION_LABELS, describeAuditAction, describeAuditEntity } from "@/lib/admin/audit"
import { loadEmailsFor } from "@/lib/admin/queries/customers"
import { sanitizeSearch } from "@/lib/admin/queries/products"
import { formatDateTime } from "@/lib/admin/format"
import { logQueryError } from "@/lib/admin/errors"
import { can, ROLE_LABELS, type AppRole } from "@/lib/admin/roles"
import { hrefBuilder, pickEnum, pickPage, pickString } from "@/lib/admin/url"
import { EmptyState, ErrorState, InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { Pagination } from "@/components/admin/ui/table"
import { ClearFilters, DateRangeFilter, FilterBar, FilterSelect, SearchField } from "@/components/admin/ui/filters"

export const metadata: Metadata = { title: "Denetim Kayıtları" }
export const dynamic = "force-dynamic"

const PER_PAGE = 25

const ENTITY_TYPES = [
  "product",
  "product_variant",
  "order",
  "media",
  "setting",
  "administrator",
] as const

function dayBoundary(value: string | undefined, endOfDay = false): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const base = new Date(`${value}T00:00:00+03:00`)
  if (Number.isNaN(base.getTime())) return null
  if (endOfDay) base.setTime(base.getTime() + 24 * 3_600_000)
  return base.toISOString()
}

/**
 * Read-only audit log.
 *
 * There is no edit or delete control anywhere on this page, and none could
 * work: the table has no UPDATE or DELETE policy and a trigger raises on either
 * operation.
 *
 * Scope is enforced by RLS, not by this component — a super_admin's query
 * returns every row, a plain admin's returns only their own actions. The notice
 * explains which of the two the reader is seeing.
 */
export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { session, supabase } = await adminPageContext()
  const params = await searchParams
  const seesEverything = can(session.role, "viewAllAuditLogs")

  const page = pickPage(params)
  const action = pickString(params, "islem", 60)
  const entity = pickEnum(params, "tur", ENTITY_TYPES)
  const q = pickString(params, "q", 60)
  const from = pickString(params, "from", 10)
  const to = pickString(params, "to", 10)

  const offset = (page - 1) * PER_PAGE

  let query = supabase
    .from("admin_audit_logs")
    .select(
      "id, admin_user_id, admin_role, action, entity_type, entity_id, before_data, after_data, metadata, created_at",
      { count: "exact" },
    )

  if (action && AUDIT_ACTION_LABELS[action]) query = query.eq("action", action)
  if (entity) query = query.eq("entity_type", entity)

  const term = sanitizeSearch(q)
  if (term.length >= 2) query = query.ilike("entity_id", `%${term}%`)

  const fromIso = dayBoundary(from)
  const toIso = dayBoundary(to, true)
  if (fromIso) query = query.gte("created_at", fromIso)
  if (toIso) query = query.lt("created_at", toIso)

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1)

  if (error) logQueryError("auditLogs:list", error)

  const rows = (data ?? []) as {
    id: string
    admin_user_id: string
    admin_role: string
    action: string
    entity_type: string
    entity_id: string | null
    before_data: Record<string, unknown> | null
    after_data: Record<string, unknown> | null
    metadata: Record<string, unknown> | null
    created_at: string
  }[]

  const emails = await loadEmailsFor([...new Set(rows.map((row) => row.admin_user_id))])

  const href = hrefBuilder("/admin/audit-logs", params)
  const hasFilters = Boolean(action || entity || q || from || to)

  return (
    <>
      <PageHeader
        title="Denetim Kayıtları"
        description="Yönetici işlemlerinin değiştirilemez kaydı. Bu kayıtlar salt okunurdur ve silinemez."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Denetim Kayıtları" }]}
      />

      <div className="mb-6">
        <InlineAlert tone="info">
          {seesEverything
            ? "Süper yönetici olarak tüm yöneticilerin işlemlerini görüyorsunuz. Parola, oturum anahtarı ve kart bilgisi gibi hassas alanlar kayıt yazılırken maskelenir."
            : "Yalnızca kendi işlemlerinizi görüyorsunuz. Tüm yöneticilerin kayıtlarına yalnızca süper yöneticiler erişebilir."}
        </InlineAlert>
      </div>

      <FilterBar>
        <SearchField label="Kayıt kimliği" placeholder="Ürün / sipariş kimliği" hint="En az 2 karakter" />
        <FilterSelect
          label="İşlem"
          paramName="islem"
          options={Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <FilterSelect
          label="Kayıt türü"
          paramName="tur"
          options={ENTITY_TYPES.map((value) => ({
            value,
            label: describeAuditEntity(value),
          }))}
        />
        <DateRangeFilter />
        <ClearFilters params={["q", "islem", "tur", "from", "to"]} />
      </FilterBar>

      <Panel bodyClassName="px-0 py-0 md:px-0">
        <div className="px-4 py-4 md:px-5">
          {error ? (
            <ErrorState description="Denetim kayıtları alınamadı." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "Sonuç bulunamadı" : "Henüz denetim kaydı yok"}
              description={
                hasFilters
                  ? "Filtreleri değiştirerek tekrar deneyin."
                  : "Yönetici işlemleri gerçekleştikçe burada listelenir."
              }
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => {
                const hasPayload =
                  (row.before_data && Object.keys(row.before_data).length > 0) ||
                  (row.after_data && Object.keys(row.after_data).length > 0) ||
                  (row.metadata && Object.keys(row.metadata).length > 0)

                return (
                  <li
                    key={row.id}
                    className="rounded-[4px] border border-ink/10 bg-ivory/60 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{describeAuditAction(row.action)}</p>
                        <p className="mt-1 text-xs text-ink/50">
                          {describeAuditEntity(row.entity_type)}
                          {row.entity_id && (
                            <>
                              {" · "}
                              <span className="font-mono">{row.entity_id}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-ink/60">
                          {emails.get(row.admin_user_id) ?? "Yönetici"}
                        </p>
                        <p className="label mt-0.5 text-olive">
                          {ROLE_LABELS[row.admin_role as AppRole] ?? row.admin_role}
                        </p>
                        <p className="mt-1 text-xs text-ink/45">
                          {formatDateTime(row.created_at)}
                        </p>
                      </div>
                    </div>

                    {hasPayload && (
                      <details className="mt-3">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs text-ink/50 transition-colors duration-200 hover:text-ink">
                          Değişiklik detayı
                        </summary>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          {row.before_data && Object.keys(row.before_data).length > 0 && (
                            <JsonBlock title="Önce" value={row.before_data} />
                          )}
                          {row.after_data && Object.keys(row.after_data).length > 0 && (
                            <JsonBlock title="Sonra" value={row.after_data} />
                          )}
                          {row.metadata && Object.keys(row.metadata).length > 0 && (
                            <JsonBlock title="Ek bilgi" value={row.metadata} className="sm:col-span-2" />
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
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

function JsonBlock({
  title,
  value,
  className,
}: {
  title: string
  value: Record<string, unknown>
  className?: string
}) {
  return (
    <div className={className}>
      <p className="label mb-1 text-olive">{title}</p>
      <dl className="overflow-x-auto rounded-[3px] border border-ink/10 bg-paper/60 p-3 text-xs">
        {Object.entries(value).map(([key, entry]) => (
          <div key={key} className="flex gap-2 py-0.5">
            <dt className="shrink-0 font-mono text-ink/50">{key}</dt>
            <dd className="min-w-0 break-all font-mono text-ink/80">
              {typeof entry === "object" && entry !== null
                ? JSON.stringify(entry)
                : String(entry)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
