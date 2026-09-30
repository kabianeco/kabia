import type { Metadata } from "next"
import { adminPageContext } from "@/lib/admin/auth"
import { logQueryError } from "@/lib/admin/errors"
import { formatDateTime } from "@/lib/admin/format"
import { hrefBuilder, pickEnum, pickPage } from "@/lib/admin/url"
import {
  CONTACT_STATUSES,
  contactStatusLabel,
  contactSubjectLabel,
  type ContactMessageRow,
} from "@/lib/contact"
import { EmptyState, ErrorState, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { Pagination } from "@/components/admin/ui/table"
import { FilterBar, FilterSelect } from "@/components/admin/ui/filters"
import { MessageTriage } from "./message-triage"

export const metadata: Metadata = { title: "Mesajlar" }
export const dynamic = "force-dynamic"

const PER_PAGE = 20
const STATUS_IDS = CONTACT_STATUSES.map((status) => status.id)

/**
 * The İletişim inbox.
 *
 * Read-mostly on purpose: the only thing this screen writes is the triage
 * state, and the reply itself happens in a mail client. So each row shows the
 * whole message rather than a truncated preview behind a detail page — there is
 * nothing on a detail page this list would not already be showing.
 *
 * Scope is enforced by RLS. A visitor cannot read this table at all, and the
 * anon role has no grant on it; what the permission check below adds is that an
 * administrator without `viewMessages` never renders the screen either.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("viewMessages")
  const params = await searchParams

  const page = pickPage(params)
  const status = pickEnum(params, "durum", STATUS_IDS as [string, ...string[]])

  let query = supabase
    .from("contact_messages")
    .select("id, name, email, phone, subject, message, status, created_at, read_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  if (status) query = query.eq("status", status)

  const { data, count, error } = await query
  if (error) logQueryError("contactMessages:list", error)

  const href = hrefBuilder("/admin/messages", params)

  return (
    <>
      <PageHeader
        title="Mesajlar"
        description="İletişim formundan gelenler. Yanıt e-posta ile verilir; buradaki işaretler yalnızca neyin ele alındığını gösterir."
      />

      <FilterBar>
        <FilterSelect
          label="Durum"
          paramName="durum"
          options={CONTACT_STATUSES.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
        />
      </FilterBar>

      {error ? (
        <ErrorState title="Mesajlar yüklenemedi" description="Mesajlar şu anda görüntülenemiyor." />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Mesaj yok"
          description={
            status
              ? "Bu durumda mesaj bulunmuyor."
              : "İletişim formundan henüz mesaj gelmemiş."
          }
        />
      ) : (
        <div className="space-y-4">
          {(data as ContactMessageRow[]).map((message) => (
            <Panel key={message.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div>
                  <p className="text-base">
                    {message.name}
                    <span className="ml-3 text-sm text-ink/45">
                      {contactSubjectLabel(message.subject)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-ink/60">
                    <a
                      href={`mailto:${message.email}`}
                      className="underline underline-offset-4 hover:text-ink"
                    >
                      {message.email}
                    </a>
                    <span className="mx-2 text-ink/25" aria-hidden="true">
                      ·
                    </span>
                    <a
                      href={`/admin/eposta/yeni?kime=${encodeURIComponent(message.email)}&konu=${encodeURIComponent(`İletişim formu — ${contactSubjectLabel(message.subject)}`)}`}
                      className="underline underline-offset-4 hover:text-ink"
                    >
                      E-posta ile yanıtla
                    </a>
                    {message.phone && (
                      <>
                        <span className="mx-2 text-ink/25" aria-hidden="true">
                          ·
                        </span>
                        <a
                          href={`tel:${message.phone}`}
                          className="underline underline-offset-4 hover:text-ink"
                        >
                          {message.phone}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right text-xs text-ink/45">
                  <p>{formatDateTime(message.created_at)}</p>
                  <p className="mt-1">{contactStatusLabel(message.status)}</p>
                </div>
              </div>

              {/* whitespace-pre-line: the visitor's own line breaks are part of
                  what they wrote and collapsing them changes the message. */}
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink/75">
                {message.message}
              </p>

              <div className="mt-6 border-t border-ink/10 pt-4">
                <MessageTriage messageId={message.id} status={message.status} />
              </div>
            </Panel>
          ))}

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
