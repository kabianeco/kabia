"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { fieldErrorsFrom, uuid } from "@/lib/admin/schemas"
import { logAdminAction } from "@/lib/admin/audit"
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit"
import { sendEmail } from "@/lib/email/send"
import { fetchReceivedEmail } from "@/lib/email/inbound"
import { storeInboundAttachments } from "@/lib/email/attachment-store"
import { buildCompose, buildReply, isEmailAddress } from "@/lib/email/compose"
import { bareAddress, type EmailRow } from "@/lib/email/rows"

/**
 * E-posta kutusu yazma işlemleri (`manageInbox` yetkisi).
 *
 * Okuma RLS + sayfa guard'ıyla; buradaki her yazma adminContext'ten geçer.
 * Gönderim ayrıca hız sınırlıdır (admin başına) ve denetim kaydına yazılır —
 * marka adına spam gönderme yetkisi sahipsiz bırakılmaz.
 */

const triageSchema = z.object({
  emailId: uuid,
  op: z.enum(["okundu", "okunmadi", "arsiv", "arsivden_cikar", "sil"], {
    message: "Geçersiz işlem.",
  }),
})

export async function setEmailTriage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageInbox")

    const parsed = triageSchema.safeParse({
      emailId: formData.get("emailId"),
      op: formData.get("op"),
    })
    if (!parsed.success) {
      return {
        ok: false,
        message: "İşlem uygulanamadı.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      }
    }
    const { emailId, op } = parsed.data

    const { data: existing, error: readError } = await supabase
      .from("emails")
      .select("read_at, archived_at, deleted_at")
      .eq("id", emailId)
      .maybeSingle()
    if (readError) return toActionState(readError, "inbox:read")
    if (!existing) return { ok: false, message: "İleti bulunamadı." }
    const row = existing as { read_at: string | null; archived_at: string | null; deleted_at: string | null }
    const now = new Date().toISOString()

    const patch: Record<string, string | boolean | null> =
      op === "okundu"
        ? { is_read: true, read_at: row.read_at ?? now }
        : op === "okunmadi"
          ? { is_read: false, read_at: null }
          : op === "arsiv"
            ? { is_archived: true, archived_at: row.archived_at ?? now }
            : op === "arsivden_cikar"
              ? { is_archived: false, archived_at: null }
              : { is_deleted: true, deleted_at: row.deleted_at ?? now }

    const { error } = await supabase.from("emails").update(patch).eq("id", emailId)
    if (error) return toActionState(error, "inbox:triage")

    revalidatePath("/admin/eposta")
    return { ok: true }
  } catch (error) {
    return toActionState(error, "inbox:triage")
  }
}

/** Gövde çekmesi başarısız (`fetch_status='failed'`) iletileri kurtarır. */
export async function retryEmailFetch(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageInbox")

    const parsed = z.object({ emailId: uuid }).safeParse({ emailId: formData.get("emailId") })
    if (!parsed.success) {
      return {
        ok: false,
        message: "İşlem uygulanamadı.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      }
    }
    const { emailId } = parsed.data

    const { data: existing, error: readError } = await supabase
      .from("emails")
      .select("id, resend_id, fetch_status")
      .eq("id", emailId)
      .maybeSingle()
    if (readError) return toActionState(readError, "inbox:read")
    const row = existing as { id: string; resend_id: string | null; fetch_status: string } | null
    if (!row) return { ok: false, message: "İleti bulunamadı." }
    if (row.fetch_status !== "failed" || !row.resend_id) {
      return { ok: false, message: "Bu iletinin yeniden çekilecek bir hatası yok." }
    }

    const fetched = await fetchReceivedEmail(row.resend_id)
    if (!fetched.ok) {
      await supabase
        .from("emails")
        .update({ fetch_error: fetched.error.slice(0, 2000) })
        .eq("id", emailId)
      return { ok: false, message: "Çekme yine başarısız oldu; hata güncellendi." }
    }

    const email = fetched.value
    const { error: updateError } = await supabase
      .from("emails")
      .update({
        from_address: email.from,
        to_addresses: email.to,
        cc_addresses: email.cc,
        bcc_addresses: email.bcc,
        reply_to_addresses: email.reply_to,
        subject: email.subject.slice(0, 500),
        body_text: email.text,
        body_html: email.html,
        headers: email.headers,
        message_id: email.message_id,
        in_reply_to: email.headers["in-reply-to"] ?? null,
        references_text: email.headers.references ?? null,
        auth_spf: email.authentication?.spf ?? null,
        auth_dkim: email.authentication?.dkim ?? null,
        auth_dmarc: email.authentication?.dmarc ?? null,
        fetch_status: "ok",
        fetch_error: null,
      })
      .eq("id", emailId)
    if (updateError) return toActionState(updateError, "inbox:retry")

    await storeInboundAttachments(supabase, emailId, email)

    revalidatePath("/admin/eposta")
    return { ok: true }
  } catch (error) {
    return toActionState(error, "inbox:retry")
  }
}

