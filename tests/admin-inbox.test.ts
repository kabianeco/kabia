import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { decodeWebhookSecret, verifySvixWebhook } from "../lib/email/svix.ts"
import {
  buildReplyHeaders,
  findThreadByChain,
  normalizeSubject,
  parseReferences,
  replySubject,
} from "../lib/email/threading.ts"
import { countRemoteImages, sanitizeInboundHtml } from "../lib/email/sanitize.ts"
import {
  buildCompose,
  buildReply,
  isEmailAddress,
  quoteOriginal,
  textToHtmlBody,
} from "../lib/email/compose.ts"
import {
  downloadBytes,
  fetchAttachmentDownload,
  fetchReceivedEmail,
  isResendId,
  type Fetch,
  type ReceivedEmail,
} from "../lib/email/inbound.ts"
import { buildInboundInsert, type WebhookMeta } from "../lib/email/inbound-row.ts"
import {
  authResultLabel,
  bareAddress,
  counterpartOf,
  isAuthFailed,
  previewOf,
} from "../lib/email/rows.ts"
import {
  combineRateLimitResults,
  limiterErrorResult,
  RATE_LIMIT_BUCKET_IDS,
} from "../lib/auth/rate-limit.ts"
import { can, PERMISSIONS } from "../lib/admin/roles.ts"
import { navForRole } from "../lib/admin/nav.ts"
import { AUDIT_ACTION_LABELS } from "../lib/admin/audit.ts"

// Admin e-posta kutusu — veritabanısız sözleşme testleri: imza doğrulama,
// idempotency anahtarı, çekme-hatası kaydı, threadleme, HTML temizliği,
// uzak-görsel engeli, yetki, gönderim hız sınırı, yanıt başlıkları.

// ---------------------------------------------------------------------------
// Svix imza doğrulama
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = Buffer.from("test-gizli-anahtar-1234567890").toString("base64")
const RAW_BODY = JSON.stringify({
  type: "email.received",
  data: { email_id: "mail_123", from: "musteri@ornek.com", to: ["info@kabiaekolojik.com"] },
})

function sign(secret: string, id: string, ts: number, body: string): string {
  const key = decodeWebhookSecret(secret)
  assert.ok(key)
  return createHmac("sha256", key).update(`${id}.${ts}.${body}`, "utf8").digest("base64")
}

