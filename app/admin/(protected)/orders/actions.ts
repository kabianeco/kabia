"use server"

import { revalidatePath } from "next/cache"
import { adminContext, requireSuperAdmin } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { fieldErrorsFrom, orderEmailResendSchema, orderNoteSchema, orderStatusSchema, orderTrackingSchema, overrideOrderStatusSchema } from "@/lib/admin/schemas"
import {
  defaultMailer,
  isUuid,
  resendOrderEmail,
  sendOrderDeliveredEmail,
  sendOrderShippedEmail,
  supabaseNotificationStore,
} from "@/lib/email/notify"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Order operations.
 *
 * There is deliberately no refund action anywhere in this file. The project has
 * no payment-provider integration, so a "refund" button could only ever lie
 * about money having moved. Cancellation sets the order status and nothing
 * else, and the UI says exactly that.
 *
 * Status changes go through `admin_update_order_status()`, which locks the row,
 * re-reads the authoritative current status, and lets the database's transition
 * trigger reject an illegal move. The client's opinion about the current status
 * never enters the decision.
 */

function revalidateOrder(orderId: string) {
  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin")
  // The customer's own order view reads the same row.
  revalidatePath("/hesabim/siparislerim")
}

/**
 * Transactional durum e-postaları (kargoda / teslim_edildi).
 *
 * Durum değişikliği RPC'si çoktan commit edildi; burası yalnızca e-posta
 * dener. Sahip id DB'den okunur (forma güvenilmez). Gönderici idempotent'tir
 * (satır varsa durur) ve asla throw etmez — e-posta hatası durum
 * değişikliğini geri almaz, `failed` olarak kayda düşer.
 */
async function fireStatusEmail(
  supabase: SupabaseClient,
  orderId: string,
  status: string,
): Promise<void> {
  if (status !== "kargoda" && status !== "teslim_edildi") return
  try {
    const store = supabaseNotificationStore(supabase)
    let owner: string | null = null
    try {
      const loaded = await store.loadOrder(orderId)
      if (loaded && isUuid(loaded.userId)) owner = loaded.userId
    } catch {
      return
    }
    if (!owner) return
    if (status === "kargoda") {
      await sendOrderShippedEmail(store, defaultMailer, { orderId, ownerUserId: owner })
    } else {
      await sendOrderDeliveredEmail(store, defaultMailer, { orderId, ownerUserId: owner })
    }
  } catch (error) {
    console.error("[email] status email failed:", error instanceof Error ? error.message : error)
  }
}

export async function updateOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageOrders")

    const parsed = orderStatusSchema.safeParse({
      order_id: formData.get("order_id"),
      status: formData.get("status"),
      note: formData.get("note") ?? null,
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Geçersiz istek." }
    }

    const { data, error } = await supabase.rpc("admin_update_order_status", {
      p_order_id: parsed.data.order_id,
      p_status: parsed.data.status,
      p_note: parsed.data.note ?? null,
    })

    if (error) return toActionState(error, "updateOrderStatus")

    const result = (data ?? {}) as { order_number?: string }
    revalidateOrder(parsed.data.order_id)
    await fireStatusEmail(supabase, parsed.data.order_id, parsed.data.status)

    return {
      ok: true,
      message: `${result.order_number ?? "Sipariş"} durumu güncellendi.`,
    }
  } catch (error) {
    return toActionState(error, "updateOrderStatus")
  }
}

export async function addOrderNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageOrders")

    const parsed = orderNoteSchema.safeParse({
      order_id: formData.get("order_id"),
      note: formData.get("note"),
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
    }

    // admin_user_id comes from the verified session, and the RLS policy on
    // order_notes independently requires it to equal auth.uid().
    const { error } = await supabase.from("order_notes").insert({
      order_id: parsed.data.order_id,
      admin_user_id: session.userId,
      note: parsed.data.note,
    })

    if (error) return toActionState(error, "addOrderNote")

    const audited = await logAdminAction(supabase, {
      action: "order.note",
      entityType: "order",
      entityId: parsed.data.order_id,
      after: { note_length: parsed.data.note.length },
    })

    revalidateOrder(parsed.data.order_id)

    return {
      ok: true,
      message: "Not eklendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "addOrderNote")
  }
}

