import type { Metadata } from "next"
import Link from "next/link"
import { adminPageContext } from "@/lib/admin/auth"
import { logQueryError } from "@/lib/admin/errors"
import { formatDateTime } from "@/lib/admin/format"
import { pickEnum, pickString } from "@/lib/admin/url"
import { sanitizeInboundHtml } from "@/lib/email/sanitize"
import {
  authResultLabel,
  counterpartOf,
  isAuthFailed,
  type EmailAttachmentRow,
  type EmailRow,
  type EmailThreadRow,
} from "@/lib/email/rows"
import { EmptyState, ErrorState, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { EmailRetry, EmailTriage } from "../message-actions"

export const metadata: Metadata = { title: "E-posta" }
export const dynamic = "force-dynamic"

function formatBytes(size: number | null): string {
  if (size === null || !Number.isFinite(size)) return ""
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Konuşma görünümü: başlığın tüm iletileri kronolojik.
 *
 * Güvenlik:
 *   - Düz metin varsayılan; HTML yalnızca temizlenmiş + `sandbox=""`
 *     çerçevede, üçüncü taraf isteği çıkaramaz.
 *   - Uzak görseller varsayılan kapalı (`?gorsel=1` ile ileti başına açılır);
 *     `cid:` ekler imzalı URL'ye çevrilir (iz sürülemez).
 *   - Ekler yalnızca indirilir; satır içi çalıştırma yok.
 *   - SPF/DKIM/DMARC başarısızlığı belirgin uyarı kutusudur.
 */
export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { threadId } = await params
  const query = await searchParams
  const { supabase } = await adminPageContext("manageInbox")

  const htmlView = pickEnum(query, "gorunum", ["metin", "html"] as [string, ...string[]]) === "html"
  const showImages = pickString(query, "gorsel") === "1"
  const auditWarning = pickString(query, "uyari") === "denetim"

  const { data: threadData, error: threadError } = await supabase
    .from("email_threads")
    .select("id, subject, created_at, updated_at, last_message_at")
    .eq("id", threadId)
    .maybeSingle()
  if (threadError) logQueryError("inbox:thread", threadError)
  const thread = threadData as EmailThreadRow | null

  const { data: messageData, error: messageError } = await supabase
    .from("emails")
    .select("*")
    .eq("thread_id", threadId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
  if (messageError) logQueryError("inbox:messages", messageError)
  const messages = ((messageData ?? []) as EmailRow[]).filter((m) => m.thread_id === threadId)

  if (!thread || messages.length === 0) {
    return (
      <>
        <PageHeader
          title="E-posta"
          breadcrumbs={[{ label: "E-posta", href: "/admin/eposta" }]}
        />
        {threadError || messageError ? (
          <ErrorState title="Konuşma yüklenemedi" description="Konuşma şu anda görüntülenemiyor." />
        ) : (
          <EmptyState title="Konuşma bulunamadı" description="Bu konuşma silinmiş ya da hiç var olmamış olabilir." />
        )}
      </>
    )
  }

  // Açılan konuşmanın okunmamışları okundu sayılır (ilk okuma korunur:
  // yalnızca hâlâ okunmamış satırlar güncellenir).
  const unreadIds = messages.filter((m) => !m.is_read).map((m) => m.id)
  if (unreadIds.length > 0) {
    const { error: markError } = await supabase
      .from("emails")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .eq("is_read", false)
    if (markError) logQueryError("inbox:markRead", markError)
    else for (const m of messages) {
      if (!m.is_read) {
        m.is_read = true
        m.read_at = new Date().toISOString()
      }
    }
  }

  const messageIds = messages.map((m) => m.id)
  const { data: attachmentData, error: attachmentError } = await supabase
    .from("email_attachments")
    .select("*")
    .in("email_id", messageIds)
    .order("created_at", { ascending: true })
  if (attachmentError) logQueryError("inbox:attachments", attachmentError)
  const attachments = (attachmentData ?? []) as EmailAttachmentRow[]
  const byEmail = new Map<string, EmailAttachmentRow[]>()
  for (const attachment of attachments) {
    const list = byEmail.get(attachment.email_id) ?? []
    list.push(attachment)
    byEmail.set(attachment.email_id, list)
  }

  // `cid:` eşleşmeleri için imzalı URL'ler (1 saat). Yalnızca HTML
  // görünümünde kullanılır; üçüncü tarafa istek çıkmaz.
  const cidMap: Record<string, string> = {}
  if (htmlView) {
    const cids = attachments.filter((a) => a.content_id && a.storage_path)
    await Promise.all(
      cids.map(async (attachment) => {
        const { data, error } = await supabase.storage
          .from(attachment.storage_bucket)
          .createSignedUrl(attachment.storage_path as string, 3600)
        if (!error && data?.signedUrl && attachment.content_id) {
          cidMap[attachment.content_id] = data.signedUrl
        }
      }),
    )
  }

  const title = thread.subject || "(konusuz)"

  return (
    <>
      <PageHeader
        title={title}
        description={`${messages.length} ileti · son ileti ${formatDateTime(thread.last_message_at)}`}
        breadcrumbs={[{ label: "E-posta", href: "/admin/eposta" }, { label: title }]}
        actions={
          <Link
            href="/admin/eposta/yeni"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-6 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
          >
            Yeni e-posta
          </Link>
        }
      />

      {auditWarning && (
        <Panel className="mb-4 border-shell/40">
          <p className="text-sm text-ink/75">
            İleti gönderildi, ancak denetim kaydı yazılamadı. Lütfen sistem yöneticisine bildirin.
          </p>
        </Panel>
      )}

      <div className="space-y-4">
        {messages.map((message) => {
          const failed = message.fetch_status === "failed"
          const spoofed = isAuthFailed(message)
          const files = byEmail.get(message.id) ?? []
          const sanitized = htmlView && message.body_html
            ? sanitizeInboundHtml({ html: message.body_html, allowRemoteImages: showImages, cidMap })
            : null

          return (
            <Panel key={message.id} bodyClassName="py-4">
              <div id={`ileti-${message.id}`} className="scroll-mt-24">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0">
                    <p className="break-words text-base">
                      {message.direction === "inbound" ? message.from_address : `Kime: ${message.to_addresses.join(", ")}`}
                      {message.direction === "outbound" && (
                        <span className="ml-3 text-xs text-olive">Gönderildi</span>
                      )}
                    </p>
                    <p className="mt-1 break-words text-xs text-ink/50">
                      {message.direction === "inbound"
                        ? `Alıcı: ${message.to_addresses.join(", ") || "—"}`
                        : `Gönderen: ${message.from_address}`}
                      {message.cc_addresses.length > 0 && ` · Kopya: ${message.cc_addresses.join(", ")}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink/45">
                    <p>{formatDateTime(message.received_at ?? message.sent_at ?? message.created_at)}</p>
                    <p className="mt-1">{message.is_read ? "Okundu" : "Okunmadı"}</p>
                  </div>
                </div>

                {spoofed && message.direction === "inbound" && (
                  <div role="alert" className="mt-4 rounded-[4px] border border-clay/40 bg-clay/10 px-4 py-3">
                    <p className="text-sm font-medium text-clay">
                      Dikkat: bu ileti sahte olabilir.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink/70">
                      Gönderen doğrulanamadı — SPF {authResultLabel(message.auth_spf)}, DKIM{" "}
                      {authResultLabel(message.auth_dkim)}, DMARC {authResultLabel(message.auth_dmarc)}.
                      Bağlantılara ve eklere özellikle dikkat edin; istenen işlemleri başka kanaldan doğrulayın.
                    </p>
                  </div>
                )}

                {failed ? (
                  <div className="mt-4 rounded-[4px] border border-ink/10 bg-ivory px-4 py-3">
                    <p className="text-sm text-ink/75">
                      İleti gövdesi Resend&apos;den çekilemedi{message.fetch_error ? `: ${message.fetch_error}` : "."}
                    </p>
                    <div className="mt-3">
                      <EmailRetry emailId={message.id} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                      <Link
                        href={`/admin/eposta/${threadId}#ileti-${message.id}`}
                        prefetch={false}
                        scroll={false}
                        className={htmlView ? "text-ink/50 hover:text-ink" : "font-medium text-ink"}
                      >
                        Metin
                      </Link>
                      <span aria-hidden="true" className="text-ink/25">·</span>
                      <Link
                        href={`/admin/eposta/${threadId}?gorunum=html#ileti-${message.id}`}
                        prefetch={false}
                        scroll={false}
                        className={htmlView ? "font-medium text-ink" : "text-ink/50 hover:text-ink"}
                      >
                        HTML
                      </Link>
                      {htmlView && (sanitized?.blockedImages ?? 0) > 0 && !showImages && (
                        <>
                          <span aria-hidden="true" className="text-ink/25">·</span>
                          <Link
                            href={`/admin/eposta/${threadId}?gorunum=html&gorsel=1#ileti-${message.id}`}
                            prefetch={false}
                            scroll={false}
                            className="text-ink/50 hover:text-ink"
                          >
                            Görselleri göster ({sanitized?.blockedImages} uzak görsel engellendi)
                          </Link>
                        </>
                      )}
                    </div>

                    {htmlView && message.body_html ? (
                      <iframe
                        srcDoc={sanitized?.html ?? ""}
                        sandbox=""
                        title={`${message.subject || "ileti"} — HTML görünümü`}
                        className="h-[28rem] w-full rounded-[4px] border border-ink/10 bg-white"
                      />
                    ) : (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-ink/75">
                        {message.body_text || "(boş ileti)"}
                      </p>
                    )}
                  </div>
                )}

                {files.length > 0 && (
                  <div className="mt-4 border-t border-ink/10 pt-3">
                    <p className="label text-olive">Ekler ({files.length})</p>
                    <ul className="mt-2 space-y-1.5">
                      {files.map((file) => (
                        <li key={file.id} className="text-sm">
                          {file.storage_path ? (
                            <Link
                              href={`/admin/eposta/ek/${file.id}`}
                              prefetch={false}
                              className="underline underline-offset-4 hover:text-ink"
                            >
                              {file.filename}
                            </Link>
                          ) : (
                            <span className="text-ink/60">{file.filename} (indirilemedi)</span>
                          )}
                          <span className="ml-2 text-xs text-ink/45">
                            {file.content_type} {formatBytes(file.size_bytes)}
                            {file.fetch_error && !file.storage_path && ` · ${file.fetch_error}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-ink/10 pt-3">
                  <EmailTriage emailId={message.id} isRead={message.is_read} isArchived={message.is_archived} />
                  {message.direction === "inbound" && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Link
                        href={`/admin/eposta/yeni?yanit=${message.id}`}
                        prefetch={false}
                        className="rounded-[4px] border border-ink/10 px-3 py-1.5 text-ink/60 transition-colors hover:border-ink/25 hover:text-ink"
                      >
                        Yanıtla
                      </Link>
                      <Link
                        href={`/admin/eposta/yeni?yanit=${message.id}&tumune=1`}
                        prefetch={false}
                        className="rounded-[4px] border border-ink/10 px-3 py-1.5 text-ink/60 transition-colors hover:border-ink/25 hover:text-ink"
                      >
                        Tümünü yanıtla
                      </Link>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-xs text-ink/35">
                  Muhatap: {counterpartOf(message)}
                  {message.direction === "inbound" && !spoofed && (
                    <> · SPF {authResultLabel(message.auth_spf)}, DKIM {authResultLabel(message.auth_dkim)}, DMARC {authResultLabel(message.auth_dmarc)}</>
                  )}
                </p>
              </div>
            </Panel>
          )
        })}
      </div>
    </>
  )
}
