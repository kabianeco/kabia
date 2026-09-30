/**
 * Resend Receiving API istemcisi — gelen iletinin gövdesi ve ekleri.
 *
 * Webhook (`email.received`) yalnızca üstveri taşır; gövde, başlıklar ve
 * ekler bu modülle Resend API'den çekilir (fetch tabanlı, SDK yok —
 * lib/email/send.ts emsali).
 *
 * `fetchFn` enjeksiyonu test içindir: üretimde global fetch kullanılır,
 * veritabanısız testlerde sahte verilir (test çalıştırıcısı ağı yasaklar).
 */

import "server-only"

export interface ReceivedAttachmentMeta {
  id: string
  filename: string
  content_type: string
  content_disposition: string | null
  content_id: string | null
  size: number | null
}

export interface ReceivedAuthentication {
  spf: string | null
  dkim: string | null
  dmarc: string | null
}

export interface ReceivedEmail {
  id: string
  from: string
  to: string[]
  cc: string[]
  bcc: string[]
  reply_to: string[]
  subject: string
  html: string | null
  text: string | null
  headers: Record<string, string>
  message_id: string | null
  authentication: ReceivedAuthentication | null
  attachments: ReceivedAttachmentMeta[]
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

export type InboundResult<T> = { ok: true; value: T } | { ok: false; error: string }

const RECEIVING_BASE = "https://api.resend.com/emails/receiving"

function apiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

function asStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {}
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") out[key] = entry
  }
  return out
}

function normalizeAuth(value: unknown): ReceivedAuthentication | null {
  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  const pick = (key: string): string | null =>
    typeof record[key] === "string" ? (record[key] as string) : null
  const auth = { spf: pick("spf"), dkim: pick("dkim"), dmarc: pick("dmarc") }
  if (!auth.spf && !auth.dkim && !auth.dmarc) return null
  return auth
}

/** Resend id biçimi denetimi — yol enjeksiyonuna karşı. */
export function isResendId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 200 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  )
}

export async function fetchReceivedEmail(
  emailId: string,
  opts?: { fetchFn?: Fetch },
): Promise<InboundResult<ReceivedEmail>> {
  const key = apiKey()
  if (!key) return { ok: false, error: "RESEND_API_KEY yapılandırılmamış." }
  if (!isResendId(emailId)) return { ok: false, error: "Geçersiz ileti kimliği." }

  const fetchFn: Fetch = opts?.fetchFn ?? ((url, init) => fetch(url, init))
  let response: Response
  try {
    response = await fetchFn(`${RECEIVING_BASE}/${emailId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "bağlantı hatası" }
  }
  if (!response.ok) {
    return { ok: false, error: `Alım API'si ${response.status} döndü.` }
  }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    return { ok: false, error: "Alım yanıtı çözümlenemedi." }
  }
  if (typeof data !== "object" || data === null) {
    return { ok: false, error: "Alım yanıtı boş." }
  }
  const row = data as Record<string, unknown>
  const parsed: ReceivedAttachmentMeta[] = []
  if (Array.isArray(row.attachments)) {
    for (const raw of row.attachments) {
      if (typeof raw !== "object" || raw === null) continue
      const a = raw as Record<string, unknown>
      if (typeof a.id !== "string" || typeof a.filename !== "string") continue
      parsed.push({
        id: a.id,
        filename: a.filename.slice(0, 255),
        content_type: typeof a.content_type === "string" ? a.content_type.slice(0, 200) : "application/octet-stream",
        content_disposition: typeof a.content_disposition === "string" ? a.content_disposition : null,
        content_id: typeof a.content_id === "string" ? a.content_id : null,
        size: typeof a.size === "number" && Number.isFinite(a.size) ? a.size : null,
      })
    }
  }
  return {
    ok: true,
    value: {
      id: typeof row.id === "string" ? row.id : emailId,
      from: typeof row.from === "string" ? row.from : "",
      to: asStringArray(row.to),
      cc: asStringArray(row.cc),
      bcc: asStringArray(row.bcc),
      reply_to: asStringArray(row.reply_to),
      subject: typeof row.subject === "string" ? row.subject : "",
      html: typeof row.html === "string" ? row.html : null,
      text: typeof row.text === "string" ? row.text : null,
      headers: asStringRecord(row.headers),
      message_id: typeof row.message_id === "string" ? row.message_id : null,
      authentication: normalizeAuth(row.authentication),
      attachments: parsed,
    },
  }
}

export interface AttachmentDownload {
  download_url: string
  expires_at: string
}

export async function fetchAttachmentDownload(
  emailId: string,
  attachmentId: string,
  opts?: { fetchFn?: Fetch },
): Promise<InboundResult<AttachmentDownload>> {
  const key = apiKey()
  if (!key) return { ok: false, error: "RESEND_API_KEY yapılandırılmamış." }
  if (!isResendId(emailId) || !isResendId(attachmentId)) {
    return { ok: false, error: "Geçersiz kimlik." }
  }
  const fetchFn: Fetch = opts?.fetchFn ?? ((url, init) => fetch(url, init))
  let response: Response
  try {
    response = await fetchFn(`${RECEIVING_BASE}/${emailId}/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "bağlantı hatası" }
  }
  if (!response.ok) return { ok: false, error: `Ek API'si ${response.status} döndü.` }
  let data: unknown
  try {
    data = await response.json()
  } catch {
    return { ok: false, error: "Ek yanıtı çözümlenemedi." }
  }
  const row = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>
  const nested = (typeof row.data === "object" && row.data !== null ? row.data : row) as Record<string, unknown>
  const url = typeof nested.download_url === "string" ? nested.download_url : typeof row.download_url === "string" ? row.download_url : null
  if (!url || !/^https:\/\//.test(url)) return { ok: false, error: "İndirme adresi alınamadı." }
  const expires = typeof nested.expires_at === "string" ? nested.expires_at : ""
  return { ok: true, value: { download_url: url, expires_at: expires } }
}

export async function downloadBytes(
  url: string,
  opts?: { fetchFn?: Fetch; maxBytes?: number },
): Promise<InboundResult<Buffer>> {
  if (!/^https:\/\//.test(url)) return { ok: false, error: "Geçersiz indirme adresi." }
  const fetchFn: Fetch = opts?.fetchFn ?? ((u, init) => fetch(u, init))
  const maxBytes = opts?.maxBytes ?? 15 * 1024 * 1024
  let response: Response
  try {
    response = await fetchFn(url)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "bağlantı hatası" }
  }
  if (!response.ok) return { ok: false, error: `Ek indirilemedi (${response.status}).` }
  let buffer: Buffer
  try {
    buffer = Buffer.from(await response.arrayBuffer())
  } catch {
    return { ok: false, error: "Ek okunamadı." }
  }
  if (buffer.length > maxBytes) return { ok: false, error: "Ek boyut sınırını aşıyor." }
  return { ok: true, value: buffer }
}