describe("svix dogrulama", () => {
  const id = "msg_p5jXN8AQM9LWM0D4loKWxJek"
  const nowMs = 1_700_000_000_000
  const ts = Math.floor(nowMs / 1000)

  it("gecerli imzayi kabul eder", () => {
    const result = verifySvixWebhook({
      secret: `whsec_${WEBHOOK_SECRET}`,
      headers: { id, timestamp: String(ts), signature: `v1,${sign(`whsec_${WEBHOOK_SECRET}`, id, ts, RAW_BODY)}` },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.equal(result.ok, true)
  })

  it("degistirilmis govdeyi reddeder", () => {
    const result = verifySvixWebhook({
      secret: WEBHOOK_SECRET,
      headers: { id, timestamp: String(ts), signature: `v1,${sign(WEBHOOK_SECRET, id, ts, RAW_BODY)}` },
      rawBody: `${RAW_BODY} `,
      nowMs,
    })
    assert.deepEqual(result, { ok: false, reason: "invalid" })
  })

  it("bayat zaman damgasini reddeder (replay)", () => {
    const old = ts - 600
    const result = verifySvixWebhook({
      secret: WEBHOOK_SECRET,
      headers: { id, timestamp: String(old), signature: `v1,${sign(WEBHOOK_SECRET, id, old, RAW_BODY)}` },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.deepEqual(result, { ok: false, reason: "stale" })
  })

  it("gelecekteki zaman damgasini da reddeder", () => {
    const future = ts + 601
    const result = verifySvixWebhook({
      secret: WEBHOOK_SECRET,
      headers: { id, timestamp: String(future), signature: `v1,${sign(WEBHOOK_SECRET, id, future, RAW_BODY)}` },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.deepEqual(result, { ok: false, reason: "stale" })
  })

  it("eksik basligi reddeder", () => {
    const result = verifySvixWebhook({
      secret: WEBHOOK_SECRET,
      headers: { id, timestamp: String(ts), signature: null },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.deepEqual(result, { ok: false, reason: "missing_headers" })
  })

  it("sayisal olmayan zaman damgasini reddeder", () => {
    const result = verifySvixWebhook({
      secret: WEBHOOK_SECRET,
      headers: { id, timestamp: "dun", signature: "v1,abc" },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.deepEqual(result, { ok: false, reason: "missing_headers" })
  })

  it("sir yoksa reddeder", () => {
    const result = verifySvixWebhook({
      secret: "",
      headers: { id, timestamp: String(ts), signature: "v1,abc" },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.deepEqual(result, { ok: false, reason: "missing_secret" })
  })

  it("yanlis sirla reddeder", () => {
    const other = Buffer.from("baska-sir-00000000000000000000").toString("base64")
    const result = verifySvixWebhook({
      secret: other,
      headers: { id, timestamp: String(ts), signature: `v1,${sign(WEBHOOK_SECRET, id, ts, RAW_BODY)}` },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.deepEqual(result, { ok: false, reason: "invalid" })
  })

  it("coklu imzadan gecerli olani bulur", () => {
    const result = verifySvixWebhook({
      secret: WEBHOOK_SECRET,
      headers: {
        id,
        timestamp: String(ts),
        signature: `v1,yanlisimza v1,${sign(WEBHOOK_SECRET, id, ts, RAW_BODY)}`,
      },
      rawBody: RAW_BODY,
      nowMs,
    })
    assert.equal(result.ok, true)
  })
})

// ---------------------------------------------------------------------------
// Threadleme
// ---------------------------------------------------------------------------

describe("threadleme", () => {
  it("konu one klerini temizler", () => {
    assert.equal(normalizeSubject("Re: Fwd: Merhaba Dünya"), "merhaba dünya")
    assert.equal(normalizeSubject("RE[2]: Sipariş"), "sipariş")
    assert.equal(normalizeSubject("  Konusuz  "), "konusuz")
  })

  it("yanit konusu yigmaz", () => {
    assert.equal(replySubject("Kargo nerede?"), "Re: Kargo nerede?")
    assert.equal(replySubject("Re: Kargo nerede?"), "Re: Kargo nerede?")
    assert.equal(replySubject(""), "Re:")
  })

  it("references listesini cozer ve sinirlar", () => {
    assert.deepEqual(parseReferences("<a@x> <b@x>"), ["<a@x>", "<b@x>"])
    assert.deepEqual(parseReferences(null), [])
    assert.equal(parseReferences("<a> ".repeat(200)).length, 100)
  })

  it("in-reply-to ile konusmari bulur", () => {
    const thread = findThreadByChain(
      [
        { threadId: "t1", messageId: "<bir@x>" },
        { threadId: "t2", messageId: "<iki@x>" },
      ],
      { inReplyTo: "<iki@x>", references: null },
    )
    assert.equal(thread, "t2")
  })

  it("references zincirinden bulur", () => {
    const thread = findThreadByChain(
      [{ threadId: "t1", messageId: "<bir@x>" }],
      { inReplyTo: "<yok@x>", references: "<sifir@x> <bir@x>" },
    )
    assert.equal(thread, "t1")
  })

  it("eslesme yoksa null doner", () => {
    assert.equal(
      findThreadByChain([{ threadId: "t1", messageId: "<bir@x>" }], {
        inReplyTo: "<yok@x>",
        references: "<baska@x>",
      }),
      null,
    )
  })

  it("yanit basliklarini kurar ve tekrarlari eler", () => {
    const headers = buildReplyHeaders({
      targetMessageId: "<uc@x>",
      targetReferences: "<bir@x> <iki@x> <iki@x>",
    })
    assert.equal(headers.inReplyTo, "<uc@x>")
    assert.equal(headers.references, "<bir@x> <iki@x> <uc@x>")
  })

  it("hedef yoksa baslik uretmez", () => {
    assert.deepEqual(buildReplyHeaders({ targetMessageId: null, targetReferences: null }), {
      inReplyTo: null,
      references: null,
    })
  })
})

// ---------------------------------------------------------------------------
// HTML temizligi — dusmanca girdiler
// ---------------------------------------------------------------------------

describe("html temizligi", () => {
  it("script etiketini dusurur, metni korur", () => {
    const { html } = sanitizeInboundHtml({ html: `<script>alert(1)</script><p>Selam</p>`, allowRemoteImages: false })
    assert.ok(!html.includes("<script"))
    assert.ok(html.includes("Selam"))
  })

  it("olay isleyicileri temizler", () => {
    const { html } = sanitizeInboundHtml({
      html: `<p onclick="alert(1)" onmouseover="alert(2)">tıkla</p><img src="x" onerror="alert(3)" />`,
      allowRemoteImages: false,
    })
    assert.ok(!html.includes("onerror") && !html.includes("onclick") && !html.includes("onmouseover"))
  })

  it("javascript: baglantisini etkisizlestirir", () => {
    const { html } = sanitizeInboundHtml({
      html: `<a href="javascript:alert(1)">tıkla</a>`,
      allowRemoteImages: false,
    })
    assert.ok(!html.includes("javascript:"))
    assert.ok(html.includes("tıkla"))
  })

  it("svg yuku, stil, meta refresh ve cerceveyi dusurur", () => {
    const { html } = sanitizeInboundHtml({
      html: `<svg onload="alert(1)"><circle/></svg><style>p{color:expression(alert(1))}</style><meta http-equiv="refresh" content="0;url=https://kot.u/x"><iframe src="https://kot.u"></iframe><object data="x"></object><form><input></form><p style="background:url(https://kot.u/t.png)">Merhaba</p>`,
      allowRemoteImages: false,
    })
    assert.ok(!html.includes("<svg") && !html.includes("<style") && !html.includes("<meta"))
    assert.ok(!html.includes("<iframe") && !html.includes("<object") && !html.includes("<form"))
    assert.ok(!html.includes("style=") && !html.includes("kot.u"))
    assert.ok(html.includes("Merhaba"))
  })

  it("baglantilari yeni sekme + guvenli rel ile acar", () => {
    const { html } = sanitizeInboundHtml({
      html: `<a href="https://ornek.com/s">site</a> <a href="mailto:a@b.com">yaz</a>`,
      allowRemoteImages: false,
    })
    assert.ok(html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'))
    assert.ok(html.includes("https://ornek.com/s") && html.includes("mailto:a@b.com"))
  })

  it("uzak gorseli varsayilan engeller, izinle gosterir", () => {
    const input = `<p>Bakın</p><img src="https://iz.suren/t.png" alt="t" />`
    const blocked = sanitizeInboundHtml({ html: input, allowRemoteImages: false })
    assert.ok(!blocked.html.includes("iz.suren"))
    assert.equal(blocked.blockedImages, 1)
    const allowed = sanitizeInboundHtml({ html: input, allowRemoteImages: true })
    assert.ok(allowed.html.includes("iz.suren"))
    assert.equal(allowed.blockedImages, 0)
  })

  it("gomulu data gorselini korur (iz surulemez)", () => {
    const input = `<img src="data:image/png;base64,iVBORw0KGgo=" alt="t" />`
    const { html } = sanitizeInboundHtml({ html: input, allowRemoteImages: false })
    assert.ok(html.includes("data:image/png"))
  })

  it("cid ekini imzali URL'ye cevirir, karsiliksiz olani dusurur", () => {
    const withMap = sanitizeInboundHtml({
      html: `<img src="cid:img001" />`,
      allowRemoteImages: false,
      cidMap: { img001: "https://imza.li/ek.png" },
    })
    assert.ok(withMap.html.includes("https://imza.li/ek.png"))
    const withoutMap = sanitizeInboundHtml({ html: `<img src="cid:yok" />`, allowRemoteImages: false })
    assert.ok(!withoutMap.html.includes("cid:yok"))
  })

  it("uzak gorsel sayar", () => {
    assert.equal(countRemoteImages(`<img src="https://a/x.png"><IMG SRC='http://b/y.jpg'>`), 2)
    assert.equal(countRemoteImages(`<img src="data:image/png;base64,xx">`), 0)
  })
})

// ---------------------------------------------------------------------------
// Yanit / olusturma kurma
// ---------------------------------------------------------------------------

describe("yanit kurma", () => {
  it("konu, baslik ve alintiyi kurar", () => {
    const built = buildReply({
      subject: "Kargo nerede?",
      body: "Merhaba, kargonuz yolda.",
      original: { from: "musteri@ornek.com", date: "2026-09-30", text: "Siparişim gelmedi." },
      targetMessageId: "<hedef@x>",
      targetReferences: "<onceki@x>",
    })
    assert.equal(built.subject, "Re: Kargo nerede?")
    assert.equal(built.inReplyTo, "<hedef@x>")
    assert.equal(built.references, "<onceki@x> <hedef@x>")
    assert.ok(built.text.includes("Merhaba") && built.text.includes("> Siparişim gelmedi."))
    assert.ok(built.html.includes("Merhaba"))
  })

  it("yonetici girdisini kacirir", () => {
    const built = buildReply({
      subject: "Selam",
      body: `<script>alert(1)</script>`,
      original: null,
      targetMessageId: null,
      targetReferences: null,
    })
    assert.ok(!built.html.includes("<script>") && built.html.includes("&lt;script&gt;"))
    assert.deepEqual([built.inReplyTo, built.references], [null, null])
  })

  it("sifirdan olusturma marka sablonunu sarar", () => {
    const built = buildCompose({ subject: "Duyuru", body: "Merhaba\ndünya" })
    assert.equal(built.subject, "Duyuru")
    assert.equal(built.text, "Merhaba\ndünya")
    assert.ok(built.html.includes("<br>"))
  })

  it("alinti basligini kurar", () => {
    const quoted = quoteOriginal({ from: "a@b.com", date: "2026-01-01", text: "bir\niki" })
    assert.ok(quoted.includes("a@b.com") && quoted.includes("> bir") && quoted.includes("> iki"))
  })

  it("metni HTML'ye guvenli cevirir", () => {
    assert.ok(textToHtmlBody("a<b").includes("a&lt;b"))
  })

  it("adres bicimini dener", () => {
    assert.equal(isEmailAddress("musteri@ornek.com"), true)
    assert.equal(isEmailAddress("bozuk"), false)
    assert.equal(isEmailAddress(""), false)
  })
})

// ---------------------------------------------------------------------------
// Alim API istemcisi (sahte fetch)
// ---------------------------------------------------------------------------

function fakeFetch(handler: (url: string) => unknown): Fetch {
  return (async (url: string) => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(0),
    json: async () => handler(url),
  })) as unknown as Fetch
}

const SAMPLE_API_ROW = {
  id: "mail_1",
  from: "musteri@ornek.com",
  to: ["info@kabiaekolojik.com"],
  cc: [],
  bcc: [],
  reply_to: [],
  subject: "Soru",
  html: "<p>Merhaba</p>",
  text: "Merhaba",
  headers: { from: "Müşteri <musteri@ornek.com>", "in-reply-to": "<onceki@x>" },
  message_id: "<soru@x>",
  authentication: { spf: "pass", dkim: "fail", dmarc: "gray" },
  attachments: [
    {
      id: "ek_1",
      filename: "fiş.pdf",
      content_type: "application/pdf",
      content_disposition: null,
      content_id: null,
      size: 1234,
    },
  ],
}

describe("alim API istemcisi", () => {
  it("yaniti normalize eder", async () => {
    process.env.RESEND_API_KEY = "re_test"
    const result = await fetchReceivedEmail("mail_12345678", {
      fetchFn: fakeFetch(() => SAMPLE_API_ROW),
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.value.from, "musteri@ornek.com")
      assert.deepEqual(result.value.to, ["info@kabiaekolojik.com"])
      assert.equal(result.value.message_id, "<soru@x>")
      assert.deepEqual(result.value.authentication, { spf: "pass", dkim: "fail", dmarc: "gray" })
      assert.equal(result.value.attachments.length, 1)
      assert.equal(result.value.attachments[0]?.filename, "fiş.pdf")
    }
  })

  it("HTTP hatasini kaydeder, fırlatmaz", async () => {
    process.env.RESEND_API_KEY = "re_test"
    const failing = (async () => ({ ok: false, status: 500 })) as unknown as Fetch
    const result = await fetchReceivedEmail("mail_12345678", { fetchFn: failing })
    assert.equal(result.ok, false)
  })

  it("baglanti hatasini kaydeder", async () => {
    process.env.RESEND_API_KEY = "re_test"
    const throwing = (async () => {
      throw new Error("down")
    }) as unknown as Fetch
    const result = await fetchReceivedEmail("mail_12345678", { fetchFn: throwing })
    assert.deepEqual(result, { ok: false, error: "down" })
  })

  it("gecersiz kimlikte aga cikmaz", async () => {
    process.env.RESEND_API_KEY = "re_test"
    let called = false
    const spy = (async () => {
      called = true
      return { ok: true, status: 200, json: async () => ({}) }
    }) as unknown as Fetch
    const result = await fetchReceivedEmail("../etc", { fetchFn: spy })
    assert.equal(result.ok, false)
    assert.equal(called, false)
  })

  it("anahtar yoksa denemez", async () => {
    const saved = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      const result = await fetchReceivedEmail("mail_12345678", {
        fetchFn: fakeFetch(() => ({})),
      })
      assert.equal(result.ok, false)
    } finally {
      if (saved !== undefined) process.env.RESEND_API_KEY = saved
    }
  })

  it("ek indirme adresini alir", async () => {
    process.env.RESEND_API_KEY = "re_test"
    const result = await fetchAttachmentDownload("mail_12345678", "ek_11111111", {
      fetchFn: fakeFetch(() => ({ data: { download_url: "https://cdn/x", expires_at: "t" } })),
    })
    assert.deepEqual(result, { ok: true, value: { download_url: "https://cdn/x", expires_at: "t" } })
  })

  it("http disi indirme adresini reddeder", async () => {
    const result = await downloadBytes("ftp://x/y", { fetchFn: fakeFetch(() => ({})) })
    assert.equal(result.ok, false)
  })

  it("boyut sinirini asan eki reddeder", async () => {
    const big = (async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(10),
      json: async () => ({}),
    })) as unknown as Fetch
    const result = await downloadBytes("https://cdn/x", { fetchFn: big, maxBytes: 5 })
    assert.equal(result.ok, false)
  })

  it("resend kimlik bicimini dener", () => {
    assert.equal(isResendId("56761188-7520-42d8-8898-ff6fc54ce618"), true)
    assert.equal(isResendId("../x"), false)
    assert.equal(isResendId(""), false)
  })
})

// ---------------------------------------------------------------------------
// Satir kurulumu: idempotency + cekme-hatasi kaydi
// ---------------------------------------------------------------------------

const META: WebhookMeta = {
  email_id: "mail_tekrar_1",
  from: "musteri@ornek.com",
  to: ["info@kabiaekolojik.com"],
  cc: [],
  bcc: [],
  subject: "Soru",
  message_id: "<soru@x>",
}

function sampleFetched(): ReceivedEmail {
  return {
    id: "mail_tekrar_1",
    from: "musteri@ornek.com",
    to: ["info@kabiaekolojik.com"],
    cc: [],
    bcc: [],
    reply_to: [],
    subject: "Soru",
    html: "<p>Merhaba</p>",
    text: "Merhaba",
    headers: {},
    message_id: "<soru@x>",
    authentication: { spf: "pass", dkim: "pass", dmarc: "pass" },
    attachments: [],
  }
}

describe("gelen satir kurulumu", () => {
  it("ayni webhook iki kez gelse idempotency anahtari aynidir", () => {
    const first = buildInboundInsert(META, sampleFetched(), null, "thread-1", "2026-09-30T00:00:00Z")
    const second = buildInboundInsert(META, sampleFetched(), null, "thread-1", "2026-09-30T00:00:01Z")
    // DB'deki kısmi unique index (uq_emails_resend_id) ikinciyi yutar.
    assert.equal(first.resend_id, second.resend_id)
    assert.equal(first.fetch_status, "ok")
  })

  it("cekme basarisizligi sessiz dusmez, yeniden denemeye kalir", () => {
    const row = buildInboundInsert(META, null, "Alım API'si 500 döndü.", "thread-1", "2026-09-30T00:00:00Z")
    assert.equal(row.fetch_status, "failed")
    assert.ok(row.fetch_error?.includes("500"))
    assert.equal(row.body_text, null)
    // Üstveri yine de korunur: yeniden deneme aynı iletiyi bulur.
    assert.equal(row.resend_id, META.email_id)
    assert.equal(row.message_id, "<soru@x>")
  })
})

// ---------------------------------------------------------------------------
// Satir yardimcilari, yetki, hiz siniri, denetim etiketi
// ---------------------------------------------------------------------------

describe("inbox yardimcilari ve guards", () => {
  it("sahtecilik uyarisini fail'de verir", () => {
    assert.equal(isAuthFailed({ auth_spf: "fail", auth_dkim: "pass", auth_dmarc: "pass" }), true)
    assert.equal(isAuthFailed({ auth_spf: "pass", auth_dkim: "pass", auth_dmarc: "gray" }), false)
    assert.equal(isAuthFailed({ auth_spf: null, auth_dkim: null, auth_dmarc: null }), false)
  })

  it("auth etiketleri Turkce", () => {
    assert.equal(authResultLabel("pass"), "geçti")
    assert.equal(authResultLabel("fail"), "başarısız")
    assert.equal(authResultLabel(null), "yok")
  })

  it("muhatap yone gore", () => {
    assert.equal(
      counterpartOf({ direction: "inbound", from_address: "a@b.com", to_addresses: ["info@x"] }),
      "a@b.com",
    )
    assert.equal(
      counterpartOf({ direction: "outbound", from_address: "info@x", to_addresses: ["a@b.com"] }),
      "a@b.com",
    )
  })

  it("onizleme kisaltir", () => {
    assert.equal(previewOf("  a  b  "), "a b")
    assert.ok(previewOf("x".repeat(200)).endsWith("…"))
    assert.equal(previewOf(null), "")
  })

  it("ciplak adres cikarir", () => {
    assert.equal(bareAddress("Kabia <info@kabiaekolojik.com>"), "info@kabiaekolojik.com")
    assert.equal(bareAddress("info@kabiaekolojik.com"), "info@kabiaekolojik.com")
    assert.equal(bareAddress("bozuk"), null)
    assert.equal(bareAddress(null), null)
  })

  it("manageInbox yetkisi iki admin rolunde", () => {
    assert.deepEqual(PERMISSIONS.manageInbox, ["admin", "super_admin"])
    assert.equal(can("admin", "manageInbox"), true)
    assert.equal(can("super_admin", "manageInbox"), true)
    assert.equal(can(null, "manageInbox"), false)
    assert.equal(can(undefined, "manageInbox"), false)
  })

  it("navigasyon adminde E-posta'yi gosterir", () => {
    const items = navForRole("admin")
    assert.ok(items.some((item) => item.href === "/admin/eposta" && item.permission === "manageInbox"))
    assert.ok(items.some((item) => item.href === "/admin/messages"))
  })

  it("yeni hiz kovalari kapali devrede", () => {
    assert.ok((RATE_LIMIT_BUCKET_IDS as string[]).includes("admin_email_send"))
    assert.ok((RATE_LIMIT_BUCKET_IDS as string[]).includes("inbound_webhook"))
    assert.deepEqual(limiterErrorResult("admin_email_send"), { allowed: false, retryAfter: 60 })
    assert.deepEqual(limiterErrorResult("inbound_webhook"), { allowed: false, retryAfter: 60 })
  })

  it("hiz siniri herhangi bir boyutta bloklar", () => {
    assert.deepEqual(
      combineRateLimitResults([
        { allowed: true, retry_after: 0 },
        { allowed: false, retry_after: 42 },
      ]),
      { allowed: false, retryAfter: 42 },
    )
  })

  it("denetim etiketi var", () => {
    assert.equal(AUDIT_ACTION_LABELS["email.send"], "E-posta gönderildi")
  })
})
