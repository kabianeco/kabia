/**
 * Direct-entry regression tests for every protected admin route.
 *
 * The defect these guard against: pasting an admin URL into the address bar
 * could put the browser into an endless refresh. Navigating to the same route
 * from inside the dashboard was fine. The asymmetry was the tell — only a fresh
 * document request runs `proxy.ts` *and* the protected layout, and those two
 * layers each ran their own Supabase lookup and each treated a failed lookup as
 * a definite "not signed in". One of them redirected /admin → /admin/login, the
 * other redirected /admin/login → /admin, and a browser handed both answers in
 * turn walked between them forever.
 *
 * So the assertions here are about *bounds*, not just destinations. A test that
 * only checked the final URL would have passed throughout the entire life of
 * the bug, because every individual hop was correct. What was wrong was that
 * there were infinitely many of them.
 *
 * Every route is checked in every authorization state, because the loop was
 * never specific to /admin — it was a property of the redirect graph, and any
 * route that entered the graph inherited it.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (to create throwaway accounts) and a
 * running server on ADMIN_ENTRY_BASE_URL, default http://127.0.0.1:3000.
 * Skips cleanly when either is absent, so `npm test` stays green without them.
 */
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"

const BASE = process.env.ADMIN_ENTRY_BASE_URL ?? process.env.ROLE_REVOCATION_BASE_URL ?? "http://127.0.0.1:3000"
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const projectRef = URL_ ? new URL(URL_).hostname.split(".")[0] : null
const COOKIE = projectRef ? `sb-${projectRef}-auth-token` : null

/** Every protected route, plus the two terminal screens outside the group. */
const PROTECTED_ROUTES = [
  "/admin",
  "/admin/products",
  "/admin/products/new",
  "/admin/categories",
  "/admin/inventory",
  "/admin/orders",
  "/admin/customers",
  "/admin/media",
  "/admin/content",
  "/admin/settings",
  "/admin/administrators",
  "/admin/audit-logs",
  "/admin/appearance",
  "/admin/appearance/preview",
  "/admin/search",
]

const TERMINAL_ROUTES = ["/admin/login", "/admin/unauthorized"]

/**
 * The full-site theme preview has a third gate beyond session and role: a
 * short-lived `kabia_appearance_preview` cookie, issued by the editor. Opened
 * cold it therefore redirects an otherwise valid administrator back to the
 * editor — once, to a page that renders. That is the designed behaviour, not a
 * loop, so it is asserted here rather than excluded.
 */
const COOKIE_GATED_ROUTES = { "/admin/appearance/preview": "/admin/appearance" }

const DIRECTLY_RENDERED_ROUTES = PROTECTED_ROUTES.filter(
  (route) => !(route in COOKIE_GATED_ROUTES),
)

const ADMIN_EMAIL = "direct-entry-admin@kabia.local"
const CUSTOMER_EMAIL = "direct-entry-customer@kabia.local"
const SUPER_EMAIL = "direct-entry-super@kabia.local"

function password() {
  return `De${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}!9`
}

/** The session cookie exactly as @supabase/ssr writes it. */
function sessionCookie(session) {
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  }
  return `${COOKIE}=base64-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`
}

/**
 * A redirect Next could not send as a status code.
 *
 * Pages in this group sit under `loading.tsx`, so Next flushes the shell as
 * soon as the layout resolves. A `redirect()` raised by the *page* after that
 * flush cannot become a 307 — the headers are already gone — so it is
 * serialised into the flight stream and the client router performs it. The
 * browser ends up in the same place; the response is just a 200 on the way.
 * Following it here keeps the hop counts below honest, instead of scoring a
 * streamed redirect as "settled".
 */
function streamedRedirect(body) {
  const match = body.match(/NEXT_REDIRECT;[^;]*;([^;]+);/)
  return match ? match[1] : null
}

/**
 * Follows redirects by hand — status-code and streamed alike — and records
 * every hop.
 *
 * `max` is deliberately generous: the point is not to stop early but to let a
 * loop prove itself, so a failure message can show the alternation.
 */
