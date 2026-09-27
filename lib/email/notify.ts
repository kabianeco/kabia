/**
 * Transactional e-posta orkestrasyonu — welcome, order-received, order-shipped,
 * order-delivered (yalnızca sunucu).
 *
 * Tetikleyiciler:
 *   welcome        — müşteri e-postasını doğrulayınca (link: app/auth/confirm,
 *                    kod: app/auth/actions customerVerifyCodeAction).
 *   order_received — sipariş oluşunca: müşteri checkout'u (create_order RPC
 *                    ardından app/odeme/actions) ve yönetici oluşturması
 *                    (admin_create_order ardından orders/yeni/actions).
 *   order_shipped  — sipariş `kargoda`'ya geçince (durum aksiyonları) ya da
 *                    `kargoda` durumundaki siparişe kargo bilgisi girilince.
 *   order_delivered— sipariş `teslim_edildi`'ye geçince.
 *
 * Kurallar:
 *   - Idempotent: her deneme public.email_notifications satırıdır. Otomatik
 *     yollar, satır varsa durur (claim yarışını kaybeden 23505 yer ve durur);
 *     süper-yönetici override'u ya da durum tekrarı asla çift gönderemez.
 *     Başarısız satırlar aynı satır üzerinden, koşullu UPDATE ile, yalnızca
 *     admin "yeniden gönder" yoluyla denenir.
 *   - E-posta hatası asla siparişi ya da durum değişikliğini bozmaz: bu
 *     modüldeki göndericiler operasyonel hatalarda throw etmez; `failed`
 *     kaydeder ve `{ mailed: false }` döner. Arayan yine de try/catch sarar.
 *   - order_received her zaman gönderilir (transactional). shipped/delivered,
 *     müşterinin persist edilmiş order_status tercihine saygı gösterir
 *     (satır yoksa gönderir); welcome tercihten bağımsızdır.
 *   - Girdi doğrulama: uuid, kind allowlist, e-posta biçimi, tutar/adres
 *     şekli. Yeni bağımlılık yok; gönderim lib/email/send.ts (fetch, Resend).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail, type SendEmailInput, type SendEmailResult } from "./send"
import { welcomeEmail } from "./welcome"
import { orderReceivedEmail } from "./order-received"
import { carrierTrackingUrl, orderShippedEmail } from "./order-shipped"
import { orderDeliveredEmail } from "./order-delivered"
import type { OrderSummaryInput } from "./order-types"

/** public.email_notifications.kind ile birebir. */
export const EMAIL_KINDS = ["welcome", "order_received", "order_shipped", "order_delivered"] as const
export type EmailKind = (typeof EMAIL_KINDS)[number]

/** Siparişe bağlı türler (admin detayında yeniden gönderilebilir olanlar). */
export const ORDER_EMAIL_KINDS = ["order_received", "order_shipped", "order_delivered"] as const
export type OrderEmailKind = (typeof ORDER_EMAIL_KINDS)[number]

export type NotifyReason =
  | "sent"
  | "duplicate"
  | "failed"
  | "opted_out"
  | "invalid"
  | "not_found"
  | "store_error"

export interface NotifyResult {
  mailed: boolean
  reason: NotifyReason
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Müşteri checkout'unda RPC sonrası sahiplik + tazelik denetimi.
 * İstemciden gelen order id'ye asla güvenilmez: satır, oturumdaki
 * kullanıcının olmalı ve dakikalar önce oluşmuş olmalı.
 */
export const ORDER_RECENCY_MS = 10 * 60 * 1000

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

export function isEmailKind(value: unknown): value is EmailKind {
  return typeof value === "string" && (EMAIL_KINDS as readonly string[]).includes(value)
}

export function isOrderEmailKind(value: unknown): value is OrderEmailKind {
  return typeof value === "string" && (ORDER_EMAIL_KINDS as readonly string[]).includes(value)
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim())
}

export function isFreshOwnedOrder(input: {
  orderUserId: unknown
  sessionUserId: unknown
  createdAt: unknown
  nowMs: number
}): boolean {
  const { orderUserId, sessionUserId, createdAt, nowMs } = input
  if (!isUuid(orderUserId) || !isUuid(sessionUserId) || orderUserId !== sessionUserId) return false
  if (typeof createdAt !== "string") return false
  const createdMs = Date.parse(createdAt)
  if (!Number.isFinite(createdMs)) return false
  const age = nowMs - createdMs
  return age >= 0 && age <= ORDER_RECENCY_MS
}

