import { describe, it } from "node:test"
import assert from "node:assert/strict"

// Deleting a media asset must be refused while anything on the storefront still
// points at it. "Anything" is every place an image reference lives: a product's
// main image and gallery, a producer's photo, a journal entry's cover and
// gallery. Each is matched by public URL *and* by object path, because both
// spellings exist in the data.

const BASE = "https://proj.supabase.co/storage/v1/object/public/product-media"

function asset(id: string, path: string) {
  return {
    id,
    bucketId: "product-media",
    objectPath: path,
    url: `${BASE}/${path}`,
    originalFilename: path.split("/").pop() as string,
    displayName: null,
    label: path,
    mimeType: "image/jpeg",
    fileSize: 1000,
    width: 10,
    height: 10,
    altText: null,
    createdAt: "2026-09-29T00:00:00Z",
    uploadedBy: null,
  }
}

const A = asset("a1", "products/2026-09/acik-badem-1a2b3c4d.jpg")
const B = asset("b1", "journal/2026-09/yesilbadem-aaaa1111.jpg")
const C = asset("c1", "producers/2026-09/kabia-badem-bbbb2222.jpg")
const UNUSED = asset("u1", "2026-08/unused-cccc3333.jpg")

const empty = { productGallery: [], productMain: [], producers: [], journalCover: [], journalGallery: [] }

describe("collateUsage", () => {
  it("finds a product that uses the asset as its main image", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const usage = collateUsage([A], { ...empty, productMain: [{ id: "p1", name: "Kabuklu Badem", main_image_url: A.url }] })
    assert.deepEqual(usage.get("a1"), [
      { kind: "product", id: "p1", name: "Kabuklu Badem", href: "/admin/products/p1", isPrimary: true },
    ])
  })

  it("finds a gallery reference by URL, and by object path when the URL differs", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const byUrl = collateUsage([A], {
      ...empty,
      productGallery: [{ image_url: A.url, storage_path: null, products: { id: "p1", name: "Badem" } }],
    })
    assert.equal(byUrl.get("a1")?.length, 1)
    const byPath = collateUsage([A], {
      ...empty,
      productGallery: [{ image_url: "/images/legacy.jpg", storage_path: A.objectPath, products: { id: "p2", name: "Ceviz" } }],
    })
    assert.equal(byPath.get("a1")?.[0].id, "p2")
    assert.equal(byPath.get("a1")?.[0].isPrimary, false)
  })

  it("lists a product once, as primary, when it is both main image and gallery", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const usage = collateUsage([A], {
      ...empty,
      productMain: [{ id: "p1", name: "Badem", main_image_url: A.url }],
      productGallery: [{ image_url: A.url, storage_path: A.objectPath, products: { id: "p1", name: "Badem" } }],
    })
    assert.equal(usage.get("a1")?.length, 1)
    assert.equal(usage.get("a1")?.[0].isPrimary, true)
  })

  it("finds a producer whose photo is the asset", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const usage = collateUsage([C], { ...empty, producers: [{ id: "pr1", name: "Kabia Çiftliği", photo_url: C.url }] })
    assert.deepEqual(usage.get("c1"), [
      { kind: "producer", id: "pr1", name: "Kabia Çiftliği", href: "/admin/producers/pr1", isPrimary: true },
    ])
  })

  it("finds a journal entry by cover and by gallery, listing it once", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const usage = collateUsage([B], {
      ...empty,
      journalCover: [{ id: "j1", slug: "2026-08-25-yesil-kabuk", cover_image_url: B.url }],
      journalGallery: [
        { image_url: B.url, storage_path: B.objectPath, journal_entries: { id: "j1", slug: "2026-08-25-yesil-kabuk" } },
      ],
    })
    assert.equal(usage.get("b1")?.length, 1)
    assert.deepEqual(usage.get("b1")?.[0], {
      kind: "journal",
      id: "j1",
      name: "2026-08-25-yesil-kabuk",
      href: "/admin/journal/j1",
      isPrimary: true,
    })
    const galleryOnly = collateUsage([B], {
      ...empty,
      journalGallery: [{ image_url: "/images/x.jpg", storage_path: B.objectPath, journal_entries: { id: "j2", slug: "x-not" } }],
    })
    assert.equal(galleryOnly.get("b1")?.[0].isPrimary, false)
  })

  it("keeps different kinds apart even when the record ids collide", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const usage = collateUsage([A], {
      ...empty,
      productMain: [{ id: "same", name: "Ürün", main_image_url: A.url }],
      producers: [{ id: "same", name: "Üretici", photo_url: A.url }],
      journalCover: [{ id: "same", slug: "not", cover_image_url: A.url }],
    })
    assert.deepEqual(usage.get("a1")?.map((u) => u.kind).sort(), ["journal", "producer", "product"])
  })

  it("an unreferenced asset has an empty list, and every asset gets an entry", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const usage = collateUsage([A, UNUSED], { ...empty, productMain: [{ id: "p1", name: "Badem", main_image_url: A.url }] })
    assert.deepEqual(usage.get("u1"), [])
    assert.equal(usage.has("a1"), true)
  })

  it("ignores gallery rows whose parent could not be read", async () => {
    const { collateUsage } = await import("../lib/admin/media-usage.ts")
    const usage = collateUsage([A], {
      ...empty,
      productGallery: [{ image_url: A.url, storage_path: null, products: null }],
      journalGallery: [{ image_url: A.url, storage_path: null, journal_entries: null }],
    })
    assert.deepEqual(usage.get("a1"), [])
  })
})

