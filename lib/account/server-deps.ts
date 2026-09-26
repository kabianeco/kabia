import "server-only"
import { headers } from "next/headers"
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit"
import { buildExport } from "@/lib/account/export"
import type {
  BaseDeps,
  Bucket,
  PasswordUpdateOutcome,
  ProfilePatch,
  SessionUser,
} from "@/lib/account/handlers"

/**
 * Real implementations behind lib/account/handlers.ts.
 *
 * Password proof uses an isolated, non-persisting client: signing in there
 * checks the current password without touching the visitor's own cookies, and
 * the throwaway session is signed out (local scope) immediately after.
 */

function isolatedClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("[account] Supabase URL/anon key missing")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email ?? "",
    hasPassword: (user.identities ?? []).some((identity) => identity.provider === "email"),
  }
}

export async function baseDeps(): Promise<BaseDeps & { client: SupabaseClient }> {
  const client = await createSupabaseServerClient()
  const ip = getClientIp(await headers())
  return {
    client,
    async getUser() {
      const { data, error } = await client.auth.getUser()
      return error || !data.user ? null : toSessionUser(data.user)
    },
    async allow(bucket: Bucket, key: string) {
      return (await checkRateLimit(bucket, ip, key)).allowed
    },
  }
}

export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const probe = isolatedClient()
  const { data, error } = await probe.auth.signInWithPassword({ email, password })
  if (error || !data.session) return false
  await probe.auth.signOut({ scope: "local" })
  return true
}

export async function updatePasswordWithProof(email: string, current: string, next: string): Promise<PasswordUpdateOutcome> {
  const probe = isolatedClient()
  const { data, error } = await probe.auth.signInWithPassword({ email, password: current })
  if (error || !data.session) return "invalid_current"
  try {
    // A fresh session satisfies Supabase's "secure password change" check.
    const { error: updateError } = await probe.auth.updateUser({ password: next })
    if (!updateError) return "ok"
    if (updateError.code === "weak_password") return "weak"
    if (updateError.code === "same_password") return "same"
    return "error"
  } finally {
    await probe.auth.signOut({ scope: "local" })
  }
}

export async function requestEmailChange(client: SupabaseClient, newEmail: string): Promise<"ok" | "exists" | "error"> {
  const { error } = await client.auth.updateUser({ email: newEmail })
  if (!error) return "ok"
  if (error.code === "email_exists" || error.code === "user_already_exists") return "exists"
  console.error("[account] email change failed:", error.code ?? error.status)
  return "error"
}

export async function signOutGlobal(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.auth.signOut({ scope: "global" })
  if (error) console.error("[account] global sign-out failed:", error.code ?? error.status)
  return !error
}

export async function saveProfile(client: SupabaseClient, userId: string, patch: ProfilePatch): Promise<boolean> {
  const { error } = await client.from("profiles").update(patch).eq("id", userId)
  if (error) console.error("[account] profile update failed:", error.code)
  return !error
}

export async function setMarketingConsent(client: SupabaseClient, granted: boolean): Promise<boolean> {
  const { error } = await client.rpc("set_marketing_email_consent", { p_granted: granted })
  if (error) console.error("[account] marketing consent failed:", error.code)
  return !error
}

export async function hasStaffRole(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const { count, error } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("user_id", userId)
  // Unknown is treated as "has a role": never delete an account we could not classify.
  if (error) return true
  return (count ?? 0) > 0
}

/** Reviews are the only account content outside the profile cascade. */
export async function removeAccountContent(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from("reviews").delete().eq("user_id", userId)
  if (error) console.error("[account] review removal failed:", error.code)
  return !error
}

export async function deleteAuthUser(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) console.error("[account] auth user deletion failed:", error.code ?? error.status)
  return !error
}

/**
 * Everything for the export, read through the customer's own session (RLS is
 * the boundary) except reviews, whose user_id column is not readable by the
 * authenticated role — those come from the service role, filtered by this id.
 */
export async function collectExport(client: SupabaseClient, user: SessionUser) {
  const { data: auth } = await client.auth.getUser()
  if (!auth.user || auth.user.id !== user.id) return null
  const [profile, addresses, prefs, consents, favorites, cards, orders] = await Promise.all([
    client.from("profiles").select("full_name, phone, birth_date, created_at, customer_number").eq("id", user.id).maybeSingle(),
    client.from("addresses").select("label, full_name, phone, address_line1, address_line2, city, district, postal_code, is_default, created_at").eq("user_id", user.id),
    client.from("notification_preferences").select("campaign_emails, order_status, sms, stock_alerts").eq("user_id", user.id).maybeSingle(),
    client.from("customer_consents").select("kind, granted, document_version, source, recorded_at").eq("user_id", user.id).order("recorded_at"),
    client.from("favorites").select("created_at, products(slug, name)").eq("user_id", user.id),
    client.from("payment_methods").select("card_brand, last4, expiry_month, expiry_year, card_name, created_at").eq("user_id", user.id),
    client
      .from("orders")
      .select("order_number, status, created_at, subtotal, shipping_cost, total, full_name, email, shipping_address, payment_method_snapshot, tracking_carrier, tracking_number, consented_sales, consented_kvkk, consented_at, order_items(product_name_snapshot, variant_label_snapshot, product_slug_snapshot, unit_price_snapshot, quantity, line_total), order_status_history(status, changed_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ])
  const failed = [profile, addresses, prefs, consents, favorites, cards, orders].find((r) => r.error)
  if (failed) {
    console.error("[account] export read failed:", failed.error?.code)
    return null
  }
  const reviews = await createSupabaseAdminClient()
    .from("reviews")
    .select("rating, review_text, reviewer_name, is_verified_purchase, created_at, products(slug, name)")
    .eq("user_id", user.id)
  if (reviews.error) {
    console.error("[account] export review read failed:", reviews.error.code)
    return null
  }
  return buildExport(
    {
      account: {
        id: auth.user.id,
        email: auth.user.email ?? "",
        created_at: auth.user.created_at,
        email_confirmed_at: auth.user.email_confirmed_at ?? null,
        last_sign_in_at: auth.user.last_sign_in_at ?? null,
      },
      profile: profile.data,
      addresses: addresses.data ?? [],
      notificationPreferences: prefs.data,
      consents: consents.data ?? [],
      favorites: (favorites.data ?? []) as Record<string, unknown>[],
      reviews: (reviews.data ?? []) as Record<string, unknown>[],
      savedCardMetadata: cards.data ?? [],
      orders: (orders.data ?? []) as Record<string, unknown>[],
    },
    new Date(),
  )
}
