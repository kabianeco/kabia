import "server-only"

import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdminAuthError } from "@/lib/admin/errors"
import { can, isAdminRole, type AdminRole, type Permission } from "@/lib/admin/roles"

/**
 * The server-side authorization boundary for the dashboard.
 *
 * Layer 2 (the protected layout) and layer 3 (every server action) both go
 * through here. Neither trusts anything the client sent: the acting user comes
 * from `getUser()`, which validates the session against the Auth server, and
 * the role comes from a fresh `user_roles` read — never from a JWT claim, which
 * would be stale after a revocation, and never from `user_metadata`, which the
 * user can edit.
 *
 * The database is still the final boundary. If any of this were bypassed, RLS
 * would return no rows.
 */

export interface AdminSession {
  userId: string
  email: string
  displayName: string
  role: AdminRole
  mustChangePassword: boolean
}

// Defined in lib/admin/errors.ts, which is safe to import from a client
// component; re-exported here so server code has one obvious import site.
export { AdminAuthError } from "@/lib/admin/errors"

/**
 * Resolves the acting administrator, or null. Wrapped in React `cache` so the
 * layout, the page and every action in a single request share one round trip.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return null

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role, is_active, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!roleRow || roleRow.is_active !== true || !isAdminRole(roleRow.role)) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const email = user.email ?? ""
  return {
    userId: user.id,
    email,
    displayName: profile?.full_name?.trim() || email.split("@")[0] || "Yönetici",
    role: roleRow.role,
    mustChangePassword: roleRow.must_change_password === true,
  }
})

/**
 * For server actions. Throws rather than redirecting, so the caller can turn it
 * into a form error instead of a navigation.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) throw new AdminAuthError("unauthenticated")
  return session
}

export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await requireAdmin()
  if (session.role !== "super_admin") throw new AdminAuthError("forbidden")
  return session
}

export async function requirePermission(permission: Permission): Promise<AdminSession> {
  const session = await requireAdmin()
  if (!can(session.role, permission)) throw new AdminAuthError("forbidden")
  return session
}

/**
 * An authenticated administrator's own Supabase client. Reads and writes made
 * through it are still subject to RLS, which is the point: the dashboard is not
 * privileged, the administrator is.
 */
export async function adminClient(): Promise<SupabaseClient> {
  return createSupabaseServerClient()
}

/** Both together, since almost every action needs the pair. */
export async function adminContext(permission?: Permission) {
  const session = permission ? await requirePermission(permission) : await requireAdmin()
  const supabase = await createSupabaseServerClient()
  return { session, supabase }
}
