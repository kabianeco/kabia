import { test, expect, type Browser, type Page } from "@playwright/test"
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

/**
 * Development-server stability suite.
 *
 * The defect this exists to prevent is not visible in a production build and
 * not visible on `localhost`. `next dev` serves Fast Refresh over a WebSocket
 * at `/_next/webpack-hmr` and refuses that upgrade for any browser origin
 * outside its default allowlist (`localhost`, `*.localhost`). A refused
 * upgrade is not a 101, so the browser reports `ERR_INVALID_HTTP_RESPONSE`;
 * Next's HMR client retries thirteen times with backoff and then reloads the
 * document to resynchronise. The reload is blocked identically, so the tab
 * reloads about every fifty seconds until it is closed.
 *
 * Everything about that is development-only — `next start` serves no HMR
 * endpoint and runs no cross-origin dev check — and everything about it is
 * origin-dependent, which is why it survived every check performed over
 * `localhost` and against the production build.
 *
 * The suite therefore asserts on the *mechanism* first, because it is exact
 * and fast: the HMR socket must connect, and the dev server must never log a
 * blocked cross-origin request. It then spends one longer test confirming the
 * *behaviour*: over a window longer than a full reload cycle, the document is
 * requested once and the URL never moves.
 *
 * `127.0.0.1` is the origin under test throughout. It is the same machine as
 * `localhost` and was the loop's trigger; `proxy.ts` canonicalises document
 * requests from `127.0.0.1` to `localhost` before the HMR socket ever opens,
 * which is what this suite actually verifies. This project does not configure
 * Next's own `allowedDevOrigins` — only `localhost` is allowed by default, so
 * an origin that is neither `localhost` nor canonicalised to it (a LAN address,
 * `::1`) would still see the original block; that is expected, and outside
 * what this suite covers.
 *
 * Run it with `npm run test:dev-stability` (Turbopack) or
 * `npm run test:dev-stability:webpack`. Next allows one dev server per project
 * directory, so stop any `npm run dev` first; the boot helper says so if the
 * lock is held.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const BUNDLER = process.env.DEV_BUNDLER === "webpack" ? "webpack" : "turbopack"
const PORT = Number(process.env.DEV_STABILITY_PORT ?? 3413)

/**
 * The canonical development origin. `npm run dev` binds to `localhost`, so the
 * dev-stability suite drives the server over `localhost` for its
 * stabilization assertions (one document request per entry, no redirect).
 */
const CANONICAL_ORIGIN = `http://localhost:${PORT}`

/**
 * The IPv4 loopback origin. The canonical-origin middleware redirects
 * `127.0.0.1` document requests to `localhost` once, so the suite verifies
 * that redirect separately.
 */
const REDIRECT_ORIGIN = `http://127.0.0.1:${PORT}`

/**
 * Longer than one full reload cycle. The observed cycle was ~42s under webpack
 * and ~50s under Turbopack (thirteen backoff attempts, then the reload), so a
 * 70s window contains at least one reload if the loop is back.
 */
const RELOAD_CYCLE_WINDOW_MS = 70_000

const projectRoot = path.resolve(__dirname, "..")

interface DevServer {
  stop: () => void
  output: () => string
}

let dev: DevServer

/**
 * Start `next dev` and wait for it to answer.
 *
 * `detached: true` puts the server in its own process group so `stop()` can
 * signal the whole group. `next dev` runs the actual server in a grandchild;
 * signalling only the process we spawned leaves that grandchild listening,
 * holding both the port and Next's one-dev-server-per-directory lock, which
 * makes every subsequent run of this suite hang instead of fail.
 */
