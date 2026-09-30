import { describe, it } from "node:test"
import assert from "node:assert/strict"

// One-time move of the content images from public/ to Supabase Storage. The
// planning, naming and SQL-building are pure so they can be tested; the script
// that uploads is a thin shell around them. The switch is built from the mapping
// file and is reversible from a snapshot taken immediately before it.

const BASE = "https://proj.supabase.co/storage/v1/object/public/product-media"

const rows = () => ({
  products: [
    { id: "p1", slug: "kabuklu-badem", name: "Kabuklu Badem", main_image_url: "/images/acik-badem.jpg" },
    { id: "p2", slug: "eriste", name: "Erişte", main_image_url: "/images/acik-eriste1.jpg" },
    { id: "p3", slug: "seed", name: "Seed", main_image_url: "https://picsum.photos/seed/x/400/400" },
  ],
  productImages: [
    { id: "i1", product_id: "p1", image_url: "/images/acik-badem.jpg", alt_text: null, storage_path: null },
    { id: "i2", product_id: "p1", image_url: "/images/file-badem.jpg", alt_text: "Kabuklu Badem — filede hasat", storage_path: null },
    { id: "i3", product_id: "p2", image_url: "/images/acik-eriste1.jpg", alt_text: "  ", storage_path: null },
    { id: "i4", product_id: "p2", image_url: "/images/paketli-eriste.jpg", alt_text: null, storage_path: null },
    { id: "i5", product_id: "p3", image_url: "https://picsum.photos/seed/y/800/800", alt_text: null, storage_path: null },
  ],
  producers: [
    { id: "r1", slug: "eriste", name: "Erişte Üreticisi", photo_url: "/images/acik-eriste1.jpg" },
    { id: "r2", slug: "kabia-ciftligi", name: "Kabia Çiftliği", photo_url: "/images/kabia-badem.jpeg" },
  ],
  journalEntries: [
    { id: "j1", slug: "2026-08-25-yesil-kabuk", entry_date: "2026-08-25", location: "Kabia Çiftliği", cover_image_url: "/images/yesilbadem.jpg" },
    { id: "j2", slug: "2026-03-15-kaolin", entry_date: "2026-03-15", location: "Kabia Çiftliği", cover_image_url: null },
  ],
  journalImages: [{ id: "ji1", entry_id: "j1", image_url: "/images/yesilbadem.jpg", alt_text: null, storage_path: null }],
})

describe("isMovableLocalImage", () => {
  it("only flat /images/* raster files move", async () => {
    const { isMovableLocalImage } = await import("../scripts/lib/media-migration.ts")
    for (const ok of ["/images/a.jpg", "/images/a.JPEG", "/images/x-1.png", "/images/x.webp", "/images/x.avif"]) {
      assert.equal(isMovableLocalImage(ok), true, ok)
    }
    for (const no of ["", "/images/x.mp4", "/images/sub/a.jpg", "/og-default.jpg", "//evil.example/x.jpg", "https://picsum.photos/a.jpg", "images/a.jpg", "/images/a.svg"]) {
      assert.equal(isMovableLocalImage(no), false, no)
    }
  })
})

describe("planMoves", () => {
  it("lists each unique local file once, ignoring external and non-image references", async () => {
    const { planMoves } = await import("../scripts/lib/media-migration.ts")
    const plan = planMoves(rows())
    assert.deepEqual(
      plan.map((m) => m.oldPath),
      [
        "/images/acik-badem.jpg",
        "/images/acik-eriste1.jpg",
        "/images/file-badem.jpg",
        "/images/kabia-badem.jpeg",
        "/images/paketli-eriste.jpg",
        "/images/yesilbadem.jpg",
      ],
    )
  })

  it("files a shared image under products/, then producers/, then journal/", async () => {
    const { planMoves } = await import("../scripts/lib/media-migration.ts")
    const byPath = Object.fromEntries(planMoves(rows()).map((m) => [m.oldPath, m.folder]))
    assert.equal(byPath["/images/acik-eriste1.jpg"], "products") // product main AND producer photo
    assert.equal(byPath["/images/paketli-eriste.jpg"], "products") // gallery only
    assert.equal(byPath["/images/kabia-badem.jpeg"], "producers")
    assert.equal(byPath["/images/yesilbadem.jpg"], "journal")
  })

  it("alt text: the gallery's own text, else the product name, else the producer, else the journal label", async () => {
    const { planMoves } = await import("../scripts/lib/media-migration.ts")
    const alt = Object.fromEntries(planMoves(rows()).map((m) => [m.oldPath, m.altText]))
    assert.equal(alt["/images/file-badem.jpg"], "Kabuklu Badem — filede hasat")
    assert.equal(alt["/images/acik-badem.jpg"], "Kabuklu Badem") // gallery alt is null -> product name
    assert.equal(alt["/images/acik-eriste1.jpg"], "Erişte") // blank alt ignored; product beats producer
    assert.equal(alt["/images/kabia-badem.jpeg"], "Kabia Çiftliği")
    assert.equal(alt["/images/yesilbadem.jpg"], "25 Ağustos 2026 — Kabia Çiftliği")
  })

  it("records who uses each file, for the mapping file and the report", async () => {
    const { planMoves } = await import("../scripts/lib/media-migration.ts")
    const used = planMoves(rows()).find((m) => m.oldPath === "/images/acik-eriste1.jpg")?.usedBy
    assert.deepEqual([...(used ?? [])].sort(), ["producer:eriste", "product:eriste"])
  })
})

