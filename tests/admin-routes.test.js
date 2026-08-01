/**
 * Admin route protection and secret-containment tests, against the production
 * build.
 *
 * These run without a session, which is the point: every one of them asserts
 * what an *unauthenticated* stranger gets. Run `npm run build` first — this
 * exercises `.next`, not the dev server.
 *
 * The bundle-scanning tests at the end are the ones that would catch the worst
 * possible regression: a service-role key or the admin alias reaching the
 * browser.
 */
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import path from "node:path"

const PORT = process.env.ADMIN_SMOKE_PORT ?? "3401"
const BASE = `http://127.0.0.1:${PORT}`

let server

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/admin/login`, { redirect: "manual" })
      if (res.status > 0) return
    } catch {
      // not listening yet
    }
    await sleep(500)
  }
  throw new Error(`Server did not start on ${BASE}`)
}

before(async () => {
  server = spawn("npx", ["next", "start", "-p", PORT], {
    stdio: "ignore",
    env: process.env,
  })
  await waitForServer()
})

after(() => {
  server?.kill("SIGTERM")
})

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" })
  const body = res.status < 400 ? await res.text() : ""
  return {
    status: res.status,
    body,
    location: res.headers.get("location"),
    headers: res.headers,
  }
}

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
  "/admin/search",
]

describe("anonymous visitors cannot reach the dashboard", () => {
  for (const route of PROTECTED_ROUTES) {
    it(`${route} redirects to the admin login`, async () => {
      const { status, location } = await get(route)
      assert.equal(status, 307, `${route} returned ${status}`)
      assert.ok(
        location?.startsWith("/admin/login"),
        `${route} redirected to ${location} instead of /admin/login`,
      )
    })
  }

  it("leaks no administrative content in the redirect body", async () => {
    // A 307 from Next carries the destination path as its body; that is the
    // redirect mechanism, not a leak. What must never appear is dashboard
    // content, which would mean the page rendered before the guard ran.
    const forbidden = [
      "Genel Bakış",
      "Toplam gelir",
      "Denetim Kayıtları",
      "admin@kabia.local",
      "order_number",
    ]
    for (const route of PROTECTED_ROUTES) {
      const { body } = await get(route)
      for (const needle of forbidden) {
        assert.ok(
          !body.includes(needle),
          `${route} exposed "${needle}" to an anonymous visitor`,
        )
      }
    }
  })
})

describe("the admin login screen", () => {
  it("responds 200", async () => {
    const { status } = await get("/admin/login")
    assert.equal(status, 200)
  })

  it("actually runs the route guard", async () => {
    // The header is set only inside proxy.ts, so its presence proves the guard
    // executed rather than the page merely rendering.
    const { headers } = await get("/admin/login")
    assert.equal(headers.get("x-kabia-admin-guard"), "1")
  })

  it("asks for a username rather than an email address", async () => {
    const { body } = await get("/admin/login")
    assert.match(body, /Kullanıcı adı/)
    assert.match(body, /name="identifier"/)
    assert.match(body, /name="password"/)
  })

  it("never reveals the address the alias maps to", async () => {
    const { body } = await get("/admin/login")
    assert.doesNotMatch(
      body,
      /admin@kabia\.local/,
      "the bootstrap email must never be rendered to an anonymous visitor",
    )
  })

  it("is excluded from search engines", async () => {
    const { body } = await get("/admin/login")
    assert.match(body, /noindex/)
  })
})

describe("the unauthorized screen", () => {
  it("responds 200 and explains without disclosing anything", async () => {
    const { status, body } = await get("/admin/unauthorized")
    assert.equal(status, 200)
    assert.match(body, /yetkiniz yok/i)
    assert.doesNotMatch(body, /admin@kabia\.local/)
  })
})

describe("the public store is unaffected by the admin work", () => {
  const routes = ["/", "/shop", "/sepet", "/giris", "/kayit", "/blog", "/odeme"]

  for (const route of routes) {
    it(`${route} still responds 200`, async () => {
      const { status } = await get(route)
      assert.equal(status, 200, `${route} returned ${status}`)
    })
  }

  it("still lists real products with real prices", async () => {
    const { body } = await get("/shop")
    assert.match(body, /₺\d/, "no price on the shop index")
    assert.match(body, /href="\/shop\//, "no product links on the shop index")
  })

  it("does not run the admin guard on storefront routes", async () => {
    const { headers } = await get("/shop")
    assert.equal(
      headers.get("x-kabia-admin-guard"),
      null,
      "the admin proxy matcher is leaking onto public routes",
    )
  })

  it("renders contact details from the settings table in the footer", async () => {
    const { body } = await get("/shop")
    assert.match(body, /İletişim/, "footer contact block is missing")
  })
})

/** Every JS/CSS asset the browser is served. */
function clientAssets() {
  const staticDir = path.join(process.cwd(), ".next", "static")
  if (!existsSync(staticDir)) return []
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(js|css|map)$/.test(entry)) files.push(full)
    }
  }
  walk(staticDir)
  return files
}

function readEnvValue(key) {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return null
  const match = readFileSync(envPath, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"))
  const value = match?.[1]?.trim()
  return value && value.length > 20 ? value : null
}

describe("no secret reaches the browser bundle", () => {
  it("finds client assets to scan", () => {
    assert.ok(clientAssets().length > 0, "no built client assets found — run npm run build")
  })

  it("contains no service-role key", () => {
    const secret = readEnvValue("SUPABASE_SERVICE_ROLE_KEY")
    if (!secret) return // nothing configured locally; nothing to leak

    for (const file of clientAssets()) {
      const contents = readFileSync(file, "utf8")
      assert.ok(
        !contents.includes(secret),
        `service-role key found in client asset ${path.relative(process.cwd(), file)}`,
      )
    }
  })

  it("never inlines a value for the service-role variable", () => {
    // The variable *name* legitimately appears in one place: the administrators
    // screen tells a super_admin which variable to configure when the invite
    // form is unavailable. A name is not a secret. What must never happen is a
    // value being compiled in next to it, which is what this looks for.
    const assignment = /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'`][^"'`]{20,}["'`]/
    for (const file of clientAssets()) {
      const contents = readFileSync(file, "utf8")
      assert.ok(
        !assignment.test(contents),
        `a service-role value appears to be inlined in ${path.relative(process.cwd(), file)}`,
      )
      assert.ok(
        !contents.includes("service_role"),
        `a service_role JWT claim appears in ${path.relative(process.cwd(), file)}`,
      )
    }
  })

  it("contains no admin username alias mapping", () => {
    for (const file of clientAssets()) {
      const contents = readFileSync(file, "utf8")
      assert.ok(
        !contents.includes("admin@kabia.local"),
        `bootstrap admin email found in ${path.relative(process.cwd(), file)}`,
      )
      assert.ok(
        !contents.includes("ADMIN_BOOTSTRAP_EMAIL"),
        `alias env name found in ${path.relative(process.cwd(), file)}`,
      )
    }
  })
})

describe("bootstrap credentials are not committed", () => {
  it("keeps the credentials file out of the tracked template", () => {
    const example = readFileSync(path.join(process.cwd(), ".env.example"), "utf8")
    const serviceLine = example.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)
    assert.ok(serviceLine, ".env.example should document the variable name")
    assert.equal(
      serviceLine[1].trim(),
      "",
      ".env.example must never carry a real service-role key",
    )
  })

  it("gitignores the generated credentials file", () => {
    const ignored = readFileSync(path.join(process.cwd(), ".gitignore"), "utf8")
    assert.match(ignored, /\.admin-bootstrap-credentials/)
  })
})
