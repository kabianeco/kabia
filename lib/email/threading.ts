/**
 * Konuşma (thread) eşleştirme — saf fonksiyonlar, DB erişimi yok.
 *
 * Gelen iletinin hangi konuşmaya ait olduğu şu sırayla bulunur:
 *   1. `In-Reply-To` saklanan bir Message-ID ile eşleşiyorsa onun konuşması,
 *   2. yoksa `References` içindeki kimlikler sırayla taranır, ilk eşleşme,
 *   3. yoksa konu normalize edilip (`Re:`/`Fwd:` öneki temizlenir) son
 *      iletiler arasında aynı normalize konulu konuşma aranır,
 *   4. hiçbiri yoksa yeni konuşma açılır.
 *
 * İlk üç adım burada; 3. ve 4. adımın DB okuması çağırandadır.
 */

/** Yinelenen yanıt/iletme önekleri temizlenir: Re:, Fwd:, Ynt: … */
const SUBJECT_PREFIX_RE = /^(re|fwd?|ynt|yanıt|ilet)(\[\d+\])?\s*:\s*/i

export function normalizeSubject(subject: string): string {
  let out = subject.replace(/\s+/g, " ").trim()
  for (let i = 0; i < 10; i++) {
    const next = out.replace(SUBJECT_PREFIX_RE, "")
    if (next === out) break
    out = next.trim()
  }
  return out.slice(0, 200).toLowerCase()
}

/** Yanıt konusu: zaten önekliyse aynen, değilse `Re:` eklenir. */
export function replySubject(subject: string): string {
  const trimmed = subject.trim()
  if (trimmed === "") return "Re:"
  if (/^(re|ynt|yanıt)(\[\d+\])?\s*:/i.test(trimmed)) return trimmed
  return `Re: ${trimmed}`
}

/** References başlığını kimlik listesine çevirir. */
export function parseReferences(references: string | null | undefined): string[] {
  if (!references) return []
  return references
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token.length <= 1000)
    .slice(0, 100)
}

export interface StoredIdentity {
  threadId: string
  messageId: string | null
}

/**
 * Zincir üzerinden konuşma bulur. `candidates` aynı mağazadaki
 * (thread_id, message_id) çiftleridir.
 */
export function findThreadByChain(
  candidates: StoredIdentity[],
  input: { inReplyTo: string | null | undefined; references: string | null | undefined },
): string | null {
  const byMessageId = new Map<string, string>()
  for (const candidate of candidates) {
    if (candidate.messageId && !byMessageId.has(candidate.messageId)) {
      byMessageId.set(candidate.messageId, candidate.threadId)
    }
  }

  const inReplyTo = input.inReplyTo?.trim()
  if (inReplyTo && byMessageId.has(inReplyTo)) {
    return byMessageId.get(inReplyTo) ?? null
  }

  for (const token of parseReferences(input.references)) {
    const hit = byMessageId.get(token)
    if (hit) return hit
  }

  return null
}

/**
 * Giden yanıtta kullanılacak başlıklar: In-Reply-To hedef iletinin
 * Message-ID'si, References önceki zincir + hedef.
 */
export function buildReplyHeaders(input: {
  targetMessageId: string | null | undefined
  targetReferences: string | null | undefined
}): { inReplyTo: string | null; references: string | null } {
  const target = input.targetMessageId?.trim() || null
  if (!target) return { inReplyTo: null, references: null }
  const chain = [...parseReferences(input.targetReferences), target]
  const unique = [...new Set(chain)].slice(-50)
  return { inReplyTo: target, references: unique.join(" ") }
}
