import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { AdminAuthError, AdminAuthUnavailableError } from "@/lib/admin/errors"
import { can, type Permission } from "@/lib/admin/roles"
import {
  decideAccess,
  guardOutcome,
  type AdminAccess,
  type AdminSession,
} from "@/lib/admin/access"

/**
 * The server-side authorization boundary for the dashboard.
 *
 * The protected layout, every page and every server action go through here.
 * Nothing trusts what the client sent: the acting user comes from `getUser()`,
 * which validates the session against the Auth server, and the role comes from
 * a fresh `user_roles` read — never from a JWT claim, which would be stale after
 * a revocation, and never from `user_metadata`, which the user can edit.
 *
 * The database is still the final boundary. If any of this were bypassed, RLS
 * would return no rows.
 *
 * One request produces exactly one verdict (`resolveAdminAccess`), and every
 * caller derives its behaviour from that same verdict via `guardOutcome`. The
 * layers cannot reach different conclusions about the same request, which is
 * what previously let a redirect out of the dashboard meet a redirect back into
 * it and spin forever.
 */

export type { AdminSession } from "@/lib/admin/access"

// Defined in lib/admin/errors.ts, which is safe to import from a client
// component; re-exported here so server code has one obvious import site.
export { AdminAuthError, AdminAuthUnavailableError } from "@/lib/admin/errors"

/**
 * The one authorization read per request.
 *
 * Wrapped in React `cache`, which is request-scoped: the layout, the page and
 * every action in a single request share one round trip, and nothing is carried
 * between requests or between users. Deliberately not `unstable_cache` — an
 * authorization result must never outlive the request that produced it.
 */
export const resolveAdminAccess = cache(async (): Promise<AdminAccess> => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return decideAccess({ user: null, userError: userError ?? undefined })
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role, is_active, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle()

  if (roleError) {
    // A failed role read is not a revoked administrator. Say so, and let the
    // caller render an error rather than navigate somewhere on a guess.
    console.error("[admin] user_roles read failed:", roleError)
    return decideAccess({ user, roleRow: null, roleError })
  }

  // The display name is cosmetic; a failure here must not affect the verdict.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  return decideAccess({ user, roleRow, profileName: profile?.full_name ?? null })
})

/**
 * Resolves the acting administrator, or null.
 *
 * Kept for callers that genuinely only need "is there an administrator here",
 * and which handle the negative case themselves. Anything that has to *act* on
 * the answer should use `resolveAdminAccess()` so it can tell an absent
 * administrator from an unreachable database.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const access = await resolveAdminAccess()
  return access.status === "admin" ? access.session : null
}

/**
 * For server actions. Throws rather than redirecting, so the caller can turn it
 * into a form error instead of a navigation.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const access = await resolveAdminAccess()
  if (access.status === "unavailable") throw new AdminAuthUnavailableError(access.reason)
  if (access.status !== "admin") throw new AdminAuthError("unauthenticated")
  return access.session
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
 * than leaning on the layout above it, because on a soft navigation between two
 * routes in the same layout group Next.js reuses the already-rendered layout
 * from the client router cache and a layout-only guard never runs.
 *
 * The decision comes from `guardOutcome`, which is total:
 *
 *   no session                → /admin/login
 *   session, no admin role    → /admin/unauthorized
 *   admin, wrong permission   → /admin/unauthorized
 *   admin owing a password    → /admin/sifre-degistir
 *   could not be determined   → throw (stable error state, no navigation)
 *   otherwise                 → render
 *
 * Every redirect target sits outside this layout group and renders on its own,
 * so a redirect can never resolve back into the route that issued it. The
 * "could not be determined" branch is the one that keeps that true when
 * Supabase is having a bad minute: it moves nothing.
 */
export async function requireAdminPage(permission?: Permission): Promise<AdminSession> {
  const outcome = guardOutcome(await resolveAdminAccess(), permission)

  if (outcome.kind === "unavailable") throw new AdminAuthUnavailableError(outcome.reason)
  if (outcome.kind === "redirect") redirect(outcome.to)

  return outcome.session
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