async function bootDevServer(): Promise<DevServer> {
  const bin = path.join(projectRoot, "node_modules", ".bin", "next")
  // Bind to 0.0.0.0 so 127.0.0.1 is reachable (the canonical-origin redirect
  // target, localhost, also resolves to 127.0.0.1 on this stack). Using
  // --hostname localhost would bind to ::1 (IPv6) on macOS, which prevents
  // the 127.0.0.1 redirect from being exercised.
  const args = ["dev", "--hostname", "0.0.0.0", "-p", String(PORT)]
  if (BUNDLER === "webpack") args.push("--webpack")

  const child = spawn(bin, args, {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, FORCE_COLOR: "0" },
  }) as ChildProcessWithoutNullStreams

  let buffer = ""
  child.stdout.on("data", (chunk) => (buffer += String(chunk)))
  child.stderr.on("data", (chunk) => (buffer += String(chunk)))

  const stop = () => {
    try {
      if (child.pid) process.kill(-child.pid, "SIGKILL")
    } catch {
      child.kill("SIGKILL")
    }
  }

  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    if (/Another next dev server is already running/.test(buffer)) {
      stop()
      throw new Error(
        "Next allows one dev server per project directory. Stop `npm run dev` and re-run this suite.",
      )
    }
    if (child.exitCode !== null) {
      throw new Error(`next dev exited early (${child.exitCode}):\n${buffer}`)
    }
    try {
      // 0.0.0.0 binds to all IPv4; 127.0.0.1 is the direct check.
      const response = await fetch(`${REDIRECT_ORIGIN}/magaza`)
      if (response.ok) return { stop, output: () => buffer }
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  stop()
  throw new Error(`next dev (${BUNDLER}) did not become ready within 90s:\n${buffer}`)
}

interface TestAccount {
  id: string
  session: Session
}

let service: SupabaseClient | undefined
let admin: TestAccount | undefined

const hasCredentials = Boolean(supabaseUrl && anonKey && serviceKey)

function sessionCookie(session: Session) {
  const projectRef = new URL(supabaseUrl!).hostname.split(".")[0]
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
    domain: "localhost",
    path: "/",
    sameSite: "Lax" as const,
  }
}

async function contextFor(browser: Browser, account?: TestAccount) {
  const context = await browser.newContext({ baseURL: CANONICAL_ORIGIN })
  if (account) await context.addCookies([sessionCookie(account.session)])
  return context
}

interface DevTrace {
  documents: string[]
  rsc: string[]
  /** Every `[HMR] connected` the page logged. */
  hmrConnected: number
  /** Failed WebSocket handshakes — the loop's proximate cause. */
  socketFailures: string[]
  fastRefreshRebuilds: number
  previewCookieWrites: string[]
  authEvents: string[]
}

function traceDev(page: Page): DevTrace {
  const trace: DevTrace = {
    documents: [],
    rsc: [],
    hmrConnected: 0,
    socketFailures: [],
    fastRefreshRebuilds: 0,
    previewCookieWrites: [],
    authEvents: [],
  }

  page.on("request", (request) => {
    if (request.resourceType() === "document") {
      trace.documents.push(new URL(request.url()).pathname)
      return
    }
    if (request.headers().rsc === "1" || request.url().includes("_rsc=")) {
      trace.rsc.push(new URL(request.url()).pathname)
    }
    if (new URL(request.url()).pathname.includes("/auth/v1/token")) {
      trace.authEvents.push(request.url())
    }
  })

  page.on("websocket", (ws) => {
    ws.on("socketerror", (error) => trace.socketFailures.push(`${ws.url()} :: ${error}`))
  })

  page.on("console", (message) => {
    const text = message.text()
    if (text.includes("[HMR] connected")) trace.hmrConnected += 1
    if (text.includes("[Fast Refresh] rebuilding")) trace.fastRefreshRebuilds += 1
    if (text.includes("WebSocket connection to")) trace.socketFailures.push(text)
  })

  page.on("response", async (response) => {
    const cookies = await response.headerValues("set-cookie").catch(() => [])
    for (const cookie of cookies) {
      if (cookie.includes("kabia_appearance_preview")) trace.previewCookieWrites.push(cookie)
    }
  })

  return trace
}

