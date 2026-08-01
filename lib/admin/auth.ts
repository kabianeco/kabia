import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
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
 * The page- and layout-facing guard, and the counterpart to `requireAdmin()`.
 *
 * A server action must *throw*, so the caller can turn the failure into a form
 * error. A page must *redirect* — and it must do so from the page itself rather
 * than leaning on the layout above it.
 *
 * On a soft navigation between two routes in the same layout group, Next.js
 * reuses the already-rendered layout from the client router cache and
 * re-renders only the page. A guard that lives solely in the protected layout
 * therefore never runs on those navigations. A page that throws instead lands
 * in `error.tsx`, which leaves an administrator whose role was just revoked
 * pinned inside the admin shell: every in-app link is another soft navigation
 * into the same group, so it throws again, and the retry button re-renders the
 * same failing page. Only a full document request re-ran the layout and reached
 * `/admin/unauthorized`, which is why signing out, hard-refreshing or clearing
 * cookies appeared to fix it.
 *
 * The decision is made once per request, from a fresh `user_roles` read, and it
 * is deterministic:
 *
 *   no session                → /admin/login
 *   session, no admin role    → /admin/unauthorized
 *   admin, wrong permission   → /admin/unauthorized
 *   admin owing a password    → /admin/sifre-degistir
 *   otherwise                 → render
 *
 * Every one of those targets sits outside this layout group, so a redirect can
 * never resolve back into the route that issued it.
 */
export async function requireAdminPage(permission?: Permission): Promise<AdminSession> {
  const session = await getAdminSession()

  if (!session) {
    // Distinguish "not signed in" from "signed in without a role", so a
    // customer who wanders in gets an explanation rather than a login form they
    // have already satisfied.
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    redirect(user ? "/admin/unauthorized" : "/admin/login")
  }

  if (session.mustChangePassword) redirect("/admin/sifre-degistir")
  if (permission && !can(session.role, permission)) redirect("/admin/unauthorized")

  return session
}

/** The page-level counterpart to `adminContext()`. Redirects; never throws. */
export async function adminPageContext(permission?: Permission) {
  const session = await requireAdminPage(permission)
  const supabase = await createSupabaseServerClient()
  return { session, supabase }
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
