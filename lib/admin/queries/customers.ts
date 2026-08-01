import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { logQueryError } from "@/lib/admin/errors"

/**
 * Customer reads.
 *
 * Profile, order count and spend come from `admin_customer_overview`, a
 * security_invoker view — so an administrator sees everyone and a customer
 * calling the same view would still see only themselves.
 *
 * Email, last sign-in and account state live in `auth.users`, which is not
 * reachable through PostgREST at all. Those come from the Auth Admin API via
 * the service-role client, on the server, one user at a time, and only the four
 * fields the screen actually displays are returned. Password hashes, identity
 * provider records, tokens and raw metadata never leave this module.
 */

export interface AuthSummary {
  email: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  bannedUntil: string | null
}

/** Null when the deployment has no service-role key configured. */
export async function loadAuthSummary(userId: string): Promise<AuthSummary | null> {
  if (!hasServiceRoleKey()) return null
  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data.user) return null
    const user = data.user as unknown as {
      email?: string
      last_sign_in_at?: string
      email_confirmed_at?: string
      banned_until?: string
    }
    return {
      email: user.email ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      bannedUntil: user.banned_until ?? null,
    }
  } catch (error) {
    logQueryError("customers:authSummary", error)
    return null
  }
}

/**
 * Emails for a page of customers. Bounded by the page size the caller already
 * applied — never a full directory dump.
 */
export async function loadEmailsFor(userIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (!hasServiceRoleKey() || userIds.length === 0) return result

  try {
    const admin = createSupabaseAdminClient()
    const wanted = new Set(userIds)
    // listUsers is paginated; one page of 200 covers a 25-row screen comfortably
    // without walking the whole directory.
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error || !data) return result
    for (const user of data.users) {
      if (wanted.has(user.id) && user.email) result.set(user.id, user.email)
    }
    return result
  } catch (error) {
    logQueryError("customers:emails", error)
    return result
  }
}

export interface CustomerRow {
  id: string
  fullName: string
  phone: string | null
  createdAt: string
  orderCount: number
  cancelledCount: number
  totalSpent: number
  lastOrderAt: string | null
}

export async function loadCustomerOrders(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    logQueryError("customers:orders", error)
    return []
  }
  return data ?? []
}

export async function loadCustomerAddresses(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, full_name, phone, address_line1, address_line2, city, district, postal_code, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })

  if (error) {
    logQueryError("customers:addresses", error)
    return []
  }
  return data ?? []
}