/**
 * Sipariş-durumu e-postaları (shipped/delivered) için tercih kapısı.
 * Satır yoksa ya da değer null ise gönder (opt-out modeli, default true).
 * Yalnızca persist edilmiş `false` durdurur.
 */
export function orderStatusEmailsAllowed(
  pref: { order_status: boolean | null } | null | undefined,
): boolean {
  if (!pref) return true
  return pref.order_status !== false
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ""
}

// ---------------------------------------------------------------------------
// Sipariş satırı → şablon girdisi (saf eşleme, DB erişimi yok)
// ---------------------------------------------------------------------------

export interface OrderItemDetail {
  name: unknown
  variant: unknown
  quantity: unknown
  unitPrice: unknown
}

export interface OrderDetail {
  id: string
  orderNumber: unknown
  userId: unknown
  email: unknown
  fullName: unknown
  status: unknown
  subtotal: unknown
  shippingCost: unknown
  total: unknown
  address: unknown
  trackingCarrier: unknown
  trackingNumber: unknown
  createdAt: unknown
  items: OrderItemDetail[]
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN
  return Number.isFinite(n) ? n : null
}

function addressString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = record[key]
    if (typeof v === "string" && v.trim() !== "") return v.trim()
  }
  return ""
}

/**
 * DB satırını order-received şablonunun beklediği şekle çevirir.
 * Bozuk satırda null döner; arayan `failed` kaydeder, throw etmez.
 */
export function toOrderSummary(
  order: OrderDetail,
): { summary: OrderSummaryInput; customerName: string } | null {
  if (typeof order.orderNumber !== "string" || order.orderNumber.trim() === "") return null
  if (typeof order.fullName !== "string" || order.fullName.trim() === "") return null
  const subtotal = toFiniteNumber(order.subtotal)
  const shippingCost = toFiniteNumber(order.shippingCost)
  const total = toFiniteNumber(order.total)
  if (
    subtotal === null || subtotal < 0 ||
    shippingCost === null || shippingCost < 0 ||
    total === null || total < 0
  ) {
    return null
  }
  if (!Array.isArray(order.items) || order.items.length === 0) return null
  const items = []
  for (const rawUnknown of order.items) {
    const raw: unknown = rawUnknown
    if (typeof raw !== "object" || raw === null) return null
    const r = raw as Record<string, unknown>
    const name = typeof r.name === "string" ? r.name.trim() : ""
    const variant = typeof r.variant === "string" ? r.variant.trim() : ""
    const quantity = typeof r.quantity === "number" && Number.isInteger(r.quantity) ? r.quantity : -1
    const unitPrice = toFiniteNumber(r.unitPrice)
    if (name === "" || variant === "" || quantity < 1 || unitPrice === null || unitPrice < 0) return null
    items.push({ name, variant, quantity, unitPrice })
  }
  if (typeof order.address !== "object" || order.address === null) return null
  const a = order.address as Record<string, unknown>
  const fullName = order.fullName.trim()
  const line2 = addressString(a, ["addressLine2", "address_line2", "line2"])
  const address = {
    fullName: addressString(a, ["recipientName", "fullName", "full_name"]) || fullName,
    line1: addressString(a, ["addressLine1", "address_line1", "line1"]),
    ...(line2 === "" ? {} : { line2 }),
    district: addressString(a, ["district"]),
    city: addressString(a, ["city"]),
    postalCode: addressString(a, ["postalCode", "postal_code"]) || "",
  }
  if (address.line1 === "" || address.district === "" || address.city === "") return null
  return {
    summary: {
      orderNumber: order.orderNumber.trim(),
      items,
      subtotal,
      shippingCost,
      total,
      address,
    },
    customerName: firstNameOf(fullName),
  }
}

// ---------------------------------------------------------------------------
// Dar depo arayüzü: gerçek istemci aşağıda, testler sahte verir
// ---------------------------------------------------------------------------

export interface StoredEmail {
  kind: string
  status: string
}

