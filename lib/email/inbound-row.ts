/**
 * Gelen iletinin DB satırı — saf kurulum, DB yazımı yok.
 *
 * Webhook rotası ve "yeniden dene" eylemi aynı şekli üretir; testler bu
 * sözleşmeyi doğrular: aynı webhook iki kez gelse `resend_id` aynıdır
 * (unique index ikinciyi yutar), gövde çekilemezse satır `failed` durumla
 * kurulur (sessiz düşme yok).
 */

import type { ReceivedEmail } from "./inbound.ts"

export interface WebhookMeta {
  email_id: string
  from: string
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  message_id: string | null
}

export interface InboundInsert {
  thread_id: string
  direction: "inbound"
  resend_id: string
  from_address: string
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
  received_at: string
}

function excerpt(value: string, max = 2000): string {
  return value.length > max ? value.slice(0, max) : value
}

export function buildInboundInsert(
  meta: WebhookMeta,
  fetched: ReceivedEmail | null,
  fetchError: string | null,
  threadId: string,
  nowIso: string,
): InboundInsert {
  const headers = fetched?.headers ?? {}
  return {
    thread_id: threadId,
    direction: "inbound",
    resend_id: meta.email_id,
    from_address: fetched?.from ?? meta.from,
    to_addresses: fetched?.to ?? meta.to,
    cc_addresses: fetched?.cc ?? meta.cc,
    bcc_addresses: fetched?.bcc ?? meta.bcc,
    reply_to_addresses: fetched?.reply_to ?? [],
    subject: (fetched?.subject ?? meta.subject).slice(0, 500),
    body_text: fetched?.text ?? null,
    body_html: fetched?.html ?? null,
    headers,
    message_id: fetched?.message_id ?? meta.message_id,
    in_reply_to: headers["in-reply-to"] ?? null,
    references_text: headers.references ?? null,
    auth_spf: fetched?.authentication?.spf ?? null,
    auth_dkim: fetched?.authentication?.dkim ?? null,
    auth_dmarc: fetched?.authentication?.dmarc ?? null,
    fetch_status: fetched ? "ok" : "failed",
    fetch_error: fetched ? null : fetchError ? excerpt(fetchError) : "Gövde çekilemedi.",
    received_at: nowIso,
  }
}