const ccList = z
  .string()
  .trim()
  .max(1000, "Kopya alıcıları çok uzun.")
  .refine(
    (value) =>
      value === "" || value.split(",").every((part) => isEmailAddress(part.trim())),
    "Kopya adreslerinden biri geçerli görünmüyor.",
  )
  .transform((value) =>
    value === "" ? [] : value.split(",").map((part) => part.trim().toLowerCase()),
  )

const sendSchema = z.object({
  to: z
    .string()
    .trim()
    .toLowerCase()
    .min(5, "Alıcı adresini yazar mısınız?")
    .max(254, "Alıcı adresi en fazla 254 karakter olabilir.")
    .refine(isEmailAddress, "Bu alıcı adresi geçerli görünmüyor."),
  cc: ccList,
  subject: z
    .string()
    .trim()
    .min(1, "Konuyu yazar mısınız?")
    .max(200, "Konu en fazla 200 karakter olabilir."),
  body: z
    .string()
    .trim()
    .min(1, "İleti gövdesini yazar mısınız?")
    .max(20000, "İleti en fazla 20.000 karakter olabilir."),
  replyToEmailId: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || uuid.safeParse(value).success, "Geçersiz yanıt hedefi."),
  replyAll: z.literal("1").optional(),
})

/** Yanıtla-tümü alıcıları: orijinal gönderen + cc, kendimiz hariç. */
function replyAllRecipients(
  original: EmailRow,
  ownAddresses: string[],
): { to: string; cc: string[] } {
  const own = new Set(ownAddresses.map((a) => a.toLowerCase()))
  const to = original.from_address.toLowerCase()
  const cc = [...original.cc_addresses, ...original.to_addresses]
    .map((a) => a.toLowerCase())
    .filter((address, index, all) => address !== to && !own.has(address) && all.indexOf(address) === index)
    .slice(0, 20)
  return { to, cc }
}

