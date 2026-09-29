import { describe, it } from "node:test"
import assert from "node:assert/strict"

// The journal reads from the database now. Two facts must never be confused:
// "no entry has been published" (an honest empty page) and "the journal could
// not be read" (an outage). These pin the mapper, the read contract and the
// previous/next walk that the entry page relies on.

interface Call {
  method: string
  args: unknown[]
}

/** A minimal chainable stand-in for the supabase-js query builder. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Call[] = []
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return (resolve: (value: unknown) => unknown) => resolve(result)
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args })
          return builder
        }
      },
    },
  )
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] })
      return builder
    },
  }
  return { client, calls }
}

const ROW = {
  id: "e1",
  slug: "2026-04-11-tomurcuk-cicek",
  entry_date: "2026-04-11",
  location: "Kabia Çiftliği",
  weather: "Parçalı bulutlu 15°",
  orchard_state: "Tomurcuklar patlıyor",
  application: "Yok — sadece gözlem",
  observation: "Dallar tomurcuktan çiçeğe dönüyor.",
  outcome: "Arılar bekleniyor.",
  cover_image_url: "/images/a.jpg",
  video_path: null,
  journal_entry_images: [
    { image_url: "/images/c.jpg", alt_text: "üç", sort_order: 2 },
    { image_url: "/images/a.jpg", alt_text: null, sort_order: 0 },
    { image_url: "/images/b.jpg", alt_text: "iki", sort_order: 1 },
  ],
}

describe("mapJournalEntry", () => {
  it("keeps the shape the pages already consume and sorts the gallery by sort_order", async () => {
    const { mapJournalEntry } = await import("../lib/journal.ts")
    const entry = mapJournalEntry(ROW as never)
    assert.equal(entry.slug, "2026-04-11-tomurcuk-cicek")
    assert.equal(entry.date, "2026-04-11")
    assert.equal(entry.orchardState, "Tomurcuklar patlıyor")
    assert.equal(entry.photo, "/images/a.jpg")
    assert.equal(entry.video, undefined)
    assert.deepEqual(
      entry.gallery.map((image) => image.url),
      ["/images/a.jpg", "/images/b.jpg", "/images/c.jpg"],
    )
    assert.equal(entry.gallery[1].altText, "iki")
  })

  it("an entry with a video and no photo has neither photo nor gallery", async () => {
    const { mapJournalEntry } = await import("../lib/journal.ts")
    const entry = mapJournalEntry({
      ...ROW,
      cover_image_url: null,
      video_path: "/images/gunluk-2026-03-15-kaolin.mp4",
      journal_entry_images: [],
    } as never)
    assert.equal(entry.photo, undefined)
    assert.equal(entry.video, "/images/gunluk-2026-03-15-kaolin.mp4")
    assert.deepEqual(entry.gallery, [])
  })

  it("falls back to the first gallery image when the cover is unset", async () => {
    const { mapJournalEntry } = await import("../lib/journal.ts")
    const entry = mapJournalEntry({ ...ROW, cover_image_url: null } as never)
    assert.equal(entry.photo, "/images/a.jpg")
  })

  it("tolerates a missing gallery relation", async () => {
    const { mapJournalEntry } = await import("../lib/journal.ts")
    const entry = mapJournalEntry({ ...ROW, journal_entry_images: null } as never)
    assert.deepEqual(entry.gallery, [])
  })
})

describe("fetchPublishedJournal", () => {
  it("a database error is an outage, not an empty journal", async () => {
    const { fetchPublishedJournal } = await import("../lib/journal.ts")
    const { client } = fakeClient({ data: null, error: { message: "boom" } })
    assert.deepEqual(await fetchPublishedJournal(client as never), { status: "error" })
  })

  it("missing data without an error is still an outage", async () => {
    const { fetchPublishedJournal } = await import("../lib/journal.ts")
    const { client } = fakeClient({ data: null, error: null })
    assert.deepEqual(await fetchPublishedJournal(client as never), { status: "error" })
  })

  it("zero rows is an honest empty journal", async () => {
    const { fetchPublishedJournal } = await import("../lib/journal.ts")
    const { client } = fakeClient({ data: [], error: null })
    assert.deepEqual(await fetchPublishedJournal(client as never), { status: "ok", entries: [] })
  })

  it("maps rows and asks only for published entries, newest first", async () => {
    const { fetchPublishedJournal } = await import("../lib/journal.ts")
    const { client, calls } = fakeClient({ data: [ROW], error: null })
    const result = await fetchPublishedJournal(client as never)
    assert.equal(result.status, "ok")
    if (result.status === "ok") assert.equal(result.entries[0].slug, ROW.slug)
    assert.deepEqual(calls[0], { method: "from", args: ["journal_entries"] })
    assert.ok(calls.some((c) => c.method === "eq" && c.args[0] === "is_published" && c.args[1] === true))
    const order = calls.find((c) => c.method === "order")
    assert.equal(order?.args[0], "entry_date")
    assert.deepEqual(order?.args[1], { ascending: false })
  })
})

describe("journalNeighbours", () => {
  const entries = [
    { slug: "c", date: "2026-04-11" },
    { slug: "a", date: "2026-02-25" },
    { slug: "b", date: "2026-03-15" },
  ] as never[]

  it("walks the log in date order regardless of input order", async () => {
    const { journalNeighbours } = await import("../lib/journal.ts")
    const middle = journalNeighbours(entries, "b")
    assert.equal(middle.previous?.slug, "a")
    assert.equal(middle.next?.slug, "c")
  })

  it("the oldest entry has no previous and the newest has no next", async () => {
    const { journalNeighbours } = await import("../lib/journal.ts")
    assert.equal(journalNeighbours(entries, "a").previous, undefined)
    assert.equal(journalNeighbours(entries, "c").next, undefined)
  })

  it("an unknown slug has no neighbours", async () => {
    const { journalNeighbours } = await import("../lib/journal.ts")
    assert.deepEqual(journalNeighbours(entries, "zzz"), { previous: undefined, next: undefined })
  })
})

describe("journal cache", () => {
  it("exports the tag admin mutations must bust", async () => {
    const { JOURNAL_TAG } = await import("../lib/journal.ts")
    assert.equal(JOURNAL_TAG, "journal-entries")
  })
})

// ---- wiring: the pages read the database and keep the honest states ---------

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === "node_modules" || name === ".next") return []
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe("journal pages read the database", () => {
  const index = readFileSync("app/gunluk/page.tsx", "utf8")
  const entry = readFileSync("app/gunluk/[slug]/page.tsx", "utf8")
  const sitemap = readFileSync("app/sitemap.ts", "utf8")
  const guide = readFileSync("app/rehber/geyve-badem-bahcesi/page.tsx", "utf8")

  it("no code imports the old content/journal.ts, and the file is gone", () => {
    assert.equal(existsSync("content/journal.ts"), false)
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(dir)) {
        assert.ok(!readFileSync(file, "utf8").includes("@/content/journal"), `${file} still imports content/journal`)
      }
    }
  })

  it("the index reads the cached journal and states an outage honestly", () => {
    assert.match(index, /getCachedPublishedJournal\(\)/)
    assert.match(index, /result\.status === "error"/)
    assert.match(index, /Saha notları şu anda yüklenemiyor\./)
    // the empty state is still its own, separate state
    assert.match(index, /Günlük şu an boş\./)
  })

  it("the entry page distinguishes outage, missing entry and found entry", () => {
    assert.match(entry, /getCachedPublishedJournal\(\)/)
    assert.match(entry, /result\.status === "error"/)
    assert.match(entry, /if \(!entry\) notFound\(\)/)
    assert.ok(!entry.includes("generateStaticParams"), "static params would bake a build-time list into the routes")
  })

  it("the sitemap refuses to publish a partial list when the journal is unreadable", () => {
    assert.match(sitemap, /getCachedPublishedJournal/)
    assert.match(sitemap, /journalResult\.status !== "ok"\) throw/)
  })

  it("the guide's latest-notes list degrades to nothing instead of failing the page", () => {
    assert.match(guide, /getCachedPublishedJournal\(\)/)
    assert.match(guide, /journalResult\.status === "ok"/)
  })
})

describe("serializeJsonLd", () => {
  it("cannot be broken out of its script tag by admin-authored text", async () => {
    const { serializeJsonLd } = await import("../lib/seo.ts")
    const hostile = { headline: 'Bir </script><script>alert(1)</script> & "not" \u2028 <!--' }
    const out = serializeJsonLd(hostile)
    assert.ok(!out.includes("<"), "raw < must be escaped")
    assert.ok(!out.includes(">"), "raw > must be escaped")
    assert.ok(!out.includes("\u2028"), "line separator must be escaped")
    assert.ok(!/<\/script/i.test(out))
  })

  it("still parses back to exactly the same data", async () => {
    const { serializeJsonLd } = await import("../lib/seo.ts")
    const data = { "@type": "BlogPosting", headline: 'Tropinota hirta\'ya karşı <b>zehirsiz</b> — "nöbet"', n: [1, 2, { a: null }] }
    assert.deepEqual(JSON.parse(serializeJsonLd(data)), data)
  })

  it("the journal entry page serializes through it", () => {
    const page = readFileSync("app/gunluk/[slug]/page.tsx", "utf8")
    assert.match(page, /__html: serializeJsonLd\(/)
    assert.ok(!/__html: JSON\.stringify\(/.test(page))
  })
})
