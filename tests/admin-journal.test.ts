import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

// The journal admin is cloned from the producers admin. These pin the pieces
// that make it safe: what the schema accepts (mirroring the database CHECKs),
// which columns each write may touch, who may use it, and that every mutation
// goes through the same server-side checks as the rest of the dashboard.

const valid = {
  slug: "2026-04-11-tomurcuk-cicek",
  entry_date: "2026-04-11",
  location: "Kabia Çiftliği",
  weather: "Parçalı bulutlu 15°",
  orchard_state: "Tomurcuklar patlıyor",
  application: "Yok — sadece gözlem",
  observation: "Dallar tomurcuktan çiçeğe dönüyor.",
  outcome: "Arılar bekleniyor.",
  video_path: "",
  is_published: true,
}

describe("journalEntrySchema", () => {
  it("accepts a complete entry and turns an empty video path into null", async () => {
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    const parsed = journalEntrySchema.safeParse(valid)
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues))
    assert.equal(parsed.data.video_path, null)
    assert.equal(parsed.data.entry_date, "2026-04-11")
  })

  it("requires every text field", async () => {
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    for (const field of ["location", "weather", "orchard_state", "application", "observation", "outcome"] as const) {
      assert.equal(journalEntrySchema.safeParse({ ...valid, [field]: "   " }).success, false, `${field} may not be blank`)
    }
  })

  it("enforces the same length limits as the database", async () => {
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    const limits = { location: 120, weather: 120, orchard_state: 300, application: 400, observation: 600, outcome: 1000 }
    for (const [field, max] of Object.entries(limits)) {
      assert.ok(journalEntrySchema.safeParse({ ...valid, [field]: "x".repeat(max) }).success, `${field} at ${max}`)
      assert.equal(journalEntrySchema.safeParse({ ...valid, [field]: "x".repeat(max + 1) }).success, false, `${field} over ${max}`)
    }
  })

  it("the date must be a real calendar date in ISO form", async () => {
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    for (const bad of ["", "11.04.2026", "2026-13-01", "2026-02-30", "2026-4-1", "not a date"]) {
      assert.equal(journalEntrySchema.safeParse({ ...valid, entry_date: bad }).success, false, bad)
    }
    assert.ok(journalEntrySchema.safeParse({ ...valid, entry_date: "2024-02-29" }).success)
  })

  it("the slug follows the site's slug rules", async () => {
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    assert.equal(journalEntrySchema.safeParse({ ...valid, slug: "Not A Slug" }).success, false)
    assert.equal(journalEntrySchema.safeParse({ ...valid, slug: "a" }).success, false)
    assert.equal(journalEntrySchema.safeParse({ ...valid, slug: "onizleme-x" }).success, false)
  })

  it("a video path is a local .mp4/.webm path, nothing else", async () => {
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    assert.ok(journalEntrySchema.safeParse({ ...valid, video_path: "/images/gunluk-2026-03-15-kaolin.mp4" }).success)
    assert.ok(journalEntrySchema.safeParse({ ...valid, video_path: "/video/x.webm" }).success)
    for (const bad of ["https://evil.example.com/x.mp4", "//evil.example.com/x.mp4", "/images/x.jpg", "images/x.mp4", "/images/x.mp4?x=1"]) {
      assert.equal(journalEntrySchema.safeParse({ ...valid, video_path: bad }).success, false, bad)
    }
  })
})

describe("journal row builders", () => {
  it("an insert writes the entry fields but never the cover, which the gallery save owns", async () => {
    const { buildJournalRow, JOURNAL_WRITE_COLUMNS } = await import("../lib/admin/journal-fields.ts")
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    const row = buildJournalRow(journalEntrySchema.parse(valid))
    assert.deepEqual(Object.keys(row).sort(), [...JOURNAL_WRITE_COLUMNS].sort())
    assert.ok(!("cover_image_url" in row))
    assert.equal(row.slug, valid.slug)
    assert.equal(row.entry_date, "2026-04-11")
  })

  it("an update never writes the slug: it is immutable after creation", async () => {
    const { buildJournalUpdateRow, JOURNAL_WRITE_COLUMNS } = await import("../lib/admin/journal-fields.ts")
    const { journalEntrySchema } = await import("../lib/admin/schemas.ts")
    const row = buildJournalUpdateRow(journalEntrySchema.parse({ ...valid, slug: "tampered-slug" }))
    assert.ok(!("slug" in row))
    assert.deepEqual(Object.keys(row).sort(), JOURNAL_WRITE_COLUMNS.filter((c) => c !== "slug").sort())
  })
})

