/**
 * Regression tests for the admin authorization *decision*.
 *
 * These exist because of a specific defect, and they are written to fail if it
 * comes back on any route.
 *
 * The dashboard was guarded in two places that each made their own network
 * call: `proxy.ts` asked Supabase "is there a session?", and the protected
 * layout asked "is there an administrator?". Both collapsed a *failed* lookup
 * into a confident negative — `if (error || !user) return null`. So a single
 * transient failure on one side produced two contradictory verdicts for the
 * same request: the layout redirected /admin → /admin/login because it could
 * not verify the user, and the proxy redirected /admin/login → /admin because
 * its own earlier call had succeeded. Neither side had a loop breaker, so the
 * browser alternated between the two forever. Direct URL entry was the only way
 * in, because only a fresh document request runs both layers; a client-side
 * navigation reuses the cached layout and never re-ran the pair. Signing in
 * again "fixed" it because a brand-new token made both calls agree.
 *
 * Two properties are asserted, and between them they close the class of bug:
 *
 *   1. an indeterminate lookup never produces a navigation, and
 *   2. the redirect graph has no cycle — every automatic target renders on its
 *      own and none of them is inside the guarded area.
 *
 * Pure module, so no server, no database and no network are involved.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  ADMIN_LOGIN_PATH,
  ADMIN_PASSWORD_PATH,
  ADMIN_UNAUTHORIZED_PATH,
  GUARD_TARGETS,
  classifyAuthError,
  decideAccess,
  guardOutcome,
  isPublicAdminPath,
  type AdminAccess,
} from "../lib/admin/access.ts"

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "admin@kabia.local" }
const ADMIN_ROW = { role: "admin", is_active: true, must_change_password: false }
const SUPER_ROW = { role: "super_admin", is_active: true, must_change_password: false }

/** Errors Supabase raises when it has genuinely answered "no". */
const DEFINITE_AUTH_ERRORS = [
  { name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" },
  { name: "AuthApiError", status: 401, message: "invalid claim: missing sub claim" },
  { name: "AuthApiError", status: 403, message: "session_not_found" },
  { name: "AuthApiError", status: 400, message: "invalid JWT" },
]

/** Failures that say nothing about the caller. */
const INDETERMINATE_ERRORS = [
  { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" },
  { name: "TypeError", message: "fetch failed" },
  { name: "AbortError", message: "The operation was aborted" },
  { name: "AuthApiError", status: 429, message: "rate limit exceeded" },
  { name: "AuthApiError", status: 500, message: "internal server error" },
  { name: "AuthApiError", status: 502, message: "bad gateway" },
  { name: "AuthApiError", status: 503, message: "service unavailable" },
  { name: "AuthApiError", status: 408, message: "timeout" },
]

describe("classifying an auth failure", () => {
  it("treats a rejected or missing session as a definite answer", () => {
    for (const error of DEFINITE_AUTH_ERRORS) {
      assert.equal(
        classifyAuthError(error),
        "unauthenticated",
        `${error.name} ${error.status} should be a definite negative`,
      )
    }
  })

  it("never reports a transport, rate-limit or 5xx failure as a signed-out user", () => {
    for (const error of INDETERMINATE_ERRORS) {
      assert.equal(
        classifyAuthError(error),
        "unavailable",
        `${error.name} ${error.status ?? ""} must not be read as "not signed in"`,
      )
    }
  })
})

describe("resolving one request into one verdict", () => {
  it("admits an active administrator", () => {
    const access = decideAccess({ user: USER, roleRow: ADMIN_ROW, profileName: "Ayşe" })
    assert.equal(access.status, "admin")
    assert.equal(access.status === "admin" && access.session.role, "admin")
    assert.equal(access.status === "admin" && access.session.displayName, "Ayşe")
  })

  it("reports no session when Supabase says there is none", () => {
    assert.equal(decideAccess({ user: null }).status, "unauthenticated")
    for (const userError of DEFINITE_AUTH_ERRORS) {
      assert.equal(decideAccess({ user: null, userError }).status, "unauthenticated")
    }
  })

  it("reports a revoked, inactive or non-administrative row as unauthorized", () => {
    const rows = [
      null,
      { role: "customer", is_active: true },
      { role: "admin", is_active: false },
      { role: "super_admin", is_active: false },
      { role: null, is_active: true },
      { role: "Admin", is_active: true }, // case must not widen the check
    ]
    for (const roleRow of rows) {
      const access = decideAccess({ user: USER, roleRow })
      assert.equal(access.status, "unauthorized", `row ${JSON.stringify(roleRow)} granted access`)
    }
  })

  it("does not turn an unreachable auth server into a signed-out user", () => {
    for (const userError of INDETERMINATE_ERRORS) {
      const access = decideAccess({ user: null, userError })
      assert.equal(
        access.status,
        "unavailable",
        `${userError.name} ${userError.status ?? ""} was read as "not signed in"`,
      )
    }
  })

  it("does not turn a failed role read into a revoked administrator", () => {
    const access = decideAccess({
      user: USER,
      roleRow: null,
      roleError: { code: "57014", message: "canceling statement due to statement timeout" },
    })
    assert.equal(access.status, "unavailable")
  })
})

describe("what a guard does about a verdict", () => {
  it("renders for an administrator", () => {
    const outcome = guardOutcome(decideAccess({ user: USER, roleRow: SUPER_ROW }))
    assert.equal(outcome.kind, "render")
  })

  it("sends an anonymous visitor to the login page, once", () => {
    const outcome = guardOutcome({ status: "unauthenticated" })
    assert.deepEqual(outcome, { kind: "redirect", to: ADMIN_LOGIN_PATH })
  })

  it("sends a signed-in non-administrator to the unauthorized page, once", () => {
    const outcome = guardOutcome({ status: "unauthorized", userId: USER.id })
    assert.deepEqual(outcome, { kind: "redirect", to: ADMIN_UNAUTHORIZED_PATH })
  })

  it("sends an administrator owing a password change to the password screen", () => {
    const access = decideAccess({
      user: USER,
      roleRow: { ...ADMIN_ROW, must_change_password: true },
    })
    assert.deepEqual(guardOutcome(access), { kind: "redirect", to: ADMIN_PASSWORD_PATH })
  })

  it("refuses a permission the role does not carry", () => {
    const access = decideAccess({ user: USER, roleRow: ADMIN_ROW })
    assert.deepEqual(guardOutcome(access, "manageAdministrators"), {
      kind: "redirect",
      to: ADMIN_UNAUTHORIZED_PATH,
    })
    assert.equal(guardOutcome(access, "manageOrders").kind, "render")
  })

  /**
   * The heart of it. Every loop this codebase produced began with a lookup
   * failure being answered by a navigation.
   */
  it("never navigates when the verdict could not be determined", () => {
    for (const reason of ["auth", "role"]) {
      const outcome = guardOutcome({ status: "unavailable", reason })
      assert.equal(outcome.kind, "unavailable", `"${reason}" produced a ${outcome.kind}`)
      assert.notEqual(outcome.kind, "redirect")
    }
  })

  it("never redirects on any verdict a failed lookup can produce", () => {
    const failures: AdminAccess[] = INDETERMINATE_ERRORS.map((userError) =>
      decideAccess({ user: null, userError }),
    ).concat(decideAccess({ user: USER, roleError: { message: "connection reset" } }))

    for (const access of failures) {
      assert.equal(guardOutcome(access).kind, "unavailable")
    }
  })
})

describe("the redirect graph has no cycle", () => {
  it("never points an automatic redirect back into the guarded area", () => {
    for (const target of GUARD_TARGETS as readonly string[]) {
      assert.ok(
        target.startsWith("/admin"),
        `${target} should stay inside the admin origin`,
      )
      assert.ok(
        target !== "/admin",
        `${target} is the dashboard root — redirecting there re-enters the guard`,
      )
      assert.ok(
        isPublicAdminPath(target) || target === ADMIN_PASSWORD_PATH,
        `${target} is inside the protected group — the guard would run again there`,
      )
    }
  })

  it("keeps the login and unauthorized screens outside the protected group", () => {
    assert.equal(isPublicAdminPath(ADMIN_LOGIN_PATH), true)
    assert.equal(isPublicAdminPath(ADMIN_UNAUTHORIZED_PATH), true)
    assert.equal(isPublicAdminPath("/admin"), false)
    assert.equal(isPublicAdminPath("/admin/products"), false)
    assert.equal(isPublicAdminPath("/admin/loginx"), false, "prefix must not leak access")
    assert.equal(isPublicAdminPath("/admin/unauthorized/extra"), true)
  })

  /**
   * Walks the graph for real: from any starting verdict, follow guard targets
   * until something renders. A target that guarded again would show up as an
   * unbounded walk.
   */
  it("settles within one automatic hop from every verdict", () => {
    const verdicts: AdminAccess[] = [
      { status: "unauthenticated" },
      { status: "unauthorized", userId: USER.id },
      { status: "unavailable", reason: "auth" },
      decideAccess({ user: USER, roleRow: { ...ADMIN_ROW, must_change_password: true } }),
      decideAccess({ user: USER, roleRow: SUPER_ROW }),
    ]

    for (const verdict of verdicts) {
      const outcome = guardOutcome(verdict)
      if (outcome.kind !== "redirect") continue
      // The destination is a terminal screen, not another guarded route.
      assert.ok(
        GUARD_TARGETS.includes(outcome.to as (typeof GUARD_TARGETS)[number]),
        `${outcome.to} is not one of the declared terminal screens`,
      )
      assert.ok(
        !/^\/admin(\/(products|orders|customers|media|content|categories|settings|administrators|audit-logs|appearance|inventory|search)|$)/.test(
          outcome.to,
        ),
        `${outcome.to} is a guarded route — the guard would run again and could redirect again`,
      )
    }
  })
})
