import { test, expect, type Browser, type Page } from "@playwright/test"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

interface TestAccount {
  id: string
  email: string
  password: string
  session: Session
}

interface RouteTrace {
  documents: { url: string; status: number; location: string | null }[]
  rsc: string[]
  tokenRefreshes: string[]
  previewCookieWrites: string[]
}

function sessionCookie(session: Session) {
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing")
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0]
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  }
  return {
    name: `sb-${projectRef}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`,
    domain: "127.0.0.1",
    path: "/",
    sameSite: "Lax" as const,
  }
}

function previewCookie(value: string, expires?: number) {
  return {
    name: "kabia_appearance_preview",
    value,
    domain: "127.0.0.1",
    path: "/admin/appearance/preview",
    httpOnly: true,
    sameSite: "Lax" as const,
    ...(expires === undefined ? {} : { expires }),
  }
}

async function accountContext(
  browser: Browser,
  account?: TestAccount,
  appearanceCookie?: ReturnType<typeof previewCookie>,
) {
  const context = await browser.newContext()
  const cookies = [
    ...(account ? [sessionCookie(account.session)] : []),
    ...(appearanceCookie ? [appearanceCookie] : []),
  ]
  if (cookies.length) await context.addCookies(cookies)
  return context
}

function traceRoute(page: Page): RouteTrace {
  const trace: RouteTrace = {
    documents: [],
    rsc: [],
    tokenRefreshes: [],
    previewCookieWrites: [],
  }

  page.on("request", (request) => {
    if (request.resourceType() === "document") return
    if (request.headers().rsc === "1" || request.url().includes("_rsc=")) {
      const url = new URL(request.url())
      url.searchParams.delete("_rsc")
      trace.rsc.push(`${url.pathname}${url.search}`)
    }
    if (new URL(request.url()).pathname.includes("/auth/v1/token")) {
      trace.tokenRefreshes.push(request.url())
    }
  })

  page.on("response", async (response) => {
    const request = response.request()
    if (request.resourceType() === "document") {
      trace.documents.push({
        url: response.url(),
        status: response.status(),
        location: response.headers().location ?? null,
      })
    }
    const setCookies = await response.headerValues("set-cookie")
    for (const setCookie of setCookies) {
      if (setCookie.includes("kabia_appearance_preview")) {
        trace.previewCookieWrites.push(setCookie)
      }
    }
  })

  return trace
}

async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" })
  const count = page.url()
  await expect.poll(() => page.url()).toBe(count)
}