/**
 * Load, then wait for the page to stop producing requests of its own.
 *
 * Navigation errors are swallowed deliberately. When the loop is present the
 * page reloads underneath the pending `goto`, which aborts it — and a test that
 * died there would report a navigation timeout instead of the reason. Letting
 * the load fail quietly puts the assertions below in charge of the verdict, so
 * a regression names itself: a refused Fast Refresh socket.
 */
async function enterAndSettle(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => {})
  await page.waitForLoadState("networkidle").catch(() => {})
}

test.describe(`development server stability (${BUNDLER})`, () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    dev = await bootDevServer()

    if (!hasCredentials) return
    service = createClient(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const email = `dev-stability-${Date.now()}-${Math.random().toString(36).slice(2)}@kabia.local`
    const password = `De${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}!9`
    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (created.error) throw created.error
    const role = await service.from("user_roles").upsert({
      user_id: created.data.user.id,
      role: "admin",
      is_active: true,
      must_change_password: false,
    })
    if (role.error) throw role.error
    const anon = createClient(supabaseUrl!, anonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const signedIn = await anon.auth.signInWithPassword({ email, password })
    if (signedIn.error || !signedIn.data.session) {
      throw signedIn.error ?? new Error("No session returned")
    }
    admin = { id: created.data.user.id, session: signedIn.data.session }
  })

  test.afterAll(async () => {
    if (service && admin) {
      await service.from("user_roles").delete().eq("user_id", admin.id)
      await service.auth.admin.deleteUser(admin.id)
    }
    dev?.stop()
  })

  test("the dev server accepts the Fast Refresh socket from the browser's origin", async ({
    browser,
  }) => {
    const context = await contextFor(browser)
    const page = await context.newPage()
    const trace = traceDev(page)

    await enterAndSettle(page, "/magaza")
    await expect.poll(() => trace.hmrConnected, { timeout: 20_000 }).toBeGreaterThan(0)

    // The regression, stated exactly: a refused upgrade is what starts the loop.
    expect(trace.socketFailures).toEqual([])
    expect(dev.output()).not.toContain("Blocked cross-origin request")

    await context.close()
  })

  test("127.0.0.1 canonicalises once to localhost and the HMR socket connects", async ({
    browser,
  }) => {
    // A context pointed at the IPv4 loopback, not localhost. The canonical-
    // origin middleware must redirect the document request once to localhost,
    // and the HMR client — now on localhost — must receive a 101.
    const context = await browser.newContext({ baseURL: REDIRECT_ORIGIN })
    const page = await context.newPage()
    const trace = traceDev(page)

    await enterAndSettle(page, "/magaza")

    // The URL moved from 127.0.0.1 to localhost — exactly one redirect.
    expect(new URL(page.url()).hostname).toBe("localhost")
    expect(new URL(page.url()).pathname).toBe("/magaza")

    // Two document requests: the 307 redirect and the 200 final.
    expect(trace.documents).toEqual(["/magaza", "/magaza"])

    // The HMR WebSocket connected on the canonical origin — no rejection.
    await expect.poll(() => trace.hmrConnected, { timeout: 20_000 }).toBeGreaterThan(0)
    expect(trace.socketFailures).toEqual([])
    expect(dev.output()).not.toContain("Blocked cross-origin request")

    await context.close()
  })

  test("/magaza stabilises on direct entry and on hard refresh", async ({ browser }) => {
    const context = await contextFor(browser)
    const page = await context.newPage()
    const trace = traceDev(page)

    await enterAndSettle(page, "/magaza")
    expect(new URL(page.url()).pathname).toBe("/magaza")
    expect(trace.documents).toEqual(["/magaza"])
    expect(trace.rsc).toEqual([])

    trace.documents.length = 0
    trace.rsc.length = 0
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})
    expect(trace.documents).toEqual(["/magaza"])
    expect(trace.rsc).toEqual([])
    expect(trace.socketFailures).toEqual([])

    await context.close()
  })

  test("/admin/appearance stabilises on direct entry and on hard refresh", async ({
    browser,
  }) => {
    test.skip(!hasCredentials, "needs Supabase test credentials")
    const context = await contextFor(browser, admin)
    const page = await context.newPage()
    const trace = traceDev(page)

    await enterAndSettle(page, "/admin/appearance")
    expect(new URL(page.url()).pathname).toBe("/admin/appearance")
    expect(trace.documents).toEqual(["/admin/appearance"])
    expect(trace.rsc).toEqual([])

    trace.documents.length = 0
    trace.rsc.length = 0
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle").catch(() => {})
    expect(trace.documents).toEqual(["/admin/appearance"])
    expect(trace.rsc).toEqual([])

    // A read path writes nothing: no preview cookie, no token rotation.
    expect(trace.previewCookieWrites).toEqual([])
    expect(trace.authEvents).toEqual([])
    expect(trace.socketFailures).toEqual([])

    await context.close()
  })

  test("both routes hold still for longer than one reload cycle", async ({ browser }) => {
    test.setTimeout(RELOAD_CYCLE_WINDOW_MS * 2 + 60_000)

    const context = await contextFor(browser, hasCredentials ? admin : undefined)

    const store = await context.newPage()
    const storeTrace = traceDev(store)
    await enterAndSettle(store, "/magaza")

    const appearanceRoute = hasCredentials ? "/admin/appearance" : "/"
    const appearance = await context.newPage()
    const appearanceTrace = traceDev(appearance)
    await enterAndSettle(appearance, appearanceRoute)

    const storeUrl = store.url()
    const appearanceUrl = appearance.url()
    storeTrace.documents.length = 0
    appearanceTrace.documents.length = 0

    // The observation window: nothing is touched, so nothing should happen.
    await store.waitForTimeout(RELOAD_CYCLE_WINDOW_MS)

    // Bounded, and the bound is zero: after settling, an idle tab makes no
    // further document or Flight requests at all.
    expect(storeTrace.documents).toEqual([])
    expect(storeTrace.rsc).toEqual([])
    expect(appearanceTrace.documents).toEqual([])
    expect(appearanceTrace.rsc).toEqual([])

    // The URL never moved, and no session was rotated to get there.
    expect(store.url()).toBe(storeUrl)
    expect(appearance.url()).toBe(appearanceUrl)
    expect(storeTrace.authEvents).toEqual([])
    expect(appearanceTrace.authEvents).toEqual([])
    expect(appearanceTrace.previewCookieWrites).toEqual([])

    // And the transport that would have caused it stayed up the whole time.
    expect(storeTrace.socketFailures).toEqual([])
    expect(appearanceTrace.socketFailures).toEqual([])
    expect(dev.output()).not.toContain("Blocked cross-origin request")

    await context.close()
  })

  test("editing a rendered component is one Fast Refresh, not a reload", async ({ browser }) => {
    test.setTimeout(120_000)

    const context = await contextFor(browser)
    const page = await context.newPage()
    const trace = traceDev(page)
    await enterAndSettle(page, "/magaza")
    await expect.poll(() => trace.hmrConnected, { timeout: 20_000 }).toBeGreaterThan(0)

    const target = path.join(projectRoot, "components", "shop", "product-entry.tsx")
    const original = readFileSync(target, "utf8")
    const urlBefore = page.url()
    trace.documents.length = 0

    try {
      writeFileSync(target, `${original}\n// dev-stability probe\n`)
      await expect.poll(() => trace.fastRefreshRebuilds, { timeout: 45_000 }).toBeGreaterThan(0)
      await page.waitForTimeout(8_000)

      // Fast Refresh replaces modules in place. A document request here would
      // mean a full reload, which is the symptom the loop was made of.
      expect(trace.documents).toEqual([])
      expect(page.url()).toBe(urlBefore)
      expect(trace.socketFailures).toEqual([])
      // The page is still alive and rendering, not sitting on an error overlay.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    } finally {
      writeFileSync(target, original)
    }

    await page.waitForTimeout(5_000)
    await context.close()
  })
})