describe("journal permission and navigation", () => {
  it("manageJournal is granted to admin and super_admin only", async () => {
    const { PERMISSIONS, can } = await import("../lib/admin/roles.ts")
    assert.deepEqual([...PERMISSIONS.manageJournal], ["admin", "super_admin"])
    assert.equal(can("admin", "manageJournal"), true)
    assert.equal(can(null, "manageJournal"), false)
  })

  it("there is exactly one navigation entry, guarded by that permission", async () => {
    const { ADMIN_NAV, navForRole } = await import("../lib/admin/nav.ts")
    const entries = ADMIN_NAV.filter((item) => item.href.startsWith("/admin/journal"))
    assert.equal(entries.length, 1)
    assert.equal(entries[0].permission, "manageJournal")
    assert.equal(entries[0].label, "Günlük")
    assert.equal(entries[0].icon, "journal")
    assert.ok(navForRole("admin").some((item) => item.href === "/admin/journal"))
  })

  it("the shell has an icon for it", () => {
    assert.match(readFileSync("components/admin/admin-shell.tsx", "utf8"), /journal: /)
  })
})

describe("journal audit trail", () => {
  it("every journal action and the entity have Turkish labels", async () => {
    const { AUDIT_ACTION_LABELS, describeAuditEntity } = await import("../lib/admin/audit.ts")
    for (const action of ["journal.create", "journal.update", "journal.publish", "journal.unpublish", "journal.delete"]) {
      assert.ok((AUDIT_ACTION_LABELS as Record<string, string>)[action], action)
    }
    assert.equal(describeAuditEntity("journal_entry"), "Günlük notu")
  })
})

describe("journal admin wiring", () => {
  const actions = readFileSync("app/admin/(protected)/journal/actions.ts", "utf8")

  it("every mutation re-derives the administrator and permission from the session", () => {
    assert.equal((actions.match(/adminContext\("manageJournal"\)/g) ?? []).length, 3)
    assert.match(actions, /"use server"/)
  })

  it("saving writes the cover and gallery through the atomic call", () => {
    assert.match(actions, /saveJournalGallery\(/)
    assert.match(actions, /journalGallerySchema\.safeParse/)
    assert.ok(!actions.includes('from("journal_entry_images")'), "per-image writes are back")
  })

  it("edits are visible on the next request: tag and paths are busted", () => {
    assert.match(actions, /updateTag\(JOURNAL_TAG\)/)
    assert.match(actions, /revalidatePath\("\/gunluk"\)/)
    assert.match(actions, /revalidatePath\(`\/gunluk\/\$\{slug\}`\)/)
  })

  it("a published entry cannot be deleted in one step", () => {
    assert.match(actions, /isPublished/)
    assert.match(actions, /hata=yayinda/)
  })

  it("the target publish state comes from the row just read, not from the form", () => {
    assert.match(actions, /is_published: !before\.isPublished/)
  })

  it("every journal page checks the permission on render", () => {
    for (const file of [
      "app/admin/(protected)/journal/page.tsx",
      "app/admin/(protected)/journal/new/page.tsx",
      "app/admin/(protected)/journal/[entryId]/page.tsx",
    ]) {
      assert.ok(existsSync(file), file)
      assert.match(readFileSync(file, "utf8"), /adminPageContext\("manageJournal"\)/, file)
    }
  })

  it("the form has no free-text image URL, and submits the gallery with its cover", () => {
    const form = readFileSync("app/admin/(protected)/journal/journal-form.tsx", "utf8")
    assert.match(form, /name="images"/)
    assert.match(form, /name="main_image_url"/)
    assert.match(form, /<GalleryEditor/)
    assert.ok(!/name="cover_image_url"/.test(form))
    assert.match(form, /readOnly/, "the slug must not be editable once created")
  })
})