export interface NotificationStore {
  find(orderId: string | null, userId: string, kind: EmailKind): Promise<StoredEmail | null>
  /** Hak kazanıldıysa true; satır zaten varsa (23505 dahil) false. */
  claim(orderId: string | null, userId: string, kind: EmailKind): Promise<boolean>
  markSent(orderId: string | null, userId: string, kind: EmailKind, providerId: string): Promise<void>
  markFailed(orderId: string | null, userId: string, kind: EmailKind, error: string): Promise<void>
  markSkipped(orderId: string, userId: string, kind: OrderEmailKind): Promise<void>
  /** Yalnızca failed/skipped satırını sending'e çeker (çift tıklama güvenli). */
  claimResend(orderId: string, userId: string, kind: OrderEmailKind): Promise<boolean>
  loadOrder(orderId: string): Promise<OrderDetail | null>
  loadPreference(userId: string): Promise<{ order_status: boolean | null } | null>
}

export type Mailer = (input: SendEmailInput) => Promise<SendEmailResult>

export const defaultMailer: Mailer = (input) => sendEmail(input)

function excerpt(value: string, max = 500): string {
  return value.length > max ? value.slice(0, max) : value
}

function logError(context: string, error: unknown) {
  console.error(`[email] ${context}:`, error instanceof Error ? error.message : error)
}

// ---------------------------------------------------------------------------
// Supabase uyarlayıcısı (oturum istemcisiyle; RLS çalışır)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>

function asRow(value: unknown): Row | null {
  return typeof value === "object" && value !== null ? (value as Row) : null
}

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((v): v is Row => asRow(v) !== null) : []
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  )
}

const ORDER_COLUMNS =
  "id,user_id,order_number,status,subtotal,shipping_cost,total,full_name,email,shipping_address,tracking_carrier,tracking_number,created_at"
const ITEM_COLUMNS = "product_name_snapshot,variant_label_snapshot,unit_price_snapshot,quantity"

