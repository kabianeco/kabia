"use server"

import { updateTag } from "next/cache"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { CATALOG_PRODUCTS_TAG } from "@/lib/catalog"
import {
  defaultMailer,
  isFreshOwnedOrder,
  isUuid,
  sendOrderReceivedEmail,
  supabaseNotificationStore,
} from "@/lib/email/notify"

/**
 * Müşteri checkout'u: `create_order` RPC'si tarayıcıdan çağrılır; RPC
 * başarılı olunca istemci burayı çağırır.
 *
 * İstemciden gelen order id körü körüne kabul edilmez: satırın oturum
 * sahibine ait olduğu ve dakikalar önce oluştuğu sunucuda yeniden
 * doğrulanır. E-posta hatası siparişi bozmaz — sonuç her durumda ok'tur
 * (başarı/başarısızlık email_notifications satırındadır).
 */
export async function sendOrderReceivedAction(orderId: string): Promise<{ ok: boolean }> {
  try {
    if (!isUuid(orderId)) return { ok: true }
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: true }
    let ownerId: unknown = null
    let createdAt: unknown = null
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("user_id,created_at")
        .eq("id", orderId)
        .maybeSingle()
      if (error || !data) return { ok: true }
      const row = data as { user_id: unknown; created_at: unknown }
      ownerId = row.user_id
      createdAt = row.created_at
    } catch {
      return { ok: true }
    }
    if (
      !isFreshOwnedOrder({
        orderUserId: ownerId,
        sessionUserId: user.id,
        createdAt,
        nowMs: Date.now(),
      })
    ) {
      return { ok: true }
    }
    // A fresh owned order just decremented variant stock: bust the cached
    // catalogue reads so PDP stock/availability follows within a request.
    // (Oversell is impossible regardless — the RPC decrements atomically.)
    updateTag(CATALOG_PRODUCTS_TAG)
    await sendOrderReceivedEmail(supabaseNotificationStore(supabase), defaultMailer, {
      orderId,
      ownerUserId: user.id,
    })
    return { ok: true }
  } catch {
    return { ok: true }
  }
}
