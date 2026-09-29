import { describe, it } from "node:test"
import assert from "node:assert/strict"

// The product and journal editors share one gallery model: an ordered list of
// images, one of which is the main (product) / cover (journal) image. Position
// is display order; "main" is tracked by URL so reordering never silently
// changes which image is main. These pin the selection and ordering rules the
// editor UI is built on.

const BASE = "https://proj.supabase.co/storage/v1/object/public/product-media"

function asset(name: string, altText: string | null = null) {
  const path = `products/2026-09/${name}.jpg`
  return {
    id: `asset-${name}`,
    bucketId: "product-media",
    objectPath: path,
    url: `${BASE}/${path}`,
    originalFilename: `${name}.jpg`,
    displayName: null,
    label: `${name}.jpg`,
    mimeType: "image/jpeg",
    fileSize: 1000,
    width: 10,
    height: 10,
    altText,
    createdAt: "2026-09-29T00:00:00Z",
    uploadedBy: null,
  }
}

function keys() {
  let n = 0
  return () => `k${++n}`
}

const item = (name: string, id: string | null = null, alt = "") => ({
  key: id ?? `key-${name}`,
  id,
  imageUrl: `${BASE}/products/2026-09/${name}.jpg`,
  altText: alt,
  storagePath: `products/2026-09/${name}.jpg`,
})

const url = (name: string) => `${BASE}/products/2026-09/${name}.jpg`

describe("addAssets", () => {
  it("appends chosen assets in selection order", async () => {
    const { addAssets } = await import("../lib/admin/gallery.ts")
    const state = addAssets({ items: [item("a", "1")], mainUrl: url("a") }, [asset("b"), asset("c")], {
      fallbackAlt: "Kabuklu Badem",
      makeKey: keys(),
    })
    assert.deepEqual(state.items.map((i) => i.imageUrl), [url("a"), url("b"), url("c")])
    assert.equal(state.mainUrl, url("a"))
  })

  it("skips an asset that is already attached, by URL or by object path", async () => {
    const { addAssets } = await import("../lib/admin/gallery.ts")
    const attached = { ...item("a", "1"), imageUrl: "/images/legacy-a.jpg" } // path matches, URL does not
    const state = addAssets({ items: [attached, item("b", "2")], mainUrl: url("b") }, [asset("a"), asset("b"), asset("c")], {
      fallbackAlt: "x",
      makeKey: keys(),
    })
    assert.deepEqual(state.items.map((i) => i.imageUrl), ["/images/legacy-a.jpg", url("b"), url("c")])
  })

  it("prefills alt text from the library, else from the fallback (the record's name)", async () => {
    const { addAssets } = await import("../lib/admin/gallery.ts")
    const state = addAssets({ items: [], mainUrl: "" }, [asset("a", "  Filede badem  "), asset("b", null), asset("c", "  ")], {
      fallbackAlt: "Kabuklu Badem",
      makeKey: keys(),
    })
    assert.deepEqual(state.items.map((i) => i.altText), ["Filede badem", "Kabuklu Badem", "Kabuklu Badem"])
  })

  it("carries the object path so usage detection can match it", async () => {
    const { addAssets } = await import("../lib/admin/gallery.ts")
    const state = addAssets({ items: [], mainUrl: "" }, [asset("a")], { fallbackAlt: "x", makeKey: keys() })
    assert.equal(state.items[0].storagePath, "products/2026-09/a.jpg")
    assert.equal(state.items[0].id, null)
  })

  it("the first image a record ever gets becomes its main image; later ones do not", async () => {
    const { addAssets } = await import("../lib/admin/gallery.ts")
    const first = addAssets({ items: [], mainUrl: "" }, [asset("a"), asset("b")], { fallbackAlt: "x", makeKey: keys() })
    assert.equal(first.mainUrl, url("a"))
    const later = addAssets(first, [asset("c")], { fallbackAlt: "x", makeKey: keys() })
    assert.equal(later.mainUrl, url("a"))
  })

  it("respects the gallery ceiling", async () => {
    const { addAssets, MAX_GALLERY_IMAGES } = await import("../lib/admin/gallery.ts")
    const many = Array.from({ length: MAX_GALLERY_IMAGES + 5 }, (_, i) => asset(`n${i}`))
    const state = addAssets({ items: [], mainUrl: "" }, many, { fallbackAlt: "x", makeKey: keys() })
    assert.equal(state.items.length, MAX_GALLERY_IMAGES)
  })
})

describe("ordering", () => {
  const three = { items: [item("a", "1"), item("b", "2"), item("c", "3")], mainUrl: url("b") }

  it("move puts an item at a new position and leaves main alone", async () => {
    const { moveItem } = await import("../lib/admin/gallery.ts")
    const moved = moveItem(three, 0, 2)
    assert.deepEqual(moved.items.map((i) => i.id), ["2", "3", "1"])
    assert.equal(moved.mainUrl, url("b"))
  })

  it("moveUp and moveDown swap neighbours and stop at the ends", async () => {
    const { moveUp, moveDown } = await import("../lib/admin/gallery.ts")
    assert.deepEqual(moveUp(three, 2).items.map((i) => i.id), ["1", "3", "2"])
    assert.deepEqual(moveDown(three, 0).items.map((i) => i.id), ["2", "1", "3"])
    assert.deepEqual(moveUp(three, 0).items.map((i) => i.id), ["1", "2", "3"])
    assert.deepEqual(moveDown(three, 2).items.map((i) => i.id), ["1", "2", "3"])
  })

  it("move ignores out-of-range positions instead of corrupting the list", async () => {
    const { moveItem } = await import("../lib/admin/gallery.ts")
    assert.deepEqual(moveItem(three, -1, 1).items.map((i) => i.id), ["1", "2", "3"])
    assert.deepEqual(moveItem(three, 1, 9).items.map((i) => i.id), ["1", "2", "3"])
    assert.deepEqual(moveItem(three, 1, 1).items.map((i) => i.id), ["1", "2", "3"])
  })

  it("does not mutate the state it was given", async () => {
    const { moveItem } = await import("../lib/admin/gallery.ts")
    const before = JSON.stringify(three)
    moveItem(three, 0, 2)
    assert.equal(JSON.stringify(three), before)
  })
})

