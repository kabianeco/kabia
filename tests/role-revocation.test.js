/**
 * Role-revocation regression tests, against a running server and the real
 * database.
 *
 * These exist because of a specific defect. Authorization redirects lived only
 * in the protected admin *layout*. On a soft navigation between two routes in
 * that layout group, Next.js reuses the already-rendered layout from the client
 * router cache and re-renders only the page — so the layout's guard never ran,
 * and the page's guard *threw* instead of redirecting. An administrator whose
 * role had just been revoked was left pinned inside the admin shell in an error
 * state, where every in-app link was another soft navigation that threw again.
 * Only a full document request escaped, which is why signing out or clearing
 * cookies appeared to be the fix.
 *
 * The assertions below therefore care about two things the unit tests cannot
 * see: that a revoked administrator is denied on the *next request* rather than
 * whenever their JWT expires, and that the denial is a single stable redirect
 * rather than a loop.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (to create and remove throwaway accounts)
 * and a server on ROLE_REVOCATION_BASE_URL, default http://127.0.0.1:3000.
 * Skips cleanly when either is absent, so `npm test` stays green without them.
 */
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { createClient } from "@supabase/supabase-js"

const BASE = process.env.ROLE_REVOCATION_BASE_URL ?? "http://127.0.0.1:3000"
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const A_EMAIL = "roletest-regression-a@kabia.local"
const B_EMAIL = "roletest-regression-b@kabia.local"

function password() {
  return `Rt${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}!7`
}

const projectRef = URL_ ? new URL(URL_).hostname.split(".")[0] : null
const COOKIE = projectRef ? `sb-${projectRef}-auth-token` : null

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
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64")
  return `${COOKIE}=base64-${encoded}`
}

async function serverReachable() {
  try {
    const res = await fetch(`${BASE}/admin/login`, { redirect: "manual" })
    return res.status > 0
  } catch {
    return false
  }
}

/**
 * Follows redirects by hand, capping the chain. A loop shows up as hitting the
 * cap; `chain` records exactly where it went so a failure is diagnosable.
 */
async function follow(path, cookie, max = 12) {
  const chain = []
  let url = new URL(path, BASE).toString()
  for (let i = 0; i < max; i++) {
    const res = await fetch(url, { headers: { cookie }, redirect: "manual" })
    chain.push({ url: new URL(url).pathname, status: res.status })
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) break
      url = new URL(location, BASE).toString()
      continue
    }
    return { chain, final: new URL(url).pathname, status: res.status, hitCap: false }
  }
  return { chain, final: new URL(url).pathname, status: 0, hitCap: true }
}

const ready = Boolean(URL_ && ANON && SERVICE && (await serverReachable()))

