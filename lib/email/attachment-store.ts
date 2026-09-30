/**
 * Gelen eklerin Storage'a indirilmesi — webhook ve "yeniden dene" ortak kullanır.
 *
 * Her ek bir `email_attachments` satırıdır; indirme başarısızsa satır
 * `fetch_error` ile kalır, ileti kaybolmaz. Boyut ve adet üst sınırları
 * buradadır (10 ek, ek başına 10 MB).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  downloadBytes,
  fetchAttachmentDownload,
  type ReceivedEmail,
} from "./inbound.ts"

export const MAX_ATTACHMENTS = 10
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

function excerpt(value: string, max = 2000): string {
  return value.length > max ? value.slice(0, max) : value
}

function sanitizeFilename(name: string): string {
  const base = name.split("/").pop()?.split("\\").pop() ?? "ek"
  const cleaned = base.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ._-]+/g, "_").slice(0, 120)
  return cleaned === "" ? "ek" : cleaned
}

export async function storeInboundAttachments(
  supabase: SupabaseClient,
  emailRowId: string,
  email: ReceivedEmail,
): Promise<void> {
  const items = email.attachments.slice(0, MAX_ATTACHMENTS)
  for (const item of items) {
    const { data: row, error: rowError } = await supabase
      .from("email_attachments")
      .insert({
        email_id: emailRowId,
        resend_attachment_id: item.id,
        filename: item.filename,
        content_type: item.content_type,
        size_bytes: item.size,
        content_disposition: item.content_disposition,
        content_id: item.content_id,
      })
      .select("id")
      .single()
    if (rowError || !row) continue
    const attachmentId = (row as { id: string }).id

    const meta = await fetchAttachmentDownload(email.id, item.id)
    if (!meta.ok) {
      await supabase
        .from("email_attachments")
        .update({ fetch_error: excerpt(meta.error) })
        .eq("id", attachmentId)
      continue
    }
    const bytes = await downloadBytes(meta.value.download_url, { maxBytes: MAX_ATTACHMENT_BYTES })
    if (!bytes.ok) {
      await supabase
        .from("email_attachments")
        .update({ fetch_error: excerpt(bytes.error) })
        .eq("id", attachmentId)
      continue
    }
    const path = `gelen/${emailRowId}/${attachmentId}-${sanitizeFilename(item.filename)}`
    const { error: uploadError } = await supabase.storage
      .from("email-attachments")
      .upload(path, bytes.value, { contentType: item.content_type, upsert: false })
    await supabase
      .from("email_attachments")
      .update(
        uploadError ? { fetch_error: excerpt(uploadError.message) } : { storage_path: path },
      )
      .eq("id", attachmentId)
  }
}
