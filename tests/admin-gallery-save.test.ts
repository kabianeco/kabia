import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// A gallery is saved with its main/cover image in ONE database call
// (admin_save_product_images / admin_save_journal_images), so it either all
// happens or none of it does. These pin the validation in front of that call
// and the shape of the call itself.

const PRODUCT_ID = "07a99026-1f17-4faf-9720-bf3b120ef7f6"
const ENTRY_ID = "11111111-1111-4111-8111-111111111111"
const IMG_ID = "22222222-2222-4222-8222-222222222222"

const img = (name: string, extra: Record<string, unknown> = {}) => ({
  id: null,
  image_url: `/images/${name}.jpg`,
  alt_text: "",
  storage_path: null,
  ...extra,
})

function fakeRpc(result: { data?: unknown; error?: unknown } = { data: 2 }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  return {
    calls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args })
        return { data: result.data ?? null, error: result.error ?? null }
      },
    },
  }
}

describe("productGallerySchema", () => {
  it("accepts a gallery whose main image is one of its images", async () => {
    const { productGallerySchema } = await import("../lib/admin/schemas.ts")
    const parsed = productGallerySchema.safeParse({
      main_image_url: "/images/b.jpg",
      images: [img("a"), img("b", { id: IMG_ID, alt_text: "  iki " })],
    })
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues))
    assert.equal(parsed.data.images[1].alt_text, "iki")
  })

  it("needs at least one image", async () => {
    const { productGallerySchema } = await import("../lib/admin/schemas.ts")
    const parsed = productGallerySchema.safeParse({ main_image_url: "/images/a.jpg", images: [] })
    assert.equal(parsed.success, false)
  })

  it("refuses a main image that is not in the gallery", async () => {
    const { productGallerySchema } = await import("../lib/admin/schemas.ts")
    const parsed = productGallerySchema.safeParse({ main_image_url: "/images/zzz.jpg", images: [img("a")] })
    assert.equal(parsed.success, false)
    assert.match(JSON.stringify(parsed.error?.issues), /Ana görsel/)
  })

  it("refuses the same image twice", async () => {
    const { productGallerySchema } = await import("../lib/admin/schemas.ts")
    const parsed = productGallerySchema.safeParse({ main_image_url: "/images/a.jpg", images: [img("a"), img("a")] })
    assert.equal(parsed.success, false)
    assert.match(JSON.stringify(parsed.error?.issues), /birden fazla/)
  })

  it("refuses an image host next/image would reject at render time", async () => {
    const { productGallerySchema } = await import("../lib/admin/schemas.ts")
    const bad = { ...img("a"), image_url: "https://evil.example.com/a.jpg" }
    const parsed = productGallerySchema.safeParse({ main_image_url: bad.image_url, images: [bad] })
    assert.equal(parsed.success, false)
  })

  it("caps the gallery and the alt text", async () => {
    const { productGallerySchema } = await import("../lib/admin/schemas.ts")
    const many = Array.from({ length: 31 }, (_, i) => img(`n${i}`))
    assert.equal(productGallerySchema.safeParse({ main_image_url: "/images/n0.jpg", images: many }).success, false)
    const longAlt = img("a", { alt_text: "x".repeat(201) })
    assert.equal(productGallerySchema.safeParse({ main_image_url: "/images/a.jpg", images: [longAlt] }).success, false)
  })

  it("rejects a malformed image id", async () => {
    const { productGallerySchema } = await import("../lib/admin/schemas.ts")
    const parsed = productGallerySchema.safeParse({ main_image_url: "/images/a.jpg", images: [img("a", { id: "not-a-uuid" })] })
    assert.equal(parsed.success, false)
  })
})