export function supabaseNotificationStore(client: SupabaseClient): NotificationStore {
  const table = () => client.from("email_notifications")
  const orders = () => client.from("orders")

  async function finalize(
    orderId: string | null,
    userId: string,
    kind: EmailKind,
    patch: Record<string, string | null>,
  ): Promise<void> {
    if (orderId === null) {
      const { error } = await table()
        .update(patch)
        .is("order_id", null)
        .eq("user_id", userId)
        .eq("kind", kind)
      if (error) throw error
      return
    }
    const { error } = await table().update(patch).eq("order_id", orderId).eq("kind", kind)
    if (error) throw error
  }

  return {
    async find(orderId, userId, kind) {
      const base = table().select("kind,status")
      const scoped =
        orderId === null
          ? base.is("order_id", null).eq("user_id", userId)
          : base.eq("order_id", orderId)
      const { data, error } = await scoped.eq("kind", kind).maybeSingle()
      if (error) throw error
      const row = asRow(data)
      if (!row) return null
      return { kind: String(row.kind), status: String(row.status) }
    },

    async claim(orderId, userId, kind) {
      const { error } = await table().insert({
        order_id: orderId,
        user_id: userId,
        kind,
        status: "sending",
      })
      if (!error) return true
      if (isConflict(error)) return false
      throw error
    },

    async markSent(orderId, userId, kind, providerId) {
      await finalize(orderId, userId, kind, {
        status: "sent",
        provider_message_id: providerId.slice(0, 200),
        error: null,
        sent_at: new Date().toISOString(),
      })
    },

    async markFailed(orderId, userId, kind, errorMsg) {
      await finalize(orderId, userId, kind, {
        status: "failed",
        error: excerpt(errorMsg, 2000),
      })
    },

    async markSkipped(orderId, userId, kind) {
      await finalize(orderId, userId, kind, { status: "skipped", error: null })
    },

    async claimResend(orderId, userId, kind) {
      const { data, error } = await table()
        .update({ status: "sending", error: null })
        .eq("order_id", orderId)
        .eq("user_id", userId)
        .eq("kind", kind)
        .in("status", ["failed", "skipped"])
        .select("id")
      if (error) throw error
      return Array.isArray(data) && data.length > 0
    },

    async loadOrder(orderId) {
      const { data: orderData, error: orderError } = await orders()
        .select(ORDER_COLUMNS)
        .eq("id", orderId)
        .maybeSingle()
      if (orderError) throw orderError
      const o = asRow(orderData)
      if (!o) return null
      const { data: itemData, error: itemError } = await client
        .from("order_items")
        .select(ITEM_COLUMNS)
        .eq("order_id", orderId)
      if (itemError) throw itemError
      const items: OrderItemDetail[] = asRows(itemData).map((r) => ({
        name: r.product_name_snapshot,
        variant: r.variant_label_snapshot,
        quantity: r.quantity,
        unitPrice: r.unit_price_snapshot,
      }))
      return {
        id: String(o.id),
        orderNumber: o.order_number,
        userId: o.user_id,
        email: o.email,
        fullName: o.full_name,
        status: o.status,
        subtotal: o.subtotal,
        shippingCost: o.shipping_cost,
        total: o.total,
        address: o.shipping_address,
        trackingCarrier: o.tracking_carrier,
        trackingNumber: o.tracking_number,
        createdAt: o.created_at,
        items,
      }
    },

    async loadPreference(userId) {
      const { data, error } = await client
        .from("notification_preferences")
        .select("order_status")
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw error
      const row = asRow(data)
      if (!row) return null
      return {
        order_status:
          typeof row.order_status === "boolean" ? row.order_status : null,
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Göndericiler: asla throw etmez (operasyonel hatalar failed + {mailed:false})
// ---------------------------------------------------------------------------

async function safeFind(
  store: NotificationStore,
  orderId: string | null,
  userId: string,
  kind: EmailKind,
): Promise<{ ok: true; existing: StoredEmail | null } | { ok: false }> {
  try {
    return { ok: true, existing: await store.find(orderId, userId, kind) }
  } catch (error) {
    logError(`lookup ${kind}`, error)
    return { ok: false }
  }
}

async function safeClaim(
  store: NotificationStore,
  orderId: string | null,
  userId: string,
  kind: EmailKind,
): Promise<boolean> {
  try {
    return await store.claim(orderId, userId, kind)
  } catch (error) {
    logError(`claim ${kind}`, error)
    return false
  }
}

/** Hak kazanılmış satırı kapatır; kayıt yazılamazsa yalnızca loglar. */
async function settle(
  store: NotificationStore,
  orderId: string | null,
  userId: string,
  kind: EmailKind,
  outcome: { status: "sent"; providerId: string } | { status: "failed"; error: string } | { status: "skipped" },
): Promise<void> {
  try {
    if (outcome.status === "sent") await store.markSent(orderId, userId, kind, outcome.providerId)
    else if (outcome.status === "failed") await store.markFailed(orderId, userId, kind, outcome.error)
    else await store.markSkipped(orderId as string, userId, kind as OrderEmailKind)
  } catch (error) {
    logError(`record ${kind}/${outcome.status}`, error)
  }
}

async function sendBuilt(
  store: NotificationStore,
  mail: Mailer,
  slot: { orderId: string | null; userId: string; kind: EmailKind },
  built: { to: string; subject: string; html: string; text: string },
): Promise<NotifyResult> {
  let sent: SendEmailResult
  try {
    sent = await mail(built)
  } catch (error) {
    const message = error instanceof Error ? error.message : "bağlantı hatası"
    await settle(store, slot.orderId, slot.userId, slot.kind, { status: "failed", error: message })
    return { mailed: false, reason: "failed" }
  }
  if (!sent.ok) {
    await settle(store, slot.orderId, slot.userId, slot.kind, { status: "failed", error: sent.message })
    return { mailed: false, reason: "failed" }
  }
  await settle(store, slot.orderId, slot.userId, slot.kind, { status: "sent", providerId: sent.id })
  return { mailed: true, reason: "sent" }
}

/**
 * Welcome — müşteri e-postası doğrulandığında bir kez.
 * userId/email/name arayan tarafından doğrulanmış oturumdan gelir.
 */
export async function sendWelcomeEmail(
  store: NotificationStore,
  mail: Mailer,
  input: { userId: unknown; email: unknown; name?: unknown },
): Promise<NotifyResult> {
  const kind: EmailKind = "welcome"
  if (!isUuid(input.userId) || !isValidEmail(input.email)) return { mailed: false, reason: "invalid" }
  const userId = input.userId
  const to = input.email.trim()
  const name = typeof input.name === "string" ? input.name.slice(0, 160) : ""
  const found = await safeFind(store, null, userId, kind)
  if (!found.ok) return { mailed: false, reason: "store_error" }
  if (found.existing) return { mailed: false, reason: "duplicate" }
  if (!(await safeClaim(store, null, userId, kind))) return { mailed: false, reason: "duplicate" }
  const built = welcomeEmail({ name })
  return sendBuilt(store, mail, { orderId: null, userId, kind }, { to, ...built })
}

interface OrderSlot {
  orderId: string
  userId: string
  email: string
  order: OrderDetail
}

/** Siparişi yükler + sahipliği doğrular; bozuk/eksik satırda failed kaydeder. */
async function loadOwnedOrder(
  store: NotificationStore,
  orderId: unknown,
  ownerUserId: unknown,
): Promise<{ ok: true; slot: OrderSlot } | { ok: false; reason: NotifyReason }> {
  if (!isUuid(orderId) || !isUuid(ownerUserId)) return { ok: false, reason: "invalid" }
  let order: OrderDetail | null
  try {
    order = await store.loadOrder(orderId)
  } catch (error) {
    logError("loadOrder", error)
    return { ok: false, reason: "store_error" }
  }
  if (!order || order.userId !== ownerUserId) return { ok: false, reason: "not_found" }
  if (!isValidEmail(order.email)) {
    await settle(store, orderId, ownerUserId, "order_received", {
      status: "failed",
      error: "siparişte geçerli e-posta yok",
    })
    return { ok: false, reason: "invalid" }
  }
  return {
    ok: true,
    slot: { orderId, userId: ownerUserId, email: (order.email as string).trim(), order },
  }
}

/**
 * Order received — transactional, her zaman gönderilir (tercihten bağımsız).
 * ownerUserId checkout'ta oturumdan, admin yolunda DB'den okunan sipariş
 * sahibinden gelir; satırın sahibiyle eşleşmek zorundadır.
 */
export async function sendOrderReceivedEmail(
  store: NotificationStore,
  mail: Mailer,
  input: { orderId: unknown; ownerUserId: unknown },
): Promise<NotifyResult> {
  const kind: EmailKind = "order_received"
  if (!isUuid(input.orderId) || !isUuid(input.ownerUserId)) {
    return { mailed: false, reason: "invalid" }
  }
  const orderId = input.orderId
  const ownerUserId = input.ownerUserId
  const found = await safeFind(store, orderId, ownerUserId, kind)
  if (!found.ok) return { mailed: false, reason: "store_error" }
  if (found.existing) return { mailed: false, reason: "duplicate" }
  if (!(await safeClaim(store, orderId, ownerUserId, kind))) {
    return { mailed: false, reason: "duplicate" }
  }
  const loaded = await loadOwnedOrder(store, orderId, ownerUserId)
  if (!loaded.ok) {
    if (loaded.reason === "store_error") {
      // Depo erişilemedi: claim satırı 'sending' takılı kalmasın diye
      // başarısız kapatmayı dene (o da yazılamazsa yalnızca loglanır).
      await settle(store, orderId, ownerUserId, kind, {
        status: "failed",
        error: "sipariş okunamadı (depo hatası)",
      })
    } else if (loaded.reason === "not_found") {
      // Sahte/yabancı id: açılan claim satırını başarısız kapat ki
      // 'sending' takılı kalmasın; içerik asla kurulmaz.
      await settle(store, orderId, ownerUserId, kind, {
        status: "failed",
        error: "sipariş bulunamadı ya da oturum sahibine ait değil",
      })
    }
    // loadOwnedOrder zaten invalid e-posta için failed kaydetti.
    return { mailed: false, reason: loaded.reason }
  }
  const mapped = toOrderSummary(loaded.slot.order)
  if (!mapped) {
    await settle(store, orderId, ownerUserId, kind, {
      status: "failed",
      error: "sipariş satırı e-posta için eksik/bozuk",
    })
    return { mailed: false, reason: "invalid" }
  }
  const built = orderReceivedEmail({ order: mapped.summary, customerName: mapped.customerName })
  return sendBuilt(
    store,
    mail,
    { orderId, userId: ownerUserId, kind },
    { to: loaded.slot.email, ...built },
  )
}

async function loadPreferenceSafe(
  store: NotificationStore,
  userId: string,
): Promise<{ order_status: boolean | null } | null | "error"> {
  try {
    return await store.loadPreference(userId)
  } catch (error) {
    logError("loadPreference", error)
    return "error"
  }
}

/**
 * Shipped / delivered — persist edilmiş order_status=false durdurur
 * (skipped kaydedilir); satır yoksa gönderilir.
 */
async function sendStatusEmail(
  store: NotificationStore,
  mail: Mailer,
  kind: OrderEmailKind,
  input: { orderId: unknown; ownerUserId: unknown },
  build: (order: OrderDetail) => { to: string; subject: string; html: string; text: string } | null,
): Promise<NotifyResult> {
  if (!isUuid(input.orderId) || !isUuid(input.ownerUserId)) {
    return { mailed: false, reason: "invalid" }
  }
  const orderId = input.orderId
  const ownerUserId = input.ownerUserId
  const found = await safeFind(store, orderId, ownerUserId, kind)
  if (!found.ok) return { mailed: false, reason: "store_error" }
  if (found.existing) return { mailed: false, reason: "duplicate" }
  if (!(await safeClaim(store, orderId, ownerUserId, kind))) {
    return { mailed: false, reason: "duplicate" }
  }
  let order: OrderDetail | null
  try {
    order = await store.loadOrder(orderId)
  } catch (error) {
    logError("loadOrder", error)
    await settle(store, orderId, ownerUserId, kind, {
      status: "failed",
      error: "sipariş okunamadı (depo hatası)",
    })
    return { mailed: false, reason: "store_error" }
  }
  if (!order || order.userId !== ownerUserId) {
    await settle(store, orderId, ownerUserId, kind, {
      status: "failed",
      error: "sipariş bulunamadı ya da oturum sahibine ait değil",
    })
    return { mailed: false, reason: "not_found" }
  }
  const pref = await loadPreferenceSafe(store, ownerUserId)
  if (pref === "error") {
    await settle(store, orderId, ownerUserId, kind, {
      status: "failed",
      error: "bildirim tercihi okunamadı (depo hatası)",
    })
    return { mailed: false, reason: "store_error" }
  }
  if (!orderStatusEmailsAllowed(pref)) {
    await settle(store, orderId, ownerUserId, kind, { status: "skipped" })
    return { mailed: false, reason: "opted_out" }
  }
  const built = build(order)
  if (!built) {
    await settle(store, orderId, ownerUserId, kind, {
      status: "failed",
      error: "sipariş satırı e-posta için eksik/bozuk",
    })
    return { mailed: false, reason: "invalid" }
  }
  return sendBuilt(store, mail, { orderId, userId: ownerUserId, kind }, built)
}

export async function sendOrderShippedEmail(
  store: NotificationStore,
  mail: Mailer,
  input: { orderId: unknown; ownerUserId: unknown },
): Promise<NotifyResult> {
  return sendStatusEmail(store, mail, "order_shipped", input, (order) => {
    if (typeof order.orderNumber !== "string" || order.orderNumber.trim() === "") return null
    if (!isValidEmail(order.email)) return null
    const carrier = typeof order.trackingCarrier === "string" ? order.trackingCarrier.trim() : ""
    const trackingNumber = typeof order.trackingNumber === "string" ? order.trackingNumber.trim() : ""
    const built = orderShippedEmail({
      orderNumber: order.orderNumber.trim(),
      carrier: carrier === "" ? null : carrier,
      trackingNumber: trackingNumber === "" ? null : trackingNumber,
      trackingUrl: carrierTrackingUrl(carrier === "" ? null : carrier, trackingNumber === "" ? null : trackingNumber),
    })
    return { to: (order.email as string).trim(), ...built }
  })
}

export async function sendOrderDeliveredEmail(
  store: NotificationStore,
  mail: Mailer,
  input: { orderId: unknown; ownerUserId: unknown },
): Promise<NotifyResult> {
  return sendStatusEmail(store, mail, "order_delivered", input, (order) => {
    if (typeof order.orderNumber !== "string" || order.orderNumber.trim() === "") return null
    if (!isValidEmail(order.email)) return null
    const built = orderDeliveredEmail({ orderNumber: order.orderNumber.trim() })
    return { to: (order.email as string).trim(), ...built }
  })
}

/**
 * Admin "yeniden gönder" — yalnızca failed/skipped satırı sending'e
 * çekilebildiyse gönderir (claimResend çift tıklamayı yutar).
 * shipped/delivered yeniden gönderimde de tercihe saygı gösterir.
 */
export async function resendOrderEmail(
  store: NotificationStore,
  mail: Mailer,
  input: { orderId: unknown; ownerUserId: unknown; kind: unknown },
): Promise<NotifyResult> {
  if (!isUuid(input.orderId) || !isUuid(input.ownerUserId) || !isOrderEmailKind(input.kind)) {
    return { mailed: false, reason: "invalid" }
  }
  const { orderId, ownerUserId, kind } = input
  let claimed: boolean
  try {
    claimed = await store.claimResend(orderId, ownerUserId, kind)
  } catch (error) {
    logError(`claimResend ${kind}`, error)
    return { mailed: false, reason: "store_error" }
  }
  if (!claimed) return { mailed: false, reason: "duplicate" }
  let order: OrderDetail | null
  try {
    order = await store.loadOrder(orderId)
  } catch (error) {
    logError("loadOrder", error)
    await settle(store, orderId, ownerUserId, kind, {
      status: "failed",
      error: "sipariş okunamadı (depo hatası)",
    })
    return { mailed: false, reason: "store_error" }
  }
  if (!order || !isValidEmail(order.email)) {
    await settle(store, orderId, ownerUserId, kind, {
      status: "failed",
      error: "sipariş bulunamadı ya da e-postası geçersiz",
    })
    return { mailed: false, reason: "not_found" }
  }
  if (kind !== "order_received") {
    const pref = await loadPreferenceSafe(store, String(order.userId ?? ownerUserId))
    if (pref === "error") return { mailed: false, reason: "store_error" }
    if (!orderStatusEmailsAllowed(pref)) {
      await settle(store, orderId, ownerUserId, kind, { status: "skipped" })
      return { mailed: false, reason: "opted_out" }
    }
  }
  if (kind === "order_received") {
    const mapped = toOrderSummary(order)
    if (!mapped) {
      await settle(store, orderId, ownerUserId, kind, {
        status: "failed",
        error: "sipariş satırı e-posta için eksik/bozuk",
      })
      return { mailed: false, reason: "invalid" }
    }
    const built = orderReceivedEmail({ order: mapped.summary, customerName: mapped.customerName })
    return sendBuilt(store, mail, { orderId, userId: ownerUserId, kind }, { to: (order.email as string).trim(), ...built })
  }
  if (kind === "order_shipped") {
    return sendOrderShippedAfterClaim(store, mail, orderId, ownerUserId, order)
  }
  return sendOrderDeliveredAfterClaim(store, mail, orderId, ownerUserId, order)
}

async function sendOrderShippedAfterClaim(
  store: NotificationStore,
  mail: Mailer,
  orderId: string,
  userId: string,
  order: OrderDetail,
): Promise<NotifyResult> {
  if (typeof order.orderNumber !== "string" || order.orderNumber.trim() === "") {
    await settle(store, orderId, userId, "order_shipped", { status: "failed", error: "sipariş numarası yok" })
    return { mailed: false, reason: "invalid" }
  }
  const carrier = typeof order.trackingCarrier === "string" ? order.trackingCarrier.trim() : ""
  const trackingNumber = typeof order.trackingNumber === "string" ? order.trackingNumber.trim() : ""
  const built = orderShippedEmail({
    orderNumber: order.orderNumber.trim(),
    carrier: carrier === "" ? null : carrier,
    trackingNumber: trackingNumber === "" ? null : trackingNumber,
    trackingUrl: carrierTrackingUrl(carrier === "" ? null : carrier, trackingNumber === "" ? null : trackingNumber),
  })
  return sendBuilt(
    store,
    mail,
    { orderId, userId, kind: "order_shipped" },
    { to: (order.email as string).trim(), ...built },
  )
}

async function sendOrderDeliveredAfterClaim(
  store: NotificationStore,
  mail: Mailer,
  orderId: string,
  userId: string,
  order: OrderDetail,
): Promise<NotifyResult> {
  if (typeof order.orderNumber !== "string" || order.orderNumber.trim() === "") {
    await settle(store, orderId, userId, "order_delivered", { status: "failed", error: "sipariş numarası yok" })
    return { mailed: false, reason: "invalid" }
  }
  const built = orderDeliveredEmail({ orderNumber: order.orderNumber.trim() })
  return sendBuilt(
    store,
    mail,
    { orderId, userId, kind: "order_delivered" },
    { to: (order.email as string).trim(), ...built },
  )
}
