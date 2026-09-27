import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  ORDER_RECENCY_MS,
  isFreshOwnedOrder,
  isOrderEmailKind,
  isUuid,
  orderStatusEmailsAllowed,
  resendOrderEmail,
  sendOrderDeliveredEmail,
  sendOrderReceivedEmail,
  sendOrderShippedEmail,
  sendWelcomeEmail,
  toOrderSummary,
  type Mailer,
  type NotificationStore,
  type OrderDetail,
} from "../lib/email/notify.ts"
import type { SendEmailResult } from "../lib/email/send.ts"

// Transactional e-postalar: idempotency, sahiplik denetimi ve
// "hata siparişi bozmaz" kuralı — veritabanısız, sahte depo + sahte
// göndericiyle. Gerçek PostgREST/fetch'e dokunulmaz.

const ORDER_ID = "11111111-1111-4111-8111-111111111111"
const USER_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_ID = "33333333-3333-4333-8333-333333333333"

function orderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: ORDER_ID,
    orderNumber: "KB-ABC1234",
    userId: USER_ID,
    email: "musteri@example.com",
    fullName: "Ayşe Yılmaz",
    status: "hazirlaniyor",
    subtotal: 100,
    shippingCost: 0,
    total: 100,
    address: {
      recipientName: "Ayşe Yılmaz",
      addressLine1: "Test Mah. 1/2",
      district: "Geyve",
      city: "Sakarya",
      postalCode: "54700",
    },
    trackingCarrier: "Aras Kargo",
    trackingNumber: "TRK123",
    createdAt: new Date().toISOString(),
    items: [{ name: "Süzme Bal", variant: "500g", quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

interface FakeOptions {
  order?: OrderDetail | null
  pref?: { order_status: boolean | null } | null
  claimWins?: boolean
}

function fakeStore(options: FakeOptions = {}): NotificationStore & {
  rows: Map<string, { status: string }>
  order: OrderDetail | null
  pref: { order_status: boolean | null } | null
} {
  const rows = new Map<string, { status: string }>()
  const key = (orderId: string | null, userId: string, kind: string) =>
    `${orderId ?? ""}|${userId}|${kind}`
  const order = options.order === undefined ? orderDetail() : options.order
  const store: NotificationStore & {
    rows: Map<string, { status: string }>
    order: OrderDetail | null
    pref: { order_status: boolean | null } | null
  } = {
    rows,
    order,
    pref: options.pref === undefined ? { order_status: true } : options.pref,
    async find(orderId, userId, kind) {
      const row = rows.get(key(orderId, userId, kind))
      return row ? { kind, status: row.status } : null
    },
    async claim(orderId, userId, kind) {
      if (options.claimWins === false) return false
      const k = key(orderId, userId, kind)
      if (rows.has(k)) return false
      rows.set(k, { status: "sending" })
      return true
    },
    async markSent(orderId, userId, kind) {
      rows.set(key(orderId, userId, kind), { status: "sent" })
    },
    async markFailed(orderId, userId, kind) {
      rows.set(key(orderId, userId, kind), { status: "failed" })
    },
    async markSkipped(orderId, userId, kind) {
      rows.set(key(orderId, userId, kind), { status: "skipped" })
    },
    async claimResend(orderId, userId, kind) {
      const k = key(orderId, userId, kind)
      const row = rows.get(k)
      if (!row || (row.status !== "failed" && row.status !== "skipped")) return false
      rows.set(k, { status: "sending" })
      return true
    },
    async loadOrder() {
      return store.order
    },
    async loadPreference() {
      return store.pref
    },
  }
  return store
}

function fakeMailer(mode: "ok" | "reject" | "throw" = "ok"): Mailer & { calls: number } {
  const fn = (async () => {
    fn.calls += 1
    if (mode === "throw") throw new Error("bağlantı hatası")
    if (mode === "reject") {
      const r: SendEmailResult = { ok: false, reason: "rejected", message: "E-posta gönderilemedi (500)." }
      return r
    }
    const r: SendEmailResult = { ok: true, id: "msg_test_123" }
    return r
  }) as unknown as Mailer & { calls: number }
  fn.calls = 0
  return fn
}

describe("welcome: exactly once", () => {
  it("sends on first confirm, duplicates after", async () => {
    const store = fakeStore()
    const mail = fakeMailer()
    const first = await sendWelcomeEmail(store, mail, {
      userId: USER_ID,
      email: "musteri@example.com",
      name: "Ayşe",
    })
    assert.deepEqual(first, { mailed: true, reason: "sent" })
    assert.equal(mail.calls, 1)
    const second = await sendWelcomeEmail(store, mail, {
      userId: USER_ID,
      email: "musteri@example.com",
      name: "Ayşe",
    })
    assert.deepEqual(second, { mailed: false, reason: "duplicate" })
    assert.equal(mail.calls, 1)
  })

  it("rejects invalid identity without touching the mailer", async () => {
    const store = fakeStore()
    const mail = fakeMailer()
    assert.deepEqual(
      await sendWelcomeEmail(store, mail, { userId: "not-a-uuid", email: "musteri@example.com" }),
      { mailed: false, reason: "invalid" },
    )
    assert.deepEqual(
      await sendWelcomeEmail(store, mail, { userId: USER_ID, email: "bozuk" }),
      { mailed: false, reason: "invalid" },
    )
    assert.equal(mail.calls, 0)
  })
})

describe("order_received: ownership + idempotency", () => {
  it("sends once for the owner, then duplicates", async () => {
    const store = fakeStore()
    const mail = fakeMailer()
    assert.deepEqual(
      await sendOrderReceivedEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: true, reason: "sent" },
    )
    assert.equal(mail.calls, 1)
    assert.deepEqual(
      await sendOrderReceivedEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: false, reason: "duplicate" },
    )
    assert.equal(mail.calls, 1)
  })

  it("never sends another user's order (no leak, no mail)", async () => {
    const store = fakeStore()
    const mail = fakeMailer()
    assert.deepEqual(
      await sendOrderReceivedEmail(store, mail, { orderId: ORDER_ID, ownerUserId: OTHER_ID }),
      { mailed: false, reason: "not_found" },
    )
    assert.equal(mail.calls, 0)
  })

  it("losing the claim race means duplicate, not a second mail", async () => {
    const store = fakeStore({ claimWins: false })
    const mail = fakeMailer()
    assert.deepEqual(
      await sendOrderReceivedEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: false, reason: "duplicate" },
    )
    assert.equal(mail.calls, 0)
  })
})

