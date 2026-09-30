/**
 * Yanıt / yeni ileti kurma — saf fonksiyonlar.
 *
 * Kurallar:
 *   - Giden her ileti marka şablonuyla (`buildEmail`) sarılır ve düz metin
 *     sürümü her zaman üretilir.
 *   - Yönetici girdisi HTML'e değmeden önce kaçırılır (escapeHtml); satır
 *     sonları `<br>` olur.
 *   - Yanıtta orijinal alıntılanır, konu `Re:` öneki alır (threading.ts),
 *     In-Reply-To / References zinciri kurulur.
 */

import { buildEmail, escapeHtml, paragraph } from "./layout.ts"
import { buildReplyHeaders, replySubject } from "./threading.ts"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmailAddress(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim())
}

/** Düz metni HTML paragrafına çevirir (önce kaçır, sonra satır kır). */
export function textToHtmlBody(text: string): string {
  return paragraph(escapeHtml(text).replace(/\r?\n/g, "<br>"))
}

export function quoteOriginal(input: { from: string; date: string; text: string }): string {
  const head = `${input.date} tarihinde ${input.from} yazdı:`
  const quoted = input.text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n")
  return `${head}\n${quoted}`
}

export interface ReplyBuildInput {
  /** Yanıtlanan iletinin görünen konusu. */
  subject: string
  /** Yönetici yanıtı (düz metin). */
  body: string
  /** Alıntılanacak orijinal (düz metin yoksa boş geçilir). */
  original: { from: string; date: string; text: string } | null
  targetMessageId: string | null | undefined
  targetReferences: string | null | undefined
}

export interface BuiltReply {
  subject: string
  html: string
  text: string
  inReplyTo: string | null
  references: string | null
}

export function buildReply(input: ReplyBuildInput): BuiltReply {
  const subject = replySubject(input.subject)
  const { inReplyTo, references } = buildReplyHeaders({
    targetMessageId: input.targetMessageId,
    targetReferences: input.targetReferences,
  })

  const parts = [input.body.trim()]
  if (input.original && input.original.text.trim() !== "") {
    parts.push("", quoteOriginal(input.original))
  }
  const text = parts.join("\n")

  const html = buildEmail({
    subject,
    preheader: input.body.trim().slice(0, 120),
    heading: escapeHtml(subject),
    bodyHtml: textToHtmlBody(text),
    cta: null,
    footerReason: "Bu ileti Kabia yönetim panelinden yanıt olarak gönderildi.",
  })

  return { subject, html, text, inReplyTo, references }
}

export interface ComposeBuildInput {
  subject: string
  body: string
}

export interface BuiltCompose {
  subject: string
  html: string
  text: string
}

export function buildCompose(input: ComposeBuildInput): BuiltCompose {
  const subject = input.subject.trim()
  const text = input.body.trim()
  const html = buildEmail({
    subject,
    preheader: text.slice(0, 120),
    heading: escapeHtml(subject),
    bodyHtml: textToHtmlBody(text),
    cta: null,
    footerReason: "Bu ileti Kabia yönetim panelinden gönderildi.",
  })
  return { subject, html, text }
}