describe("objectPathFor", () => {
  it("follows [folder/]YYYY-MM/<stem>-<8hex>.<ext> with the suffix taken from the bytes", async () => {
    const { objectPathFor } = await import("../scripts/lib/media-migration.ts")
    const sha = "1a2b3c4d" + "0".repeat(56)
    assert.equal(objectPathFor("/images/acik-badem.jpg", sha, "products"), "products/2026-09/acik-badem-1a2b3c4d.jpg")
    assert.equal(objectPathFor("/images/kabia-badem.jpeg", sha, "producers"), "producers/2026-09/kabia-badem-1a2b3c4d.jpg")
  })

  it("is deterministic, so re-running the upload finds the same objects", async () => {
    const { objectPathFor } = await import("../scripts/lib/media-migration.ts")
    const sha = "ffeeddcc" + "1".repeat(56)
    assert.equal(objectPathFor("/images/a.jpg", sha, "journal"), objectPathFor("/images/a.jpg", sha, "journal"))
    assert.notEqual(objectPathFor("/images/a.jpg", sha, "journal"), objectPathFor("/images/a.jpg", "00000000" + "1".repeat(56), "journal"))
  })

  it("matches the pattern real admin uploads produce", async () => {
    const { objectPathFor } = await import("../scripts/lib/media-migration.ts")
    const { safeObjectName } = await import("../lib/admin/media.ts")
    const shape = /^(products|producers|journal)\/\d{4}-\d{2}\/[a-z0-9-]+-[0-9a-f]{8}\.jpg$/
    assert.match(objectPathFor("/images/Açık Badem.JPG", "abcdef01" + "0".repeat(56), "products"), shape)
    assert.match(safeObjectName("Açık Badem.JPG", "image/jpeg", "products"), shape)
  })
})

function entry(oldPath: string, objectPath: string, over: Record<string, unknown> = {}) {
  return {
    old_path: oldPath,
    object_path: objectPath,
    url: `${BASE}/${objectPath}`,
    media_asset_id: "asset-1",
    sha256: "a".repeat(64),
    bytes: 1234,
    mime: "image/jpeg",
    width: 10,
    height: 10,
    alt_text: "x",
    folder: "products",
    used_by: ["product:x"],
    ...over,
  }
}

describe("validateMapping", () => {
  const good = [entry("/images/a.jpg", "products/2026-09/a-aaaaaaaa.jpg"), entry("/images/b.jpg", "producers/2026-09/b-bbbbbbbb.jpg", { folder: "producers" })]

  it("accepts a complete, consistent mapping", async () => {
    const { validateMapping } = await import("../scripts/lib/media-migration.ts")
    assert.deepEqual(validateMapping(good as never, ["/images/a.jpg", "/images/b.jpg"], BASE), [])
  })

  it("flags a referenced file with no mapping, because the switch would leave it behind", async () => {
    const { validateMapping } = await import("../scripts/lib/media-migration.ts")
    const problems = validateMapping(good as never, ["/images/a.jpg", "/images/b.jpg", "/images/c.jpg"], BASE)
    assert.ok(problems.some((p) => p.includes("/images/c.jpg")))
  })

  it("flags duplicates, a url that is not base + object path, a bad mime, hash or size", async () => {
    const { validateMapping } = await import("../scripts/lib/media-migration.ts")
    const bad = [
      entry("/images/a.jpg", "products/2026-09/a-aaaaaaaa.jpg"),
      entry("/images/a.jpg", "products/2026-09/a2-aaaaaaaa.jpg"),
      entry("/images/b.jpg", "products/2026-09/b-bbbbbbbb.jpg", { url: "https://evil.example.com/b.jpg" }),
      entry("/images/c.jpg", "products/2026-09/c-cccccccc.jpg", { mime: "image/svg+xml" }),
      entry("/images/d.jpg", "products/2026-09/d-dddddddd.jpg", { sha256: "nothex" }),
      entry("/images/e.jpg", "products/2026-09/e-eeeeeeee.jpg", { bytes: 0 }),
    ]
    const problems = validateMapping(bad as never, [], BASE).join("\n")
    assert.match(problems, /duplicate/i)
    assert.match(problems, /\/images\/b\.jpg.*url/i)
    assert.match(problems, /\/images\/c\.jpg.*mime/i)
    assert.match(problems, /\/images\/d\.jpg.*sha/i)
    assert.match(problems, /\/images\/e\.jpg.*bytes/i)
  })
})