describe("ownership + recency gate (checkout path)", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z")
  const base = { orderUserId: USER_ID, sessionUserId: USER_ID }

  it("accepts a fresh order of the signed-in user", () => {
    assert.equal(
      isFreshOwnedOrder({ ...base, createdAt: new Date(now - 9 * 60 * 1000).toISOString(), nowMs: now }),
      true,
    )
  })

  it("accepts exactly at the boundary, rejects older", () => {
    assert.equal(
      isFreshOwnedOrder({
        ...base,
        createdAt: new Date(now - ORDER_RECENCY_MS).toISOString(),
        nowMs: now,
      }),
      true,
    )
    assert.equal(
      isFreshOwnedOrder({
        ...base,
        createdAt: new Date(now - ORDER_RECENCY_MS - 1000).toISOString(),
        nowMs: now,
      }),
      false,
    )
  })

  it("rejects foreign orders, future timestamps and garbage", () => {
    assert.equal(
      isFreshOwnedOrder({ ...base, sessionUserId: OTHER_ID, createdAt: new Date(now).toISOString(), nowMs: now }),
      false,
    )
    assert.equal(
      isFreshOwnedOrder({ ...base, createdAt: new Date(now + 60 * 1000).toISOString(), nowMs: now }),
      false,
    )
    for (const bad of [null, "", "dün", 123]) {
      assert.equal(isFreshOwnedOrder({ ...base, createdAt: bad, nowMs: now }), false)
    }
    assert.equal(
      isFreshOwnedOrder({ orderUserId: "x", sessionUserId: "x", createdAt: new Date(now).toISOString(), nowMs: now }),
      false,
    )
  })

  it("the checkout action verifies ownership server-side before sending", () => {
    const src = readFileSync("app/odeme/actions.ts", "utf8")
    assert.ok(src.includes("isFreshOwnedOrder"), "recency+ownership check missing")
    assert.ok(src.includes("sendOrderReceivedEmail"), "send call missing")
    assert.ok(src.includes("auth.getUser"), "session must be re-read on the server")
  })
})