export async function sendAdminEmail(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageInbox")

    const parsed = sendSchema.safeParse({
      to: formData.get("to") ?? "",
      cc: formData.get("cc") ?? "",
      subject: formData.get("subject") ?? "",
      body: formData.get("body") ?? "",
      replyToEmailId: (formData.get("replyToEmailId") as string) || undefined,
      replyAll: (formData.get("replyAll") as string) || undefined,
    })
    if (!parsed.success) {
      return {
        ok: false,
        message: "Formda eksik ya da hatalı alanlar var.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      }
    }
    const input = parsed.data

    // Marka adına gönderim: yönetici başına hız sınırı, aşımda genel ileti.
    const h = await headers()
    const rl = await checkRateLimit("admin_email_send", getClientIp(h), session.userId)
    if (!rl.allowed) {
      console.error("[eposta] admin_email_send limiti aşıldı.")
      return { ok: false, message: "Şu anda gönderilemiyor. Lütfen bir süre sonra tekrar deneyin." }
    }

    let to = input.to
    let cc = input.cc
    let threadId: string | null = null
    let built: { subject: string; html: string; text: string; inReplyTo: string | null; references: string | null }

    if (input.replyToEmailId) {
      const { data: originalData, error: originalError } = await supabase
        .from("emails")
        .select("*")
        .eq("id", input.replyToEmailId)
        .maybeSingle()
      if (originalError) return toActionState(originalError, "inbox:read")
      const original = originalData as EmailRow | null
      if (!original) return { ok: false, message: "Yanıtlanan ileti bulunamadı." }

      const fromValue = process.env.RESEND_FROM ?? ""
      const own = [bareAddress(fromValue), ...original.to_addresses].filter(
        (a): a is string => Boolean(a),
      )
      if (input.replyAll === "1") {
        const all = replyAllRecipients(original, own)
        to = all.to
        cc = [...all.cc, ...cc].slice(0, 20)
      } else {
        to = original.from_address.toLowerCase()
      }
      if (!isEmailAddress(to)) {
        return { ok: false, message: "Orijinal gönderene yanıt verilemiyor; adresi geçersiz." }
      }

      built = buildReply({
        subject: input.subject,
        body: input.body,
        original: original.body_text
          ? {
              from: original.from_address,
              date: original.received_at ?? original.created_at,
              text: original.body_text.slice(0, 5000),
            }
          : null,
        targetMessageId: original.message_id,
        targetReferences: original.references_text,
      })
      threadId = original.thread_id
    } else {
      const composed = buildCompose({ subject: input.subject, body: input.body })
      built = { ...composed, inReplyTo: null, references: null }
    }

    const headersOut: Record<string, string> = {}
    if (built.inReplyTo) headersOut["In-Reply-To"] = built.inReplyTo
    if (built.references) headersOut.References = built.references

    const sent = await sendEmail({
      to,
      cc,
      subject: built.subject,
      html: built.html,
      text: built.text,
      headers: headersOut,
      replyTo: bareAddress(process.env.RESEND_FROM ?? "") ?? undefined,
    })
    if (!sent.ok) {
      return { ok: false, message: "E-posta gönderilemedi. Lütfen tekrar deneyin." }
    }

    if (!threadId) {
      const { data: thread, error: threadError } = await supabase
        .from("email_threads")
        .insert({ subject: built.subject.slice(0, 200) })
        .select("id")
        .single()
      if (threadError || !thread) return toActionState(threadError, "inbox:thread")
      threadId = (thread as { id: string }).id
    }

    const fromValue = process.env.RESEND_FROM?.trim() || "onboarding@resend.dev"
    const { data: stored, error: storeError } = await supabase
      .from("emails")
      .insert({
        thread_id: threadId,
        direction: "outbound",
        resend_id: sent.id || null,
        from_address: bareAddress(fromValue) ?? fromValue,
        from_name: null,
        to_addresses: [to],
        cc_addresses: cc,
        subject: built.subject.slice(0, 500),
        body_text: built.text,
        body_html: built.html,
        headers: headersOut,
        message_id: null,
        in_reply_to: built.inReplyTo,
        references_text: built.references,
        is_read: true,
        read_at: new Date().toISOString(),
        sent_by: session.userId,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (storeError || !stored) return toActionState(storeError, "inbox:store")

    const emailId = (stored as { id: string }).id
    await supabase
      .from("email_threads")
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", threadId)

    const audited = await logAdminAction(supabase, {
      action: "email.send",
      entityType: "email",
      entityId: emailId,
      metadata: { to, subject: built.subject, thread_id: threadId },
    })

    revalidatePath("/admin/eposta")
    if (!audited) {
      // Gönderim tamam; denetim kaydı düşmedi — uyarıyla birlikte yönlendir.
      redirect(`/admin/eposta/${threadId}?uyari=denetim`)
    }
    redirect(`/admin/eposta/${threadId}`)
  } catch (error) {
    // redirect() bir throw'dur; eylem hatası değildir — aynen yukarı iletilir.
    if (error instanceof Error && "digest" in error && typeof (error as { digest?: unknown }).digest === "string" && ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT"))) throw error
    return toActionState(error, "inbox:send")
  }
}
