/**
 * E-posta kutusu satır tipleri — sayfalar ve eylemler arası sözleşme.
 *
 * PostgREST'in döndürdüğü şekil; DB migration'daki kolonlarla birebir.
 */

export interface EmailRow {
  id: string
  thread_id: string
  direction: "inbound" | "outbound"
  resend_id: string | null
  from_address: string
  from_name: string | null
  to_addresses: string[]
  cc_addresses: string[]
  bcc_addresses: string[]
  reply_to_addresses: string[]
  subject: string
  body_text: string | null
  body_html: string | null
  headers: Record<string, string>
  message_id: string | null
  in_reply_to: string | null
  references_text: string | null
  auth_spf: string | null
  auth_dkim: string | null
  auth_dmarc: string | null
  fetch_status: "ok" | "failed"
  fetch_error: string | null
  is_read: boolean
  read_at: string | null
  is_archived: boolean
  archived_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  sent_by: string | null
  received_at: string | null
  sent_at: string | null
  created_at: string
}

export interface EmailThreadRow {
  id: string
  subject: string
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface EmailAttachmentRow {
  id: string
  email_id: string
  resend_attachment_id: string | null
  filename: string
  content_type: string
  size_bytes: number | null
  content_disposition: string | null
  content_id: string | null
  storage_bucket: string
  storage_path: string | null
  fetch_error: string | null
  created_at: string
}

/** Kimlik doğrulaması kesin başarısız olan (muhtemelen sahte) ileti. */
export function isAuthFailed(row: Pick<EmailRow, "auth_spf" | "auth_dkim" | "auth_dmarc">): boolean {
  return row.auth_spf === "fail" || row.auth_dkim === "fail" || row.auth_dmarc === "fail"
}

export function authResultLabel(value: string | null): string {
  if (value === "pass") return "geçti"
  if (value === "fail") return "başarısız"
  if (value === "gray") return "belirsiz"
  if (value === "processing_failed") return "işlenemedi"
  if (value === "unknown") return "bilinmiyor"
  return "yok"
}

/** Muhatap satırı: gelen için gönderen, giden için alıcılar. */
export function counterpartOf(row: Pick<EmailRow, "direction" | "from_address" | "to_addresses">): string {
  if (row.direction === "inbound") return row.from_address || "(gönderen yok)"
  return row.to_addresses.length > 0 ? row.to_addresses.join(", ") : "(alıcı yok)"
}

export function previewOf(text: string | null, max = 120): string {
  if (!text) return ""
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** `RESEND_FROM` değerinden çıplak adres: `Kabia <info@x>` → `info@x`. */
export function bareAddress(fromValue: string | null | undefined): string | null {
  if (!fromValue) return null
  const angled = fromValue.match(/<([^<>@\s]+@[^<>@\s]+)>/)
  if (angled?.[1]) return angled[1]
  const trimmed = fromValue.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed
  return null
}