describe("journalGallerySchema", () => {
  it("an entry may have no images and then has no cover", async () => {
    const { journalGallerySchema } = await import("../lib/admin/schemas.ts")
    assert.ok(journalGallerySchema.safeParse({ main_image_url: "", images: [] }).success)
  })

  it("once it has images it needs a cover that is one of them", async () => {
    const { journalGallerySchema } = await import("../lib/admin/schemas.ts")
    assert.equal(journalGallerySchema.safeParse({ main_image_url: "", images: [img("a")] }).success, false)
    assert.equal(journalGallerySchema.safeParse({ main_image_url: "/images/zzz.jpg", images: [img("a")] }).success, false)
    assert.ok(journalGallerySchema.safeParse({ main_image_url: "/images/a.jpg", images: [img("a")] }).success)
  })

  it("no images but a cover is inconsistent", async () => {
    const { journalGallerySchema } = await import("../lib/admin/schemas.ts")
    assert.equal(journalGallerySchema.safeParse({ main_image_url: "/images/a.jpg", images: [] }).success, false)
  })
})

describe("saveProductGallery", () => {
  it("writes main image and gallery in exactly one RPC call, order carried by array position", async () => {
    const { saveProductGallery } = await import("../lib/admin/gallery-save.ts")
    const { client, calls } = fakeRpc({ data: 2 })
    const result = await saveProductGallery(client as never, PRODUCT_ID, {
      main_image_url: "/images/b.jpg",
      images: [img("b", { id: IMG_ID, alt_text: " iki ", storage_path: "products/2026-09/b.jpg" }), img("a")],
    })
    assert.deepEqual(result, { ok: true, count: 2 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, "admin_save_product_images")
    assert.deepEqual(calls[0].args, {
      p_product_id: PRODUCT_ID,
      p_main_image_url: "/images/b.jpg",
      p_images: [
        { id: IMG_ID, image_url: "/images/b.jpg", alt_text: "iki", storage_path: "products/2026-09/b.jpg" },
        { id: null, image_url: "/images/a.jpg", alt_text: null, storage_path: null },
      ],
    })
  })

  it("makes no database call when the payload is invalid", async () => {
    const { saveProductGallery } = await import("../lib/admin/gallery-save.ts")
    const { client, calls } = fakeRpc()
    const result = await saveProductGallery(client as never, PRODUCT_ID, { main_image_url: "/images/zzz.jpg", images: [img("a")] })
    assert.equal(result.ok, false)
    assert.equal(calls.length, 0)
  })

  it("makes no database call for a malformed product id", async () => {
    const { saveProductGallery } = await import("../lib/admin/gallery-save.ts")
    const { client, calls } = fakeRpc()
    const result = await saveProductGallery(client as never, "nope", { main_image_url: "/images/a.jpg", images: [img("a")] })
    assert.equal(result.ok, false)
    assert.equal(calls.length, 0)
  })

  it("surfaces the database's own Turkish refusal", async () => {
    const { saveProductGallery } = await import("../lib/admin/gallery-save.ts")
    const { client } = fakeRpc({ error: { code: "22023", message: "Görsel kaydı bu ürüne ait değil." } })
    const result = await saveProductGallery(client as never, PRODUCT_ID, { main_image_url: "/images/a.jpg", images: [img("a")] })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.message, "Görsel kaydı bu ürüne ait değil.")
  })

  it("hides a raw database error behind a safe message", async () => {
    const { saveProductGallery } = await import("../lib/admin/gallery-save.ts")
    const { client } = fakeRpc({ error: { code: "XX000", message: 'relation "product_images" exploded' } })
    const result = await saveProductGallery(client as never, PRODUCT_ID, { main_image_url: "/images/a.jpg", images: [img("a")] })
    assert.equal(result.ok, false)
    if (!result.ok) assert.ok(!/product_images/.test(result.message ?? ""))
  })
})

