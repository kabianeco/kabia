"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { adminContext } from "@/lib/admin/auth"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { loadAuthSummary, loadCustomerAddresses } from "@/lib/admin/queries/customers"
import {
  adminCreateOrderSchema,
  customerNumberLookupSchema,
  fieldErrorsFrom,
} from "@/lib/admin/schemas"
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit"

export interface CustomerLookupState extends ActionState {
  customer?: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
    customerNumber: string
  }
  addresses?: {
    id: string
    label: string
    full_name: string
    phone: string
    address_line1: string
    address_line2: string | null
    city: string
    district: string
    postal_code: string | null
    is_default: boolean
  }[]
}

export interface AdminOrderCreateState extends ActionState {
  orderId?: string
  orderNumber?: string
}

/**
 * Müşteri numarasıyla arama (Feature 2, adım 1).
 *
 * profiles.customer_number UNIQUE olduğu için tek satır döner; e-posta Auth
 * Admin API'den, adresler RLS içinden okunur. Numara biçimi zod ile denetlenir.
 */
export async function lookupCustomerByNumberAction(
  _prev: CustomerLookupState,
  formData: FormData,
): Promise<CustomerLookupState> {
  try {
    const { supabase } = await adminContext("manageOrders")

    const parsed = customerNumberLookupSchema.safeParse({
      customer_number: formData.get("customer_number"),
    })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Geçersiz istek." }
    }

    const { data, error } = await supabase
      .from("admin_customer_overview")
      .select("id, full_name, phone, customer_number")
      .eq("customer_number", parsed.data.customer_number)
      .maybeSingle()

    if (error) return toActionState(error, "lookupCustomerByNumber")
    if (!data) return { ok: false, message: "Bu numaraya kayıtlı müşteri bulunamadı." }

    const row = data as { id: string; full_name: string; phone: string | null; customer_number: string }
    const [auth, addresses] = await Promise.all([
      loadAuthSummary(row.id),
      loadCustomerAddresses(supabase, row.id),
    ])

    return {
      ok: true,
      message: `${row.full_name} bulundu.`,
      customer: {
        id: row.id,
        fullName: row.full_name,
        email: auth?.email ?? null,
        phone: row.phone,
        customerNumber: row.customer_number,
      },
      addresses: (addresses ?? []) as CustomerLookupState["addresses"],
    }
  } catch (error) {
    return toActionState(error, "lookupCustomerByNumber")
  }
}

/**
 * Yönetici sipariş oluşturma (Feature 2, adım 2).
 *
 * Fiyatlar formdan alınmaz: kalemlerde yalnızca variant_id + adet taşınır,
 * birim fiyat ve stok admin_create_order içinde veritabanından okunur ve
 * atomik düşer. Onam kutucukları taklit edilmez; consent_note zorunlu açık
 * beyandır. Hız sınırlayıcı admin_order_create kovasından geçer.
 */
export async function createAdminOrderAction(
  _prev: AdminOrderCreateState,
  formData: FormData,
): Promise<AdminOrderCreateState> {
  try {
    const { session, supabase } = await adminContext("manageOrders")

    const h = await headers()
    const rl = await checkRateLimit("admin_order_create", getClientIp(h), session.userId)
    if (!rl.allowed) return { ok: false, message: RATE_LIMIT_MESSAGE }

    let itemsRaw: unknown
    let addressRaw: unknown
    try {
      itemsRaw = JSON.parse(String(formData.get("items") ?? "[]"))
      addressRaw = JSON.parse(String(formData.get("shipping_address") ?? "{}"))
    } catch {
      return { ok: false, message: "Geçersiz istek." }
    }

    const parsed = adminCreateOrderSchema.safeParse({
      customer_id: formData.get("customer_id"),
      items: itemsRaw,
      shipping_address: addressRaw,
      payment_method: formData.get("payment_method"),
      admin_note: formData.get("admin_note") ?? null,
      consent_note: formData.get("consent_note"),
    })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Geçersiz istek." }
    }

    const { data, error } = await supabase.rpc("admin_create_order", {
      p_customer_id: parsed.data.customer_id,
      p_items: parsed.data.items,
      p_shipping_address: parsed.data.shipping_address,
      p_payment_method: parsed.data.payment_method,
      p_admin_note: parsed.data.admin_note ?? null,
      p_consent_note: parsed.data.consent_note,
    })

    if (error) return toActionState(error, "createAdminOrder")

    const result = (data ?? {}) as { order_id?: string; order_number?: string; total?: number }

    // Denetim kaydı RPC gövdesindeki log_admin_action ile yazılır (yazılamazsa
    // RPC'nin kendisi düşer); burada ikinci bir kayıt tutulmaz.
    revalidatePath("/admin/orders")
    if (result.order_id) revalidatePath(`/admin/orders/${result.order_id}`)
    revalidatePath("/admin")
    revalidatePath("/hesabim/siparislerim")

    return {
      ok: true,
      message: `${result.order_number ?? "Sipariş"} oluşturuldu.`,
      orderId: result.order_id,
      orderNumber: result.order_number,
    }
  } catch (error) {
    return toActionState(error, "createAdminOrder")
  }
}