test.describe("affected routes against the production build", () => {
  test.skip(!supabaseUrl || !anonKey || !serviceKey, "needs Supabase test credentials")

  let service: SupabaseClient
  let admin: TestAccount
  let customer: TestAccount

  test.beforeAll(async () => {
    service = createClient(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const make = async (kind: "admin" | "customer"): Promise<TestAccount> => {
      const email = `affected-routes-${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}@kabia.local`
      const password = `De${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}!9`
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (created.error) throw created.error
      if (kind === "admin") {
        const role = await service.from("user_roles").upsert({
          user_id: created.data.user.id,
          role: "admin",
          is_active: true,
          must_change_password: false,
        })
        if (role.error) throw role.error
      }
      const anon = createClient(supabaseUrl!, anonKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const signedIn = await anon.auth.signInWithPassword({ email, password })
      if (signedIn.error || !signedIn.data.session) {
        throw signedIn.error ?? new Error("No session returned")
      }
      return {
        id: created.data.user.id,
        email,
        password,
        session: signedIn.data.session,
      }
    }

    admin = await make("admin")
    customer = await make("customer")
  })

  test.afterAll(async () => {
    for (const account of [admin, customer]) {
      if (!account) continue
      await service.from("user_roles").delete().eq("user_id", account.id)
      await service.auth.admin.deleteUser(account.id)
    }
  })

  test.beforeEach(async () => {
    if (service && admin) {
      await service.from("user_roles").update({ is_active: true }).eq("user_id", admin.id)
    }
  })

  test("/admin/appearance direct entry and hard refresh do not prefetch another route", async ({ browser }) => {
    const context = await accountContext(browser, admin)
    const page = await context.newPage()
    const trace = traceRoute(page)

    await gotoAndSettle(page, "/admin/appearance")
    expect(page.url()).toMatch(/\/admin\/appearance$/)
    expect(trace.documents).toHaveLength(1)
    expect(trace.documents[0].status).toBe(200)
    expect(trace.rsc).toEqual([])
    expect(trace.tokenRefreshes).toEqual([])

    trace.documents.length = 0
    trace.rsc.length = 0
    await page.reload({ waitUntil: "networkidle" })
    expect(trace.documents).toHaveLength(1)
    expect(trace.rsc).toEqual([])

    const newTab = await context.newPage()
    const newTabTrace = traceRoute(newTab)
    await gotoAndSettle(newTab, "/admin/appearance")
    expect(new URL(newTab.url()).pathname).toBe("/admin/appearance")
    expect(newTabTrace.documents).toHaveLength(1)
    expect(newTabTrace.rsc).toEqual([])

    await context.close()

    const cookieContext = await accountContext(browser, admin, previewCookie("invalid"))
    const cookiePage = await cookieContext.newPage()
    const cookieTrace = traceRoute(cookiePage)
    await gotoAndSettle(cookiePage, "/admin/appearance")
    expect(new URL(cookiePage.url()).pathname).toBe("/admin/appearance")
    expect(cookieTrace.documents).toHaveLength(1)
    expect(cookieTrace.rsc).toEqual([])
    await cookieContext.close()
  })

  test("appearance authorization has one terminal outcome for every session state", async ({ browser }) => {
    for (const [account, finalPath] of [
      [undefined, "/admin/login"],
      [customer, "/admin/unauthorized"],
    ] as const) {
      const context = await accountContext(browser, account)
      const page = await context.newPage()
      const trace = traceRoute(page)
      await gotoAndSettle(page, "/admin/appearance")
      expect(new URL(page.url()).pathname).toBe(finalPath)
      expect(trace.documents.map((entry) => entry.status)).toEqual([307, 200])
      expect(new Set(trace.documents.map((entry) => new URL(entry.url).pathname)).size).toBe(2)
      await context.close()
    }
  })

  test("revoked and restored administrators are decided from the current role row", async ({ browser }) => {
    await service.from("user_roles").update({ is_active: false }).eq("user_id", admin.id)
    let context = await accountContext(browser, admin)
    let page = await context.newPage()
    await gotoAndSettle(page, "/admin/appearance")
    expect(new URL(page.url()).pathname).toBe("/admin/unauthorized")
    await context.close()

    await service.from("user_roles").update({ is_active: true }).eq("user_id", admin.id)
    context = await accountContext(browser, admin)
    page = await context.newPage()
    await gotoAndSettle(page, "/admin/appearance")
    expect(new URL(page.url()).pathname).toBe("/admin/appearance")
    await context.close()
  })

  test("preview requires a server-verifiable unexpired cookie", async ({ browser }) => {
    let context = await accountContext(browser, admin, previewCookie("invalid"))
    let page = await context.newPage()
    let trace = traceRoute(page)
    await gotoAndSettle(page, "/admin/appearance/preview")
    expect(new URL(page.url()).pathname).toBe("/admin/appearance")
    expect(trace.documents).toHaveLength(2)
    expect(trace.documents.at(-1)?.status).toBe(200)
    expect(new Set(trace.documents.map((entry) => new URL(entry.url).pathname)).size).toBe(2)
    expect(trace.previewCookieWrites).toEqual([])
    await context.close()

    context = await accountContext(
      browser,
      admin,
      previewCookie("expired", Math.floor(Date.now() / 1000) - 60),
    )
    page = await context.newPage()
    trace = traceRoute(page)
    await gotoAndSettle(page, "/admin/appearance/preview")
    expect(new URL(page.url()).pathname).toBe("/admin/appearance")
    expect(trace.previewCookieWrites).toEqual([])
    await context.close()
  })

  test("the preview action creates one path-scoped cookie and reuses it on refresh", async ({ browser }) => {
    const context = await accountContext(browser, admin)
    const page = await context.newPage()
    const trace = traceRoute(page)
    await gotoAndSettle(page, "/admin/appearance")
    await page.getByRole("button", { name: "Tam siteyi önizle" }).click()
    await page.waitForURL(/\/admin\/appearance\/preview$/)
    await page.waitForLoadState("networkidle")

    const cookies = (await context.cookies()).filter(
      (cookie) => cookie.name === "kabia_appearance_preview",
    )
    expect(cookies).toHaveLength(1)
    expect(cookies[0].path).toBe("/admin/appearance/preview")
    await expect.poll(() => trace.previewCookieWrites.length).toBe(1)
    const value = cookies[0].value

    trace.previewCookieWrites.length = 0
    await page.reload({ waitUntil: "networkidle" })
    const refreshed = (await context.cookies()).find(
      (cookie) => cookie.name === "kabia_appearance_preview",
    )
    expect(refreshed?.value).toBe(value)
    expect(trace.previewCookieWrites).toEqual([])

    await service.from("user_roles").update({ is_active: false }).eq("user_id", admin.id)
    try {
      await page.reload({ waitUntil: "networkidle" })
      expect(new URL(page.url()).pathname).toBe("/admin/unauthorized")
      const retained = (await context.cookies()).find(
        (cookie) => cookie.name === "kabia_appearance_preview",
      )
      expect(retained?.value).toBe(value)
    } finally {
      await service.from("user_roles").update({ is_active: true }).eq("user_id", admin.id)
    }

    await gotoAndSettle(page, "/admin/appearance/preview")
    expect(new URL(page.url()).pathname).toBe("/admin/appearance/preview")
    trace.previewCookieWrites.length = 0
    await page.getByRole("button", { name: /Ön.* kapat/ }).click()
    await page.waitForURL(/\/admin\/appearance$/)
    await page.waitForLoadState("networkidle")
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name === "kabia_appearance_preview",
      ),
    ).toBe(false)
    await context.close()
  })

  test("/magaza is a native public document with no auth redirect or automatic Flight fan-out", async ({ browser }) => {
    const staleAdmin: TestAccount = {
      ...admin,
      session: {
        ...admin.session,
        expires_at: Math.floor(Date.now() / 1000) - 60,
        expires_in: 0,
      },
    }
    for (const [account, cookie] of [
      [undefined, undefined],
      [customer, undefined],
      [admin, undefined],
      [staleAdmin, undefined],
      [undefined, previewCookie("invalid")],
    ] as const) {
      const context = await accountContext(browser, account, cookie)
      const page = await context.newPage()
      const trace = traceRoute(page)
      await gotoAndSettle(page, "/magaza")
      expect(new URL(page.url()).pathname).toBe("/magaza")
      expect(trace.documents).toHaveLength(1)
      expect(trace.documents[0].status).toBe(200)
      expect(trace.rsc).toEqual([])
      expect(trace.tokenRefreshes.length).toBeLessThanOrEqual(1)

      trace.documents.length = 0
      trace.rsc.length = 0
      await page.reload({ waitUntil: "networkidle" })
      expect(trace.documents).toHaveLength(1)
      expect(trace.rsc).toEqual([])
      await context.close()
    }
  })

  test("public internal navigation and Back/Forward do not remount the document", async ({ browser }) => {
    const context = await accountContext(browser)
    const page = await context.newPage()
    const trace = traceRoute(page)
    await gotoAndSettle(page, "/")
    trace.documents.length = 0
    trace.rsc.length = 0

    await page.getByRole("link", { name: "Mağaza" }).first().click()
    await page.waitForURL(/\/magaza$/)
    await page.waitForLoadState("networkidle")
    expect(trace.documents).toEqual([])
    expect(trace.rsc.filter((path) => path === "/magaza")).toHaveLength(1)

    await page.goBack({ waitUntil: "networkidle" })
    await page.goForward({ waitUntil: "networkidle" })
    expect(new URL(page.url()).pathname).toBe("/magaza")
    expect(trace.documents).toEqual([])
    await context.close()
  })

  test("internal navigation and Back/Forward use one deliberate Flight request per transition", async ({ browser }) => {
    const context = await accountContext(browser, admin)
    const page = await context.newPage()
    const trace = traceRoute(page)
    await gotoAndSettle(page, "/admin")
    trace.rsc.length = 0
    await page.getByRole("link", { name: "Görünüm" }).first().click()
    await page.waitForURL(/\/admin\/appearance$/)
    expect(trace.rsc.filter((path) => path.startsWith("/admin/appearance"))).toHaveLength(1)
    await page.goBack({ waitUntil: "networkidle" })
    await page.goForward({ waitUntil: "networkidle" })
    expect(new URL(page.url()).pathname).toBe("/admin/appearance")
    expect(trace.documents).toHaveLength(1)
    await context.close()
  })

  test("/admin/apperance has one permanent canonical redirect and no cycle", async ({ browser }) => {
    const context = await accountContext(browser, admin)
    const page = await context.newPage()
    const trace = traceRoute(page)
    await gotoAndSettle(page, "/admin/apperance")
    expect(new URL(page.url()).pathname).toBe("/admin/appearance")
    expect(trace.documents.map((entry) => entry.status)).toEqual([308, 200])
    expect(new Set(trace.documents.map((entry) => new URL(entry.url).pathname)).size).toBe(2)
    await context.close()
  })
})