describe("usage wording", () => {
  it("summarises every kind and says so when nothing uses the asset", async () => {
    const { summariseUsage } = await import("../lib/admin/media-usage.ts")
    assert.equal(summariseUsage([]), "Kullanılmıyor")
    const u = (kind: "product" | "producer" | "journal", id: string) => ({ kind, id, name: id, href: "/", isPrimary: false })
    assert.equal(summariseUsage([u("product", "1"), u("product", "2")]), "2 üründe kullanılıyor")
    assert.equal(
      summariseUsage([u("product", "1"), u("producer", "2"), u("journal", "3")]),
      "1 üründe, 1 üreticide, 1 günlük notunda kullanılıyor",
    )
  })

  it("the deletion refusal names every referencing record", async () => {
    const { deleteBlockedMessage } = await import("../lib/admin/media-usage.ts")
    const message = deleteBlockedMessage([
      { kind: "product", id: "1", name: "Kabuklu Badem", href: "/", isPrimary: true },
      { kind: "producer", id: "2", name: "Tarhana", href: "/", isPrimary: true },
      { kind: "journal", id: "3", name: "2026-04-01-tomurcuk", href: "/", isPrimary: true },
    ])
    assert.match(message, /Kabuklu Badem/)
    assert.match(message, /Tarhana/)
    assert.match(message, /2026-04-01-tomurcuk/)
    assert.match(message, /Önce/)
    assert.match(message, /silin/)
  })
})

/** A per-table stand-in for the supabase-js builder. */
function fakeByTable(tables: Record<string, unknown[] | { error: unknown }>) {
  const touched: string[] = []
  const client = {
    from(table: string) {
      touched.push(table)
      const payload = tables[table]
      const result =
        payload && !Array.isArray(payload) ? { data: null, error: (payload as { error: unknown }).error } : { data: payload ?? [], error: null }
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") return (resolve: (v: unknown) => unknown) => resolve(result)
            return () => builder
          },
        },
      )
      return builder
    },
  }
  return { client, touched }
}

describe("loadMediaUsage", () => {
  it("queries every place an image can be referenced", async () => {
    const { loadMediaUsage } = await import("../lib/admin/queries/media.ts")
    const { client, touched } = fakeByTable({})
    await loadMediaUsage(client as never, [A])
    for (const table of ["product_images", "products", "producers", "journal_entries", "journal_entry_images"]) {
      assert.ok(touched.includes(table), `${table} is not checked before a delete`)
    }
  })

  it("resolves usage from all sources into one list", async () => {
    const { loadMediaUsage } = await import("../lib/admin/queries/media.ts")
    const { client } = fakeByTable({
      products: [{ id: "p1", name: "Badem", main_image_url: A.url }],
      producers: [{ id: "pr1", name: "Kabia", photo_url: A.url }],
      journal_entries: [{ id: "j1", slug: "s", cover_image_url: A.url }],
    })
    const usage = await loadMediaUsage(client as never, [A])
    assert.deepEqual(usage.get("a1")?.map((u) => u.kind).sort(), ["journal", "producer", "product"])
  })

  it("fails closed: an unreadable source blocks deletion instead of hiding usage", async () => {
    const { loadMediaUsage } = await import("../lib/admin/queries/media.ts")
    const { client } = fakeByTable({ producers: { error: { message: "boom" } } })
    await assert.rejects(() => loadMediaUsage(client as never, [A]), /kullanım bilgisi/i)
  })
})