describe("preference gate: shipped/delivered vs received", () => {
  it("order_received always sends even when order_status is false", async () => {
    const store = fakeStore({ pref: { order_status: false } })
    const mail = fakeMailer()
    assert.deepEqual(
      await sendOrderReceivedEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: true, reason: "sent" },
    )
    assert.equal(mail.calls, 1)
  })

  it("shipped respects a persisted false (skipped, no mail)", async () => {
    const store = fakeStore({ pref: { order_status: false } })
    const mail = fakeMailer()
    assert.deepEqual(
      await sendOrderShippedEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: false, reason: "opted_out" },
    )
    assert.equal(mail.calls, 0)
    assert.equal(store.rows.get(`${ORDER_ID}|${USER_ID}|order_shipped`)?.status, "skipped")
  })

  it("shipped sends when the row is missing or true", async () => {
    for (const pref of [null, { order_status: true }, { order_status: null }]) {
      const store = fakeStore({ pref })
      const mail = fakeMailer()
      assert.deepEqual(
        await sendOrderShippedEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
        { mailed: true, reason: "sent" },
        JSON.stringify(pref),
      )
      assert.equal(mail.calls, 1)
    }
    assert.equal(orderStatusEmailsAllowed(null), true)
    assert.equal(orderStatusEmailsAllowed({ order_status: false }), false)
    assert.equal(orderStatusEmailsAllowed({ order_status: true }), true)
  })

  it("delivered sends once and carries no tracking content", async () => {
    const store = fakeStore()
    const mail = fakeMailer()
    assert.deepEqual(
      await sendOrderDeliveredEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: true, reason: "sent" },
    )
    assert.deepEqual(
      await sendOrderDeliveredEmail(store, mail, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: false, reason: "duplicate" },
    )
    assert.equal(mail.calls, 1)
  })
})

describe("failure never breaks the order", () => {
  it("provider rejection is recorded as failed, not thrown", async () => {
    const store = fakeStore()
    const mail = fakeMailer("reject")
    const result = await sendOrderReceivedEmail(store, mail, {
      orderId: ORDER_ID,
      ownerUserId: USER_ID,
    })
    assert.deepEqual(result, { mailed: false, reason: "failed" })
    assert.equal(store.rows.get(`${ORDER_ID}|${USER_ID}|order_received`)?.status, "failed")
  })

  it("transport throw is recorded as failed, not thrown", async () => {
    const store = fakeStore()
    const mail = fakeMailer("throw")
    const result = await sendOrderShippedEmail(store, mail, {
      orderId: ORDER_ID,
      ownerUserId: USER_ID,
    })
    assert.deepEqual(result, { mailed: false, reason: "failed" })
    assert.equal(store.rows.get(`${ORDER_ID}|${USER_ID}|order_shipped`)?.status, "failed")
  })

  it("admin status/tracking actions keep succeeding when email fails", () => {
    const src = readFileSync("app/admin/(protected)/orders/actions.ts", "utf8")
    for (const fn of ["sendOrderShippedEmail", "sendOrderDeliveredEmail", "fireStatusEmail"]) {
      assert.ok(src.includes(fn), `${fn} missing`)
    }
    // E-posta denemesi try/catch içinde; durum mesajı değişmemiş.
    assert.ok(src.includes("durumu güncellendi."), "status success message changed")
    assert.ok(src.includes("Kargo bilgisi güncellendi."), "tracking success message changed")
  })
})