async function follow(path, cookie, max = 15) {
  const chain = []
  let url = new URL(path, BASE).toString()
  for (let i = 0; i < max; i++) {
    const res = await fetch(url, {
      headers: cookie ? { cookie, accept: "text/html" } : { accept: "text/html" },
      redirect: "manual",
    })
    const pathname = new URL(url).pathname
    chain.push(pathname)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) break
      url = new URL(location, BASE).toString()
      continue
    }

    const body = await res.text()
    const streamed = res.status === 200 ? streamedRedirect(body) : null
    if (streamed) {
      url = new URL(streamed, BASE).toString()
      continue
    }

    return {
      chain,
      final: new URL(url).pathname,
      finalUrl: new URL(url),
      status: res.status,
      body,
      hitCap: false,
    }
  }
  return { chain, final: new URL(url).pathname, status: 0, body: "", hitCap: true }
}

/** The property the bug violated: no URL may appear twice in one chain. */
function assertNoAlternation(result, label) {
  assert.equal(
    result.hitCap,
    false,
    `${label}: redirect chain never settled — ${result.chain.join(" -> ")}`,
  )
  const seen = new Set()
  for (const step of result.chain) {
    assert.ok(
      !seen.has(step),
      `${label}: ${step} was requested twice in one chain — ${result.chain.join(" -> ")}`,
    )
    seen.add(step)
  }
}

async function serverReachable() {
  try {
    const res = await fetch(`${BASE}/admin/login`, { redirect: "manual" })
    return res.status > 0
  } catch {
    return false
  }
}

const ready = Boolean(URL_ && ANON && SERVICE && (await serverReachable()))