export async function updateTrackingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageOrders")

    const parsed = orderTrackingSchema.safeParse({
      order_id: formData.get("order_id"),
      tracking_carrier: formData.get("tracking_carrier") ?? "",
      tracking_number: formData.get("tracking_number") ?? "",
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
    }

    const { data: before, error: readError } = await supabase
      .from("orders")
      .select("tracking_carrier, tracking_number, order_number, status, user_id")
      .eq("id", parsed.data.order_id)
      .maybeSingle()

    if (readError) return toActionState(readError, "updateTracking:read")
    if (!before) return { ok: false, message: "Sipariş bulunamadı." }

    const { error } = await supabase
      .from("orders")
      .update({
        tracking_carrier: parsed.data.tracking_carrier,
        tracking_number: parsed.data.tracking_number,
      })
      .eq("id", parsed.data.order_id)

    if (error) return toActionState(error, "updateTracking")

    const audited = await logAdminAction(supabase, {
      action: "order.tracking",
      entityType: "order",
      entityId: parsed.data.order_id,
      before: {
        tracking_carrier: before.tracking_carrier,
        tracking_number: before.tracking_number,
      },
      after: {
        tracking_carrier: parsed.data.tracking_carrier,
        tracking_number: parsed.data.tracking_number,
      },
      metadata: { order_number: before.order_number },
    })

    revalidateOrder(parsed.data.order_id)

    // Kargo bilgisi `kargoda` durumundaki siparişe girildiyse shipped
    // e-postasını dene (kargo + takip no e-postaya girer). Sipariş başka
    // durumdaysa ya da e-posta zaten gittiyse gönderici durur — çift
    // gönderim olmaz. Takip silme (iki alan da boş) e-posta tetiklemez.
    try {
      const row = before as {
        status?: unknown
        user_id?: unknown
      }
      const carrier = parsed.data.tracking_carrier
      const number = parsed.data.tracking_number
      if (row.status === "kargoda" && isUuid(row.user_id) && (carrier || number)) {
        const store = supabaseNotificationStore(supabase)
        await sendOrderShippedEmail(store, defaultMailer, {
          orderId: parsed.data.order_id,
          ownerUserId: row.user_id,
        })
      }
    } catch (error) {
      console.error("[email] tracking email failed:", error instanceof Error ? error.message : error)
    }

    return {
      ok: true,
      message: "Kargo bilgisi güncellendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "updateTracking")
  }
}

export async function overrideOrderStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireSuperAdmin()
    const { createSupabaseServerClient } = await import("@/lib/supabase/server")
    const supabase = await createSupabaseServerClient()

    const parsed = overrideOrderStatusSchema.safeParse({
      order_id: formData.get("order_id"),
      status: formData.get("status"),
      reason: formData.get("reason"),
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Geçersiz istek." }
    }

    const { data, error } = await supabase.rpc("admin_override_order_status", {
      p_order_id: parsed.data.order_id,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    })

    if (error) return toActionState(error, "overrideOrderStatus")

    const result = (data ?? {}) as { order_number?: string }
    revalidateOrder(parsed.data.order_id)
    // Override ile kargoda/teslim_edildi'ye geçiş de e-posta dener; satır
    // varsa gönderici durur — geçersiz kılma asla çift gönderemez.
    await fireStatusEmail(supabase, parsed.data.order_id, parsed.data.status)

    return {
      ok: true,
      message: `${result.order_number ?? "Sipariş"} durumu geçersiz kılındı. Denetim kaydına işlendi.`,
    }
  } catch (error) {
    return toActionState(error, "overrideOrderStatus")
  }
}

/**
 * Başarısız/atlanmış sipariş e-postasını yeniden gönderme (admin).
 *
 * Yalnızca failed/skipped satırı sending'e çekilebildiyse gönderilir:
 * çift tıklama ya da iki yöneticinin aynı anda basması ikinci gönderimi
 * yutar. shipped/delivered yeniden gönderimde de müşterinin sipariş
 * bildirimi tercihine saygı gösterir. Başarı denetim kaydına işlenir
 * (order.email_resend); e-posta hatası aksiyonu devirmez, failed kalır.
 */
export async function resendOrderEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageOrders")

    const parsed = orderEmailResendSchema.safeParse({
      order_id: formData.get("order_id"),
      kind: formData.get("kind"),
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Geçersiz istek." }
    }

    // Sahip id forma değil, DB satırına göre belirlenir.
    const store = supabaseNotificationStore(supabase)
    let owner: string | null = null
    let orderNumber: string | null = null
    try {
      const loaded = await store.loadOrder(parsed.data.order_id)
      if (loaded && isUuid(loaded.userId)) owner = loaded.userId
      if (loaded && typeof loaded.orderNumber === "string") orderNumber = loaded.orderNumber
    } catch (error) {
      return toActionState(error, "resendOrderEmail:read")
    }
    if (!owner) return { ok: false, message: "Sipariş bulunamadı." }

    const result = await resendOrderEmail(store, defaultMailer, {
      orderId: parsed.data.order_id,
      ownerUserId: owner,
      kind: parsed.data.kind,
    })

    if (!result.mailed) {
      const message =
        result.reason === "duplicate"
          ? "Bu e-posta zaten gönderilmiş ya da gönderim sürüyor."
          : result.reason === "opted_out"
            ? "Müşteri sipariş bildirimlerini kapatmış; gönderilmedi."
            : result.reason === "not_found"
              ? "Sipariş bulunamadı."
              : "E-posta gönderilemedi. Kayıt güncellendi; daha sonra tekrar deneyin."
      return { ok: false, message }
    }

    const audited = await logAdminAction(supabase, {
      action: "order.email_resend",
      entityType: "order",
      entityId: parsed.data.order_id,
      after: { kind: parsed.data.kind },
      metadata: orderNumber ? { order_number: orderNumber } : undefined,
    })

    revalidateOrder(parsed.data.order_id)

    return {
      ok: true,
      message: "E-posta yeniden gönderildi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "resendOrderEmail")
  }
}