describe("resend: failed rows only, audited, single flight", () => {
  it("failed row resends once; second attempt is a duplicate", async () => {
    const store = fakeStore()
    const failing = fakeMailer("reject")
    assert.deepEqual(
      await sendOrderReceivedEmail(store, failing, { orderId: ORDER_ID, ownerUserId: USER_ID }),
      { mailed: false, reason: "failed" },
    )
    const ok = fakeMailer()
    assert.deepEqual(
      await resendOrderEmail(store, ok, {
        orderId: ORDER_ID,
        ownerUserId: USER_ID,
        kind: "order_received",
      }),
      { mailed: true, reason: "sent" },
    )
    assert.equal(ok.calls, 1)
    assert.deepEqual(
      await resendOrderEmail(store, ok, {
        orderId: ORDER_ID,
        ownerUserId: USER_ID,
        kind: "order_received",
      }),
      { mailed: false, reason: "duplicate" },
    )
    assert.equal(ok.calls, 1)
  })

  it("resend without a failed row does nothing", async () => {
    const store = fakeStore()
    const mail = fakeMailer()
    assert.deepEqual(
      await resendOrderEmail(store, mail, {
        orderId: ORDER_ID,
        ownerUserId: USER_ID,
        kind: "order_shipped",
      }),
      { mailed: false, reason: "duplicate" },
    )
    assert.equal(mail.calls, 0)
  })

  it("resend rejects unknown kinds", async () => {
    const store = fakeStore()
    const mail = fakeMailer()
    assert.equal(isOrderEmailKind("welcome"), false)
    assert.deepEqual(
      await resendOrderEmail(store, mail, {
        orderId: ORDER_ID,
        ownerUserId: USER_ID,
        kind: "welcome",
      }),
      { mailed: false, reason: "invalid" },
    )
    assert.equal(mail.calls, 0)
  })
})

describe("toOrderSummary mapping", () => {
  it("maps a live-shaped row, tolerating numeric strings", () => {
    const mapped = toOrderSummary(
      orderDetail({ subtotal: "250.50", shippingCost: "0", total: "250.50" }),
    )
    assert.ok(mapped)
    assert.equal(mapped.summary.orderNumber, "KB-ABC1234")
    assert.equal(mapped.summary.total, 250.5)
    assert.equal(mapped.customerName, "Ayşe")
    assert.equal(mapped.summary.address.city, "Sakarya")
  })

  it("returns null for broken rows (recorded as failed upstream)", () => {
    assert.equal(toOrderSummary(orderDetail({ items: [] }))?.summary ?? null, null)
    assert.equal(
      toOrderSummary(orderDetail({ address: { addressLine1: "x", district: "y" } }))?.summary ?? null,
      null,
    )
    assert.equal(toOrderSummary(orderDetail({ subtotal: -1 }))?.summary ?? null, null)
    assert.equal(toOrderSummary(orderDetail({ orderNumber: "" }))?.summary ?? null, null)
  })

  it("uuid guard matches the admin schemas", () => {
    assert.equal(isUuid(USER_ID), true)
    assert.equal(isUuid("not-a-uuid"), false)
    assert.equal(isUuid(null), false)
  })
})

describe("notification log migration guarantees", () => {
  const sql = readFileSync(
    "supabase/migrations/20260927000600_email_notification_log.sql",
    "utf8",
  )

  it("enforces one send per kind per order and one welcome per user", () => {
    assert.match(sql, /uq_email_notifications_order_kind/)
    assert.match(sql, /unique index if not exists uq_email_notifications_order_kind[\s\S]*where order_id is not null/)
    assert.match(sql, /uq_email_notifications_user_kind/)
    assert.match(sql, /kind in \('welcome', 'order_received', 'order_shipped', 'order_delivered'\)/)
  })

  it("locks the shape and enables RLS with owner+admin policies", () => {
    assert.match(sql, /email_notifications_shape/)
    assert.match(sql, /enable row level security/)
    assert.match(sql, /en_insert_own/)
    assert.match(sql, /en_insert_admin/)
    assert.match(sql, /has_admin_role/)
    assert.match(sql, /revoke all on table public\.email_notifications from public, anon/)
  })
})