describe("admin role revocation", { skip: ready ? false : "needs Supabase credentials and a running server" }, () => {
  let admin
  let accountA
  let accountB
  let cookieA
  let clientB

  before(async () => {
    admin = createClient(URL_, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const make = async (email, role) => {
      const pw = password()
      // Remove any leftover from an interrupted run, so the test is repeatable.
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
        user_metadata: { full_name: "Rol Testi" },
      })
      if (error) throw new Error(`${email}: ${error.message}`)
      await admin.from("profiles").upsert({ id: data.user.id, full_name: "Rol Testi" }, { onConflict: "id" })
      await admin
        .from("user_roles")
        .upsert(
          { user_id: data.user.id, role, is_active: true, must_change_password: false },
          { onConflict: "user_id" },
        )
      return { id: data.user.id, email, password: pw }
    }

    accountA = await make(A_EMAIL, "admin")
    accountB = await make(B_EMAIL, "super_admin")

    const clientA = createClient(URL_, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: signIn, error } = await clientA.auth.signInWithPassword({
      email: accountA.email,
      password: accountA.password,
    })
    if (error) throw new Error(`A sign-in: ${error.message}`)
    cookieA = sessionCookie(signIn.session)

    // Browser context B: a genuinely separate authenticated session, using the
    // anon key, so its role change is governed by RLS exactly as the dashboard's
    // server action is.
    clientB = createClient(URL_, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: bError } = await clientB.auth.signInWithPassword({
      email: accountB.email,
      password: accountB.password,
    })
    if (bError) throw new Error(`B sign-in: ${bError.message}`)
  })

  after(async () => {
    if (!admin) return
    for (const account of [accountA, accountB]) {
      if (!account) continue
      await admin.from("user_roles").delete().eq("user_id", account.id)
      await admin.auth.admin.deleteUser(account.id)
    }
  })

  const setRole = async (role) => {
    const { error } = await clientB.from("user_roles").update({ role }).eq("user_id", accountA.id)
    assert.equal(error, null, `super admin B must be allowed to set role=${role}`)
  }

  it("lets an administrator open /admin directly", async () => {
    const result = await follow("/admin", cookieA)
    assert.equal(result.final, "/admin")
    assert.equal(result.status, 200)
  })

  it("denies the next /admin request after the role is revoked", async () => {
    await setRole("customer")
    const result = await follow("/admin", cookieA)
    assert.equal(
      result.final,
      "/admin/unauthorized",
      `expected one redirect to /admin/unauthorized, got ${JSON.stringify(result.chain)}`,
    )
    assert.equal(result.status, 200, "the unauthorized page must render, not redirect again")
  })

  it("reaches that state in a single redirect, with no loop", async () => {
    const result = await follow("/admin", cookieA)
    assert.equal(result.hitCap, false, `redirect loop: ${JSON.stringify(result.chain)}`)
    assert.ok(
      result.chain.length <= 2,
      `expected at most one redirect, saw ${JSON.stringify(result.chain)}`,
    )
  })

  /**
   * The regression test proper.
   *
   * A soft navigation inside the admin layout group is an RSC request, and it
   * is the *only* path the original defect affected — a full document request
   * always re-ran the layout and redirected correctly, which is exactly why the
   * bug looked like a caching or cookie problem.
   *
   * When the guard lived only in the layout, this response carried the thrown
   * AdminAuthError, the client router stayed put, and the error boundary
   * rendered inside a still-populated admin shell. Now the page's own guard
   * redirects, and the redirect is serialised into the flight payload.
   */
  for (const path of ["/admin", "/admin/products"]) {
    it(`redirects instead of throwing on a soft navigation to ${path}`, async () => {
      const res = await fetch(new URL(path, BASE), {
        headers: { cookie: cookieA, RSC: "1" },
        redirect: "manual",
      })
      const body = await res.text()

      assert.ok(
        !body.includes("AdminAuthError"),
        `${path} threw into the error boundary instead of redirecting — this is the original bug`,
      )
      assert.ok(
        body.includes("/admin/unauthorized"),
        `${path} did not redirect a revoked administrator to /admin/unauthorized`,
      )
      assert.ok(
        !body.includes("Denetim Kayıtları"),
        `${path} leaked admin navigation to a revoked administrator`,
      )
    })
  }

  it("keeps /admin/unauthorized stable rather than bouncing back to /admin", async () => {
    const result = await follow("/admin/unauthorized", cookieA)
    assert.equal(result.final, "/admin/unauthorized")
    assert.equal(result.status, 200)
    assert.equal(result.chain.length, 1, "the unauthorized page must not redirect at all")
  })

  it("denies every other admin route, not just the overview", async () => {
    for (const path of ["/admin/products", "/admin/media", "/admin/orders", "/admin/administrators"]) {
      const result = await follow(path, cookieA)
      assert.equal(
        result.final,
        "/admin/unauthorized",
        `${path} should deny a revoked administrator, got ${JSON.stringify(result.chain)}`,
      )
      assert.equal(result.hitCap, false, `${path} looped: ${JSON.stringify(result.chain)}`)
    }
  })

  it("refuses the media catalogue endpoint the product picker reads", async () => {
    const res = await fetch(new URL("/admin/media/api?page=1", BASE), {
      headers: { cookie: cookieA },
      redirect: "manual",
    })
    assert.ok(
      res.status === 401 || res.status === 403,
      `expected 401/403 for a revoked administrator, got ${res.status}`,
    )
    const body = await res.text()
    assert.ok(!body.includes("object_path"), "no catalogue rows may leak in the error body")
  })

  it("blocks media upload at the database, not only in the UI", async () => {
    const clientA = createClient(URL_, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await clientA.auth.signInWithPassword({ email: accountA.email, password: accountA.password })

    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])

    const { error: uploadError } = await clientA.storage
      .from("product-media")
      .upload(`probe/${crypto.randomUUID()}.png`, png, { contentType: "image/png" })
    assert.ok(uploadError, "a revoked administrator must not be able to upload")

    const { data: rows } = await clientA.from("media_assets").select("id").limit(1)
    assert.equal((rows ?? []).length, 0, "a revoked administrator must not read the catalogue")
  })

  it("cannot mutate products once revoked", async () => {
    const clientA = createClient(URL_, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await clientA.auth.signInWithPassword({ email: accountA.email, password: accountA.password })

    const { data: product } = await clientA.from("products").select("id, main_image_url").limit(1)
    if (!product?.length) return

    const { data: updated } = await clientA
      .from("products")
      .update({ main_image_url: product[0].main_image_url })
      .eq("id", product[0].id)
      .select("id")
    assert.equal((updated ?? []).length, 0, "RLS must reject the write")
  })

  it("restores access when the role is granted back, with the same cookies", async () => {
    await setRole("admin")
    const result = await follow("/admin", cookieA)
    assert.equal(
      result.final,
      "/admin",
      "restoring the role must work without clearing cookies or signing out",
    )
    assert.equal(result.status, 200)
  })

  it("survives a repeated request after restoration", async () => {
    const result = await follow("/admin", cookieA)
    assert.equal(result.final, "/admin")
    assert.equal(result.status, 200)
  })
})