describe("main image", () => {
  const three = { items: [item("a", "1"), item("b", "2"), item("c", "3")], mainUrl: url("a") }

  it("any gallery image can be made the main image", async () => {
    const { setMain } = await import("../lib/admin/gallery.ts")
    assert.equal(setMain(three, 2).mainUrl, url("c"))
  })

  it("ignores an index that is not in the gallery", async () => {
    const { setMain } = await import("../lib/admin/gallery.ts")
    assert.equal(setMain(three, 7).mainUrl, url("a"))
  })

  it("removing a non-main image keeps main", async () => {
    const { removeAt } = await import("../lib/admin/gallery.ts")
    const next = removeAt(three, 1)
    assert.deepEqual(next.items.map((i) => i.id), ["1", "3"])
    assert.equal(next.mainUrl, url("a"))
  })

  it("removing the main image promotes the next one, or the previous when it was last", async () => {
    const { removeAt } = await import("../lib/admin/gallery.ts")
    assert.equal(removeAt(three, 0).mainUrl, url("b"))
    const mainLast = { ...three, mainUrl: url("c") }
    assert.equal(removeAt(mainLast, 2).mainUrl, url("b"))
  })

  it("removing the only image leaves no main", async () => {
    const { removeAt } = await import("../lib/admin/gallery.ts")
    const next = removeAt({ items: [item("a", "1")], mainUrl: url("a") }, 0)
    assert.deepEqual(next, { items: [], mainUrl: "" })
  })

  it("reordering never changes which image is main", async () => {
    const { moveItem, setMain } = await import("../lib/admin/gallery.ts")
    const withMainC = setMain(three, 2)
    assert.equal(moveItem(withMainC, 2, 0).mainUrl, url("c"))
  })
})

describe("alt text", () => {
  it("setAlt changes one image only", async () => {
    const { setAlt } = await import("../lib/admin/gallery.ts")
    const state = setAlt({ items: [item("a", "1", "x"), item("b", "2", "y")], mainUrl: url("a") }, 1, "yeni")
    assert.deepEqual(state.items.map((i) => i.altText), ["x", "yeni"])
  })
})

describe("toPayload", () => {
  it("emits the gallery in display order with trimmed text, ids kept and null ids for new rows", async () => {
    const { toPayload } = await import("../lib/admin/gallery.ts")
    const payload = toPayload({
      items: [item("b", "2", "  iki  "), { ...item("a"), altText: "" }],
      mainUrl: url("a"),
    })
    assert.equal(payload.main_image_url, url("a"))
    assert.deepEqual(payload.images, [
      { id: "2", image_url: url("b"), alt_text: "iki", storage_path: "products/2026-09/b.jpg" },
      { id: null, image_url: url("a"), alt_text: "", storage_path: "products/2026-09/a.jpg" },
    ])
  })
})

describe("galleryProblem", () => {
  it("a product needs at least one image and a main image that is in the gallery", async () => {
    const { galleryProblem } = await import("../lib/admin/gallery.ts")
    assert.match(galleryProblem({ items: [], mainUrl: "" }, { requireMain: true }) ?? "", /en az bir görsel/i)
    assert.match(
      galleryProblem({ items: [item("a", "1")], mainUrl: url("zzz") }, { requireMain: true }) ?? "",
      /ana görsel/i,
    )
    assert.equal(galleryProblem({ items: [item("a", "1")], mainUrl: url("a") }, { requireMain: true }), null)
  })

  it("a journal entry may have no images at all", async () => {
    const { galleryProblem } = await import("../lib/admin/gallery.ts")
    assert.equal(galleryProblem({ items: [], mainUrl: "" }, { requireMain: false }), null)
    assert.match(
      galleryProblem({ items: [item("a", "1")], mainUrl: "" }, { requireMain: false }) ?? "",
      /kapak/i,
    )
  })

  it("duplicates are refused", async () => {
    const { galleryProblem } = await import("../lib/admin/gallery.ts")
    assert.match(
      galleryProblem({ items: [item("a", "1"), item("a", "2")], mainUrl: url("a") }, { requireMain: true }) ?? "",
      /birden fazla/i,
    )
  })
})

describe("galleryFromRows", () => {
  it("builds editor state from saved rows, keyed by their ids", async () => {
    const { galleryFromRows } = await import("../lib/admin/gallery.ts")
    const state = galleryFromRows(
      [
        { id: "r1", imageUrl: url("a"), altText: null, storagePath: null },
        { id: "r2", imageUrl: url("b"), altText: "iki", storagePath: "products/2026-09/b.jpg" },
      ],
      url("b"),
    )
    assert.deepEqual(state.items.map((i) => [i.key, i.id, i.altText]), [
      ["r1", "r1", ""],
      ["r2", "r2", "iki"],
    ])
    assert.equal(state.mainUrl, url("b"))
  })
})
