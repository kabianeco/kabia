import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit"
import { pickSvixHeaders, verifySvixWebhook } from "@/lib/email/svix"
import { fetchReceivedEmail, isResendId } from "@/lib/email/inbound"
import { buildInboundInsert } from "@/lib/email/inbound-row"
import { storeInboundAttachments } from "@/lib/email/attachment-store"
import { findThreadByChain, normalizeSubject, parseReferences } from "@/lib/email/threading"

/**
 * Resend alım (receiving) webhook'u: `email.received`.
 *
 * Güvenlik sınırları:
 *   - İmza Svix şemasıyla doğrulanır (ham gövde + toleranslı zaman damgası);
 *     sır yoksa ya da doğrulama başarısızsa 400 — sebep sızdırılmaz.
 *   - Gövde üst sınırı 256 KB (webhook yalnızca üstveri taşır; fazlası 413).
 *   - IP bazlı hız sınırı; aşımsa 429 (Resend yeniden dener).
 *   - Burası `/api` altındadır: proxy'nin `/admin` yönlendirmesi buraya
 *     dokunmaz; yanıta eklenen CSP başlığı makine istemciyi etkilemez.
 *
 * Dayanıklılık:
 *   - `resend_id` kısmi unique index'i redelivery'yi yutar (idempotent).
 *   - Gövde çekilemezse ileti `fetch_status='failed'` ile saklanır;
 *     panelden "yeniden dene" ile kurtarılır. Sessiz düşme yok.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 256 * 1024

interface WebhookEvent {
  type?: unknown
  data?: {
    email_id?: unknown
    from?: unknown
    to?: unknown
    cc?: unknown
    bcc?: unknown
    message_id?: unknown
    subject?: unknown
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
}

/** Zincirdeki kimliklerle eşleşen konuşmayı bulur, yoksa konuya göre arar. */
async function resolveThread(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { inReplyTo: string | null; references: string | null; messageId: string | null; subject: string },
): Promise<string> {
  const tokens = [
    ...(input.inReplyTo ? [input.inReplyTo] : []),
    ...parseReferences(input.references),
    ...(input.messageId ? [input.messageId] : []),
  ].slice(0, 50)

  if (tokens.length > 0) {
    const { data } = await supabase
      .from("emails")
      .select("thread_id, message_id")
      .in("message_id", tokens)
      .limit(50)
    const rows = (data ?? []) as { thread_id: string; message_id: string | null }[]
    const hit = findThreadByChain(rows.map((r) => ({ threadId: r.thread_id, messageId: r.message_id })), {
      inReplyTo: input.inReplyTo,
      references: input.references,
    })
    if (hit) return hit
  }

  // Konu eşleşmesi: son 90 günün iletilerinde normalize konu aranır.
  const normalized = normalizeSubject(input.subject)
  if (normalized !== "") {
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
    const { data } = await supabase
      .from("emails")
      .select("thread_id, subject")
      .gte("created_at", since)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(200)
    for (const row of ((data ?? []) as { thread_id: string; subject: string }[])) {
      if (normalizeSubject(row.subject ?? "") === normalized) return row.thread_id
    }
  }

  const { data, error } = await supabase
    .from("email_threads")
    .insert({ subject: input.subject.slice(0, 200) })
    .select("id")
    .single()
  if (error || !data) throw new Error("Konuşma açılamadı.")
  return (data as { id: string }).id
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Yük büyük." }, { status: 413 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: "Gövde okunamadı." }, { status: 400 })
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Yük büyük." }, { status: 413 })
  }

  // Hız sınırı: imzasız trafiğe karşı baraj; Resend 429/5xx'te yeniden dener.
  try {
    const rl = await checkRateLimit("inbound_webhook", getClientIp(request.headers), null)
    if (!rl.allowed) {
      return NextResponse.json({ error: "Yoğunluk." }, { status: 429 })
    }
  } catch (error) {
    console.error("[webhook] hız sınırlayıcı hatası:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Geçici hata." }, { status: 503 })
  }

  const verified = verifySvixWebhook({
    secret: process.env.RESEND_INBOUND_WEBHOOK_SECRET,
    headers: pickSvixHeaders((name) => request.headers.get(name)),
    rawBody,
    nowMs: Date.now(),
  })
  if (!verified.ok) {
    return NextResponse.json({ error: "Geçersiz webhook." }, { status: 400 })
  }

  let event: WebhookEvent
  try {
    event = JSON.parse(rawBody) as WebhookEvent
  } catch {
    return NextResponse.json({ error: "Geçersiz webhook." }, { status: 400 })
  }
  if (event.type !== "email.received" || typeof event.data !== "object" || !event.data) {
    return NextResponse.json({})
  }

  const emailId = event.data.email_id
  if (!isResendId(emailId)) return NextResponse.json({ error: "Geçersiz webhook." }, { status: 400 })

  let supabase: ReturnType<typeof createSupabaseAdminClient>
  try {
    supabase = createSupabaseAdminClient()
  } catch (error) {
    console.error("[webhook] service-role eksik:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Geçici hata." }, { status: 503 })
  }

  // Idempotency: redelivery aynı resend_id ile ikinci satır açamaz.
  const { data: existing } = await supabase
    .from("emails")
    .select("id")
    .eq("resend_id", emailId)
    .maybeSingle()
  if (existing) return NextResponse.json({ deduped: true })

  const fetched = await fetchReceivedEmail(emailId)

  // Webhook üstverisi: gövde çekilemese bile kaybolmayacak asgari kayıt.
  const meta = event.data
  const fallback = {
    from: typeof meta.from === "string" ? meta.from : "",
    to: asStringArray(meta.to),
    cc: asStringArray(meta.cc),
    bcc: asStringArray(meta.bcc),
    subject: typeof meta.subject === "string" ? meta.subject : "",
    messageId: typeof meta.message_id === "string" ? meta.message_id : null,
  }

  try {
    const threadId = await resolveThread(supabase, {
      inReplyTo: fetched.ok ? (fetched.value.headers["in-reply-to"] ?? null) : null,
      references: fetched.ok ? (fetched.value.headers.references ?? null) : null,
      messageId: fetched.ok ? fetched.value.message_id : fallback.messageId,
      subject: fetched.ok ? fetched.value.subject : fallback.subject,
    })

    const { data: inserted, error: insertError } = await supabase
      .from("emails")
      .insert(
        buildInboundInsert(
          {
            email_id: emailId,
            from: fallback.from,
            to: fallback.to,
            cc: fallback.cc,
            bcc: fallback.bcc,
            subject: fallback.subject,
            message_id: fallback.messageId,
          },
          fetched.ok ? fetched.value : null,
          fetched.ok ? null : fetched.error,
          threadId,
          new Date().toISOString(),
        ),
      )
      .select("id")
      .single()

    // Yarış: aynı anda iki teslimat — unique ihlali idempotent yanıttır.
    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json({ deduped: true })
      }
      throw insertError
    }

    const emailRowId = (inserted as { id: string }).id
    if (fetched.ok) {
      await storeInboundAttachments(supabase, emailRowId, fetched.value)
    }
    await supabase
      .from("email_threads")
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", threadId)

    return NextResponse.json({ stored: emailRowId })
  } catch (error) {
    console.error("[webhook] ileti saklanamadı:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Geçici hata." }, { status: 503 })
  }
}
