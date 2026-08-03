/**
 * Public blog route tests against the production build.
 *
 * The fixture-backed suite writes real rows directly with the service-role
 * key (bypassing RLS the way only a trusted server process can) — the same
 * DB writes an admin action would produce, without needing a live admin
 * session — then asserts the security property that matters most: a draft,
 * a not-yet-due scheduled post, and an archived post must be unreachable at
 * their public URL, in the sitemap, and in the RSS feed, while a published
 * post must be reachable in all three. If SUPABASE_SERVICE_ROLE_KEY is not
 * configured locally, that suite is skipped rather than faked — matching the
 * pattern in admin-routes.test.js — while the basic route checks still run.
 *
 * Run `npm run build` first — this exercises `.next`, not the dev server.
 */
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const PORT = process.env.BLOG_SMOKE_PORT ?? "3402"
const BASE = `http://127.0.0.1:${PORT}`

function readEnvValue(key) {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return null
  const match = readFileSync(envPath, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"))
  const value = match?.[1]?.trim()
  return value && value.length > 10 ? value : null
}

const SUPABASE_URL = readEnvValue("NEXT_PUBLIC_SUPABASE_URL")
const SERVICE_ROLE_KEY = readEnvValue("SUPABASE_SERVICE_ROLE_KEY")
const canRunLiveSuite = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)

let server
let admin
const RUN_ID = Date.now()
const slugFor = (status) => `test-blog-${status}-${RUN_ID}`

const DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Test icerik." }] }],
}

function fixturePost(status, extra = {}) {
  return {
    title: `Test ${status} yazi ${RUN_ID}`,
    slug: slugFor(status),
    content_json: DOC,
    status,
    reading_time_minutes: 1,
    ...extra,
  }
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE, { redirect: "manual" })
      if (res.status > 0) return
    } catch {
      // not listening yet
    }
    await sleep(500)
  }
  throw new Error(`Server did not start on ${BASE}`)
}

async function get(pathname) {
  const res = await fetch(`${BASE}${pathname}`, { redirect: "manual" })
  const body = await res.text().catch(() => "")
  return { status: res.status, body, location: res.headers.get("location") }
}

before(async () => {
  if (canRunLiveSuite) {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const now = Date.now()
    const rows = [
      fixturePost("draft"),
      fixturePost("archived"),
      fixturePost("scheduled", { published_at: new Date(now + 24 * 60 * 60 * 1000).toISOString() }),
      fixturePost("published", { published_at: new Date(now - 60_000).toISOString() }),
    ]
    const { error } = await admin.from("blog_posts").insert(rows)
    if (error) throw new Error(`fixture insert failed: ${error.message}`)
  }

  server = spawn("npx", ["next", "start", "-p", PORT], {
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production" },
  })
  await waitForServer()
})

after(async () => {
  server?.kill("SIGTERM")
  if (admin) {
    await admin.from("blog_posts").delete().like("slug", `test-blog-%-${RUN_ID}`)
  }
})

describe("blog routes respond", () => {
  it("/blog responds 200", async () => {
    const { status } = await get("/blog")
    assert.equal(status, 200)
  })

  it("/blog/rss.xml responds 200 as XML", async () => {
    const { status, body } = await get("/blog/rss.xml")
    assert.equal(status, 200)
    assert.match(body, /<rss/)
  })

  it("/sitemap.xml responds 200 and includes /blog", async () => {
    const { status, body } = await get("/sitemap.xml")
    assert.equal(status, 200)
    assert.match(body, /\/blog</)
  })

  it("returns 404 for a completely unknown slug", async () => {
    const { status } = await get(`/blog/does-not-exist-${RUN_ID}`)
    assert.equal(status, 404)
  })
})

describe(
  "public/draft/scheduled/archived visibility",
  { skip: !canRunLiveSuite && "SUPABASE_SERVICE_ROLE_KEY not configured locally" },
  () => {
    it("serves the published post at its slug", async () => {
      const { status, body } = await get(`/blog/${slugFor("published")}`)
      assert.equal(status, 200)
      assert.match(body, new RegExp(`Test published yazi ${RUN_ID}`))
    })

    it("returns 404 for a draft post's slug", async () => {
      const { status } = await get(`/blog/${slugFor("draft")}`)
      assert.equal(status, 404)
    })

    it("returns 404 for an archived post's slug", async () => {
      const { status } = await get(`/blog/${slugFor("archived")}`)
      assert.equal(status, 404)
    })

    it("returns 404 for a scheduled post before its publish time", async () => {
      const { status } = await get(`/blog/${slugFor("scheduled")}`)
      assert.equal(status, 404)
    })

    it("lists the published post on the blog index but not the others", async () => {
      const { body } = await get("/blog")
      assert.match(body, new RegExp(`Test published yazi ${RUN_ID}`))
      assert.doesNotMatch(body, new RegExp(`Test draft yazi ${RUN_ID}`))
      assert.doesNotMatch(body, new RegExp(`Test scheduled yazi ${RUN_ID}`))
      assert.doesNotMatch(body, new RegExp(`Test archived yazi ${RUN_ID}`))
    })

    it("includes the published post in the sitemap and excludes the others", async () => {
      const { status, body } = await get("/sitemap.xml")
      assert.equal(status, 200)
      assert.match(body, new RegExp(`/blog/${slugFor("published")}`))
      assert.doesNotMatch(body, new RegExp(`/blog/${slugFor("draft")}`))
      assert.doesNotMatch(body, new RegExp(`/blog/${slugFor("scheduled")}`))
      assert.doesNotMatch(body, new RegExp(`/blog/${slugFor("archived")}`))
    })

    it("includes the published post in the RSS feed and excludes the others", async () => {
      const { status, body } = await get("/blog/rss.xml")
      assert.equal(status, 200)
      assert.match(body, new RegExp(`Test published yazi ${RUN_ID}`))
      assert.doesNotMatch(body, new RegExp(`Test draft yazi ${RUN_ID}`))
      assert.doesNotMatch(body, new RegExp(`Test scheduled yazi ${RUN_ID}`))
    })
  },
)
