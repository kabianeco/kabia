/**
 * The admin authorization *decision*, as pure data.
 *
 * Every layer that guards the dashboard — the proxy, the protected layout, each
 * page, each server action — must reach the same conclusion from the same
 * evidence, or the redirects they issue can point at each other. This module
 * holds that conclusion and nothing else: no Supabase client, no cookies, no
 * `redirect()`. It is therefore directly unit-testable, which is the point,
 * because the defect this file exists to prevent is not visible in any single
 * layer. It only appears when two of them disagree.
 *
 * The rule that matters:
 *
 *   A lookup that *failed* is not a negative answer.
 *
 * "Supabase said this token is invalid" and "Supabase did not answer" are
 * different facts. Collapsing them — `if (error || !user) return null` — turns
 * every network blip into a confident "you are not signed in", which the proxy
 * then contradicts on the very next request because its own call happened to
 * succeed. The result is an unbounded /admin ⇄ /admin/login alternation on a
 * perfectly valid administrator. `unavailable` exists so that failure has
 * somewhere to go that is not a lie.
 */

import { can, isAdminRole, type AdminRole, type Permission } from "@/lib/admin/roles"

/** Routes that are inside the guarded area. Redirect targets may never be one. */
export const ADMIN_ROOT = "/admin"

/** Guarded-area exits. Each is terminal: none of them redirects back inward. */
export const ADMIN_LOGIN_PATH = "/admin/login"
export const ADMIN_UNAUTHORIZED_PATH = "/admin/unauthorized"
export const ADMIN_PASSWORD_PATH = "/admin/sifre-degistir"

/**
 * The admin paths that render without an administrative role. They are outside
 * the protected layout group, so nothing above them can guard them back into it.
 */
export const PUBLIC_ADMIN_PATHS = [
  ADMIN_LOGIN_PATH,
  ADMIN_UNAUTHORIZED_PATH,
] as const

export function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export interface AdminSession {
  userId: string
  email: string
  displayName: string
  role: AdminRole
  mustChangePassword: boolean
}

/**
 * What the server knows about the caller. Four *positive* states — including
 * "we could not find out", which is a state and not a synonym for "no".
 */
export type AdminAccess =
  | { status: "admin"; session: AdminSession }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; userId: string }
  | { status: "unavailable"; reason: string }

/**
 * Did Supabase Auth *tell* us this caller has no valid session, or did the call
 * simply not succeed?
 *
 * A missing session, a rejected JWT and a revoked token are answers: 400/401/403
 * and `AuthSessionMissingError`. A transport failure, a 429 or a 5xx is not an
 * answer about the user at all — it is an answer about Supabase.
 */
export function classifyAuthError(error: unknown): "unauthenticated" | "unavailable" {
  if (!error || typeof error !== "object") return "unauthenticated"

  const name = "name" in error ? String((error as { name?: unknown }).name) : ""
  if (name === "AuthRetryableFetchError" || name === "TypeError" || name === "AbortError") {
    return "unavailable"
  }

  const status = "status" in error ? (error as { status?: unknown }).status : undefined
  if (typeof status === "number") {
    // 0 is what a fetch that never reached the server reports.
    if (status === 0 || status === 408 || status === 429 || status >= 500) return "unavailable"
    if (status >= 400) return "unauthenticated"
  }

  // An error with no usable shape is not evidence that the caller is anonymous.
  return name === "AuthSessionMissingError" || name === "AuthApiError"
    ? "unauthenticated"
    : "unavailable"
}

export interface AccessEvidence {
  user: { id: string; email?: string | null } | null
  userError?: unknown
  /** Undefined means the read was never attempted (no user to read a role for). */
  roleRow?: { role?: unknown; is_active?: unknown; must_change_password?: unknown } | null
  roleError?: unknown
  profileName?: string | null
}

/**
 * Turns one request's evidence into the single verdict every layer acts on.
 *
 * Note the asymmetry that the old code got wrong: a *failed* `user_roles` read
 * yields `unavailable`, while a read that succeeded and returned no row — or an
 * inactive or non-administrative row — yields `unauthorized`. The database
 * saying "no such administrator" and the database not answering are not the
 * same event, and only the first one is a security decision.
 */
export function decideAccess(evidence: AccessEvidence): AdminAccess {
  const { user, userError, roleRow, roleError, profileName } = evidence

  if (userError) {
    return classifyAuthError(userError) === "unavailable"
      ? { status: "unavailable", reason: "auth" }
      : { status: "unauthenticated" }
  }
  if (!user) return { status: "unauthenticated" }

  if (roleError) return { status: "unavailable", reason: "role" }

  const role = typeof roleRow?.role === "string" ? roleRow.role : null
  if (!roleRow || roleRow.is_active !== true || !isAdminRole(role)) {
    return { status: "unauthorized", userId: user.id }
  }

  const email = user.email ?? ""
  return {
    status: "admin",
    session: {
      userId: user.id,
      email,
      displayName: profileName?.trim() || email.split("@")[0] || "Yönetici",
      role,
      mustChangePassword: roleRow.must_change_password === true,
    },
  }
}

/**
 * What a *page or layout* should do about a verdict.
 *
 * Exhaustive and total, so no state can fall through to a default that happens
 * to navigate. `unavailable` deliberately has no redirect: an indeterminate
 * result must never move the browser, because moving it is precisely how a
 * transient failure becomes an infinite loop.
 */
export type GuardOutcome =
  | { kind: "render"; session: AdminSession }
  | { kind: "redirect"; to: string }
  | { kind: "unavailable"; reason: string }

export function guardOutcome(access: AdminAccess, permission?: Permission): GuardOutcome {
  switch (access.status) {
    case "unavailable":
      return { kind: "unavailable", reason: access.reason }
    case "unauthenticated":
      return { kind: "redirect", to: ADMIN_LOGIN_PATH }
    case "unauthorized":
      return { kind: "redirect", to: ADMIN_UNAUTHORIZED_PATH }
    case "admin": {
      if (access.session.mustChangePassword) {
        return { kind: "redirect", to: ADMIN_PASSWORD_PATH }
      }
      if (permission && !can(access.session.role, permission)) {
        return { kind: "redirect", to: ADMIN_UNAUTHORIZED_PATH }
      }
      return { kind: "render", session: access.session }
    }
  }
}

/**
 * Every target the guard is allowed to send a browser to.
 *
 * The loop this codebase kept regrowing was a *cycle in the redirect graph*, so
 * the property worth asserting is a graph property, not a behaviour: each of
 * these renders on its own, and none of them is inside the protected group, so
 * no automatic redirect can ever lead back to a route that redirects again.
 * `lib/admin/access.test` walks this list.
 */
export const GUARD_TARGETS = [
  ADMIN_LOGIN_PATH,
  ADMIN_UNAUTHORIZED_PATH,
  ADMIN_PASSWORD_PATH,
] as const