describe("trigger wiring present", () => {
  it("welcome fires on link confirm and code confirm", () => {
    assert.ok(readFileSync("app/auth/confirm/route.ts", "utf8").includes("sendWelcomeEmail"))
    assert.ok(readFileSync("app/auth/actions.ts", "utf8").includes("sendWelcomeEmail"))
  })

  it("admin creation fires order_received", () => {
    assert.ok(
      readFileSync("app/admin/(protected)/orders/yeni/actions.ts", "utf8").includes("sendOrderReceivedEmail"),
    )
  })

  it("checkout fires order_received after the RPC", () => {
    assert.ok(
      readFileSync("components/checkout/checkout-flow.tsx", "utf8").includes("sendOrderReceivedAction"),
    )
  })

  it("override path fires status emails without duplicating", () => {
    const src = readFileSync("app/admin/(protected)/orders/actions.ts", "utf8")
    assert.ok(src.includes("fireStatusEmail(supabase, parsed.data.order_id, parsed.data.status)"))
    assert.ok(src.includes("resendOrderEmailAction"))
    assert.ok(src.includes("order.email_resend"))
  })

  it("detail page shows the log and offers resend", () => {
    assert.ok(
      readFileSync("app/admin/(protected)/orders/[orderId]/page.tsx", "utf8").includes("email_notifications"),
    )
    assert.ok(
      readFileSync("app/admin/(protected)/orders/[orderId]/order-controls.tsx", "utf8").includes("EmailNotifications"),
    )
  })
})

describe("single source of truth: confirmed Auth e-mail", () => {
  it("create_order snapshots auth.users.email and never stores client p_email", () => {
    const sql = readFileSync(
      "supabase/migrations/20260927000700_create_order_auth_email_source.sql",
      "utf8",
    )
    // Param kept for backward compat, but storage uses the snapshot.
    assert.match(sql, /p_email text DEFAULT NULL/)
    assert.match(sql, /select au\.email into v_email from auth\.users au where au\.id = v_uid/)
    assert.match(sql, /p_full_name, v_email, true, true, true, now\(\)/)
    assert.ok(!sql.includes("p_full_name, p_email"), "client p_email must not reach orders.email")
  })

  it("checkout submits and displays the Auth address, not the typed contact value", () => {
    const src = readFileSync("components/checkout/checkout-flow.tsx", "utf8")
    assert.ok(src.includes("authUser?.email"), "must prefer the confirmed Auth e-mail")
    assert.match(src, /const email = authUser\?\.email/)
    assert.ok(src.includes("Single source of truth"), "rule must be documented at the use site")
  })

  it("admin path snapshots the same Auth address", () => {
    const sql = readFileSync("supabase/migrations/20260927000300_admin_create_order.sql", "utf8")
    assert.match(sql, /pr\.full_name, au\.email/)
  })

  it("every sending path reads from Auth or its order snapshot", () => {
    const notify = readFileSync("lib/email/notify.ts", "utf8")
    assert.ok(notify.includes("to: (order.email as string).trim()"), "order mails use the snapshot")
    assert.ok(notify.includes("const to = input.email.trim()"), "welcome uses the caller-supplied Auth address")
    const confirmRoute = readFileSync("app/auth/confirm/route.ts", "utf8")
    assert.ok(confirmRoute.includes("email: user.email"), "welcome caller passes the confirmed Auth address")
    const adminMail = readFileSync("app/admin/(protected)/customers/[customerId]/actions.ts", "utf8")
    assert.ok(adminMail.includes("target.user.email"), "admin password mail uses Auth Admin e-mail")
  })

  it("profiles stores no e-mail, so nothing is written before Auth confirms", () => {
    const schema = readFileSync("supabase/migrations/20260730194034_create_schema.sql", "utf8")
    const start = schema.indexOf("create table if not exists public.profiles")
    const end = schema.indexOf(");", start)
    const profilesBlock = schema.slice(start, end)
    assert.ok(!profilesBlock.toLowerCase().includes("email"), "profiles must not hold an e-mail column")
    const deps = readFileSync("lib/account/server-deps.ts", "utf8")
    const fnStart = deps.indexOf("export async function requestEmailChange")
    const fnEnd = deps.indexOf("\n}", fnStart)
    const fnBody = deps.slice(fnStart, fnEnd)
    assert.ok(fnBody.includes("auth.updateUser"), "change starts in Auth only")
    assert.ok(!fnBody.includes("profiles"), "no premature profiles write in the change path")
  })
})