describe(
  "admin direct entry",
  { skip: ready ? false : "needs Supabase credentials and a running server" },
  () => {
    let admin
    let accounts = {}
    let cookies = {}

    before(async () => {
      admin = createClient(URL_, SERVICE, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const make = async (email, role) => {
        const pw = password()
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
        const existing = list?.users.find((u) => u.email?.toLowerCase() === email)
        if (existing) {
          await admin.from("user_roles").delete().eq("user_id", existing.id)
          await admin.auth.admin.deleteUser(existing.id)
        }
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: pw,
          email_confirm: true,
          user_metadata: { full_name: "Giriş Testi" },
        })
        if (error) throw new Error(`${email}: ${error.message}`)
        if (role) {
          await admin.from("user_roles").upsert(
            { user_id: data.user.id, role, is_active: true, must_change_password: false },
            { onConflict: "user_id" },
          )
        }
        const anon = createClient(URL_, ANON, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
          email,
          password: pw,
        })
        if (signInError) throw new Error(`${email} sign-in: ${signInError.message}`)
        return { id: data.user.id, email, password: pw, session: signIn.session }
      }

      accounts.superAdmin = await make(SUPER_EMAIL, "super_admin")
      accounts.admin = await make(ADMIN_EMAIL, "admin")
      // A real customer account: authenticated, with no administrative role.
      accounts.customer = await make(CUSTOMER_EMAIL, null)

      cookies.superAdmin = sessionCookie(accounts.superAdmin.session)
      cookies.admin = sessionCookie(accounts.admin.session)
      cookies.customer = sessionCookie(accounts.customer.session)
    })

    after(async () => {
      if (!admin) return
      for (const account of Object.values(accounts)) {
        if (!account) continue
        await admin.from("user_roles").delete().eq("user_id", account.id)
        await admin.auth.admin.deleteUser(account.id)
      }
    })

    describe("a valid super administrator", () => {
      for (const route of DIRECTLY_RENDERED_ROUTES) {
        it(`serves ${route} on a single document request`, async () => {
          const result = await follow(route, cookies.superAdmin)
          assertNoAlternation(result, route)
          assert.equal(
            result.chain.length,
            1,
            `${route} should not redirect at all — ${result.chain.join(" -> ")}`,
          )
          assert.equal(result.status, 200, `${route} returned ${result.status}`)
        })
      }

      for (const [route, target] of Object.entries(COOKIE_GATED_ROUTES)) {
        it(`sends ${route} to ${target} once when its own cookie is absent`, async () => {
          const result = await follow(route, cookies.superAdmin)
          assertNoAlternation(result, route)
          assert.equal(result.final, target, `${route} -> ${result.chain.join(" -> ")}`)
          assert.equal(result.chain.length, 2, `${route} took ${result.chain.length} hops`)
          assert.equal(result.status, 200, `${target} must render, not redirect again`)
        })
      }

      it("stays on one request when the same route is opened repeatedly", async () => {
        // A hard refresh, four times over. A chain that grows, or a route that
        // starts redirecting on the second visit, is the loop reappearing.
        for (let i = 0; i < 4; i += 1) {
          const result = await follow("/admin", cookies.superAdmin)
          assert.equal(
            result.chain.length,
            1,
            `visit ${i + 1} redirected: ${result.chain.join(" -> ")}`,
          )
        }
      })
    })

    describe("an unauthenticated stranger", () => {
      for (const route of PROTECTED_ROUTES) {
        it(`sends ${route} to the login page in exactly one redirect`, async () => {
          const result = await follow(route, null)
          assertNoAlternation(result, route)
          assert.equal(result.final, "/admin/login", `${route} -> ${result.chain.join(" -> ")}`)
          assert.equal(result.chain.length, 2, `${route} took ${result.chain.length} hops`)
          assert.equal(result.status, 200, "the login page must render, not redirect again")
          assert.ok(
            !result.body.includes("Denetim Kayıtları"),
            `${route} leaked admin navigation to a stranger`,
          )
        })
      }

      it("keeps the login page itself stable", async () => {
        const result = await follow("/admin/login", null)
        assert.equal(result.chain.length, 1)
        assert.equal(result.status, 200)
      })
    })

    describe("an authenticated non-administrator", () => {
      for (const route of PROTECTED_ROUTES) {
        it(`sends ${route} to the unauthorized page in exactly one redirect`, async () => {
          const result = await follow(route, cookies.customer)
          assertNoAlternation(result, route)
          assert.equal(
            result.final,
            "/admin/unauthorized",
            `${route} -> ${result.chain.join(" -> ")}`,
          )
          assert.equal(result.chain.length, 2, `${route} took ${result.chain.length} hops`)
          assert.equal(result.status, 200, "the unauthorized page must render, not redirect again")
          assert.ok(
            !result.body.includes("Denetim Kayıtları"),
            `${route} leaked admin navigation to a customer`,
          )
        })
      }

      it("keeps the unauthorized page stable rather than bouncing to /admin", async () => {
        const result = await follow("/admin/unauthorized", cookies.customer)
        assert.equal(result.chain.length, 1)
        assert.equal(result.status, 200)
      })
    })

    /**
     * The edge that closed the cycle.
     *
     * `proxy.ts` used to redirect /admin/login → /admin for anyone holding a
     * session, on the reasoning that a signed-in administrator has no use for
     * the login screen. That is the only automatic edge that ever pointed *into*
     * the guarded area, and it is what let a wrong "you are signed out" verdict
     * from the layout bounce back and forth. The login page now renders a link
     * instead. If this test fails, the cycle has been reintroduced.
     */
    describe("the login page never redirects into the dashboard", () => {
      for (const [label, key] of [
        ["a super administrator", "superAdmin"],
        ["a plain administrator", "admin"],
        ["a customer", "customer"],
      ]) {
        it(`renders for ${label} instead of redirecting`, async () => {
          const result = await follow("/admin/login", cookies[key])
          assert.equal(
            result.chain.length,
            1,
            `/admin/login redirected ${label}: ${result.chain.join(" -> ")}`,
          )
          assert.equal(result.status, 200)
        })
      }

      it("offers a signed-in administrator a link rather than moving them", async () => {
        const result = await follow("/admin/login", cookies.superAdmin)
        assert.ok(
          result.body.includes("Panele git") || result.body.includes("Zaten giriş yaptınız"),
          "a signed-in administrator should be told they are signed in",
        )
      })
    })

    describe("every terminal screen is genuinely terminal", () => {
      for (const route of TERMINAL_ROUTES) {
        for (const key of ["superAdmin", "admin", "customer", null]) {
          it(`${route} settles for ${key ?? "an anonymous visitor"}`, async () => {
            const result = await follow(route, key ? cookies[key] : null)
            assertNoAlternation(result, route)
            assert.equal(
              result.chain.length,
              1,
              `${route} redirected: ${result.chain.join(" -> ")}`,
            )
          })
        }
      }
    })

    describe("live role revocation and restoration", () => {
      it("denies every route in one redirect once the role is revoked", async () => {
        // Context B — an independent super_admin session — performs the
        // downgrade through RLS, exactly as the dashboard action does.
        const contextB = createClient(URL_, ANON, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        await contextB.auth.signInWithPassword({
          email: accounts.superAdmin.email,
          password: accounts.superAdmin.password,
        })
        const { error } = await contextB
          .from("user_roles")
          .update({ is_active: false })
          .eq("user_id", accounts.admin.id)
        assert.equal(error, null, "super admin B must be able to revoke A")

        for (const route of PROTECTED_ROUTES) {
          const result = await follow(route, cookies.admin)
          assertNoAlternation(result, `${route} (revoked)`)
          assert.equal(
            result.final,
            "/admin/unauthorized",
            `${route} -> ${result.chain.join(" -> ")}`,
          )
          assert.equal(
            result.chain.length,
            2,
            `${route} took ${result.chain.length} hops after revocation`,
          )
        }
      })

      it("refuses the media endpoint to the revoked administrator", async () => {
        const res = await fetch(new URL("/admin/media/api?page=1", BASE), {
          headers: { cookie: cookies.admin },
          redirect: "manual",
        })
        assert.ok(
          res.status === 401 || res.status === 403,
          `expected 401/403, got ${res.status}`,
        )
      })

      it("restores access on the next request, with the same cookie", async () => {
        const contextB = createClient(URL_, ANON, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        await contextB.auth.signInWithPassword({
          email: accounts.superAdmin.email,
          password: accounts.superAdmin.password,
        })
        const { error } = await contextB
          .from("user_roles")
          .update({ is_active: true, role: "admin" })
          .eq("user_id", accounts.admin.id)
        assert.equal(error, null, "super admin B must be able to restore A")

        // Same cookie as before: no sign-out, no cookie clearing, no cache reset.
        for (const route of ["/admin", "/admin/products", "/admin/orders", "/admin/media"]) {
          const result = await follow(route, cookies.admin)
          assertNoAlternation(result, `${route} (restored)`)
          assert.equal(
            result.chain.length,
            1,
            `${route} did not recover without clearing cookies — ${result.chain.join(" -> ")}`,
          )
          assert.equal(result.status, 200)
        }
      })
    })

    /**
     * A plain admin lacks `manageAdministrators`, so these routes must refuse
     * them — in one hop, and without the refusal itself being guarded again.
     */
    describe("a role that lacks a specific permission", () => {
      for (const route of ["/admin/administrators"]) {
        it(`refuses ${route} to a plain administrator in one redirect`, async () => {
          const result = await follow(route, cookies.admin)
          assertNoAlternation(result, route)
          assert.equal(result.final, "/admin/unauthorized")
          assert.ok(
            result.chain.length <= 2,
            `${route} took ${result.chain.length} hops — ${result.chain.join(" -> ")}`,
          )
        })
      }
    })

    /**
     * A session past its expiry is the state every returning administrator's
     * browser is in, and it is the one that made the bug look random: the
     * refresh only happens once an hour, so most visits never exercised it.
     */
    describe("a session that needs refreshing", () => {
      it("refreshes once and serves the page, without a redirect", async () => {
        const stale = {
          ...accounts.superAdmin.session,
          expires_at: Math.floor(Date.now() / 1000) - 60,
          expires_in: 0,
        }
        const result = await follow("/admin/products", sessionCookie(stale))
        assertNoAlternation(result, "/admin/products (stale token)")
        assert.equal(
          result.chain.length,
          1,
          `a refreshable session should not redirect — ${result.chain.join(" -> ")}`,
        )
        assert.equal(result.status, 200)
      })
    })
  },
)