describe("buildSwitchSql", () => {
  const mapping = [
    entry("/images/a.jpg", "products/2026-09/a-aaaaaaaa.jpg"),
    entry("/images/it's.jpg", "journal/2026-09/its-bbbbbbbb.jpg", { folder: "journal" }),
  ]

  it("is one atomic block", async () => {
    const { buildSwitchSql } = await import("../scripts/lib/media-migration.ts")
    const sql = buildSwitchSql(mapping as never)
    assert.match(sql.trim(), /^do \$switch\$/i)
    assert.match(sql.trim(), /\$switch\$;$/)
  })

  it("rewrites every content reference, and fills storage_path where the table has one", async () => {
    const { buildSwitchSql } = await import("../scripts/lib/media-migration.ts")
    const sql = buildSwitchSql(mapping as never)
    for (const fragment of [
      /update public\.products/i,
      /update public\.product_images/i,
      /update public\.producers/i,
      /update public\.journal_entries/i,
      /update public\.journal_entry_images/i,
    ]) assert.match(sql, fragment)
    assert.match(sql, /update public\.product_images[\s\S]*?storage_path\s*=\s*m\.path/i)
    assert.match(sql, /update public\.journal_entry_images[\s\S]*?storage_path\s*=\s*m\.path/i)
    assert.ok(sql.includes("/images/a.jpg") && sql.includes(`${BASE}/products/2026-09/a-aaaaaaaa.jpg`))
  })

  it("every update is keyed on the old value, so a second run changes nothing and no row is touched blindly", async () => {
    const { buildSwitchSql } = await import("../scripts/lib/media-migration.ts")
    const sql = buildSwitchSql(mapping as never)
    const updates = sql.split(/update public\./i).slice(1)
    assert.equal(updates.length, 5)
    for (const chunk of updates) assert.match(chunk.split(";")[0], /where\s+\w+\.\w+\s*=\s*m\.old/i)
  })

  it("refuses to run when a target is not catalogued, or when any old value survives", async () => {
    const { buildSwitchSql } = await import("../scripts/lib/media-migration.ts")
    const sql = buildSwitchSql(mapping as never)
    assert.match(sql, /media_assets/i)
    assert.match(sql, /raise exception/i)
    assert.match(sql, /deleted_at is null/i)
  })

  it("is destructive-statement free and escapes quotes in values", async () => {
    const { buildSwitchSql } = await import("../scripts/lib/media-migration.ts")
    const sql = buildSwitchSql(mapping as never)
    assert.ok(!/\b(drop|truncate|delete)\b/i.test(sql))
    assert.ok(sql.includes("it''s.jpg") || sql.includes("it's.jpg".replace("'", "''")))
  })
})

describe("buildRollbackSql", () => {
  const snapshot = {
    products: [{ id: "p1", main_image_url: "/images/a.jpg" }],
    product_images: [{ id: "i1", image_url: "/images/a.jpg", storage_path: null }],
    producers: [{ id: "r1", photo_url: "/images/b.jpg" }],
    journal_entries: [{ id: "j1", cover_image_url: null }, { id: "j2", cover_image_url: "/images/c.jpg" }],
    journal_entry_images: [{ id: "ji1", image_url: "/images/c.jpg", storage_path: null }],
  }

  it("restores the exact prior state by id, including storage_path and null covers", async () => {
    const { buildRollbackSql } = await import("../scripts/lib/media-migration.ts")
    const sql = buildRollbackSql(snapshot as never)
    assert.match(sql.trim(), /^do \$rollback\$/i)
    for (const table of ["products", "product_images", "producers", "journal_entries", "journal_entry_images"]) {
      assert.match(sql, new RegExp(`update public\\.${table}`, "i"))
    }
    assert.ok(sql.includes("/images/a.jpg") && sql.includes("/images/b.jpg") && sql.includes("/images/c.jpg"))
    assert.match(sql, /"storage_path":\s*null/)
    assert.match(sql, /"cover_image_url":\s*null/)
  })

  it("every update is keyed on the row id, and nothing is deleted", async () => {
    const { buildRollbackSql } = await import("../scripts/lib/media-migration.ts")
    const sql = buildRollbackSql(snapshot as never)
    for (const chunk of sql.split(/update public\./i).slice(1)) assert.match(chunk.split(";")[0], /where\s+\w+\.id\s*=\s*r\.id/i)
    assert.ok(!/\b(drop|truncate|delete)\b/i.test(sql))
  })
})