describe("saveJournalGallery", () => {
  it("writes cover and gallery in one RPC call, and an empty gallery sends a null cover", async () => {
    const { saveJournalGallery } = await import("../lib/admin/gallery-save.ts")
    const { client, calls } = fakeRpc({ data: 0 })
    const result = await saveJournalGallery(client as never, ENTRY_ID, { main_image_url: "", images: [] })
    assert.deepEqual(result, { ok: true, count: 0 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, "admin_save_journal_images")
    assert.deepEqual(calls[0].args, { p_entry_id: ENTRY_ID, p_cover_image_url: null, p_images: [] })
  })

  it("sends the cover when there are images", async () => {
    const { saveJournalGallery } = await import("../lib/admin/gallery-save.ts")
    const { client, calls } = fakeRpc({ data: 1 })
    await saveJournalGallery(client as never, ENTRY_ID, { main_image_url: "/images/a.jpg", images: [img("a")] })
    assert.equal(calls[0].args.p_cover_image_url, "/images/a.jpg")
  })
})

describe("the product action", () => {
  const src = readFileSync("app/admin/(protected)/products/actions.ts", "utf8")

  it("saves images through the one atomic call, not statement by statement", () => {
    assert.match(src, /saveProductGallery\(/)
    assert.ok(!src.includes('from("product_images")'), "per-image writes are back")
    assert.ok(!src.includes("imageSchema"), "the old per-image schema is back")
  })
})

describe("buildProductUpdateRow", () => {
  it("leaves main_image_url to the atomic gallery save on update, but keeps it on insert", async () => {
    const { buildProductRow, buildProductUpdateRow, PRODUCT_WRITE_COLUMNS } = await import("../lib/admin/product-fields.ts")
    const { productSchema } = await import("../lib/admin/schemas.ts")
    const parsed = productSchema.parse({
      name: "Kabuklu Ceviz", slug: "kabuklu-ceviz", category_id: "11111111-1111-4111-8111-111111111111",
      short_description: "k", description: "u", base_price: "590", original_price: "",
      main_image_url: "/images/a.jpg", is_active: true, is_featured: false, low_stock_threshold: "5",
      display_order: "0", source: "secki", certification: "kabia_secki",
      variants: [{ label: "500 g", price: 590, stock_quantity: 3 }],
    })
    const insertRow = buildProductRow(parsed) as Record<string, unknown>
    const updateRow = buildProductUpdateRow(parsed) as Record<string, unknown>
    assert.equal(insertRow.main_image_url, "/images/a.jpg")
    assert.ok(!("main_image_url" in updateRow))
    assert.deepEqual(
      Object.keys(updateRow).sort(),
      PRODUCT_WRITE_COLUMNS.filter((c) => c !== "main_image_url").sort(),
    )
  })
})

describe("parseGalleryFormFields", () => {
  const form = (entries: Record<string, string>) => {
    const data = new FormData()
    for (const [key, value] of Object.entries(entries)) data.set(key, value)
    return data
  }

  it("reads the images JSON and the main image from the form", async () => {
    const { parseGalleryFormFields } = await import("../lib/admin/gallery-save.ts")
    const parsed = parseGalleryFormFields(form({ images: JSON.stringify([img("a")]), main_image_url: "  /images/a.jpg " }))
    assert.deepEqual(parsed, { main_image_url: "/images/a.jpg", images: [img("a")] })
  })

  it("no images field means an empty gallery, not an error", async () => {
    const { parseGalleryFormFields } = await import("../lib/admin/gallery-save.ts")
    assert.deepEqual(parseGalleryFormFields(form({})), { main_image_url: "", images: [] })
    assert.deepEqual(parseGalleryFormFields(form({ images: "   ", main_image_url: "" })), { main_image_url: "", images: [] })
  })

  it("unreadable or non-array JSON is refused so nothing half-parsed reaches validation", async () => {
    const { parseGalleryFormFields } = await import("../lib/admin/gallery-save.ts")
    assert.equal(parseGalleryFormFields(form({ images: "{not json" })), null)
    assert.equal(parseGalleryFormFields(form({ images: '{"a":1}' })), null)
  })
})
