import { describe, it } from "node:test"
import assert from "node:assert/strict"

// Uploads land in the library and (from the picker) are selected immediately, so
// what the upload core returns has to be a full library asset. These pin the
// naming convention (folder/YYYY-MM/stem-8hex.ext), the long cache header, the
// validation order, and that a half-finished upload never leaves an orphan.

const MAX = 10 * 1024 * 1024

function pngFile(name: string, width = 8, height = 6, type = "image/png"): File {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12) // IHDR
  view.setUint32(16, width)
  view.setUint32(20, height)
  return new File([bytes], name, { type })
}

function fakeSupabase(opts: { uploadError?: unknown; insertError?: unknown } = {}) {
  const log = {
    uploads: [] as { bucket: string; path: string; options: Record<string, unknown> }[],
    removes: [] as string[][],
    inserts: [] as { table: string; row: Record<string, unknown> }[],
  }
  const client = {
    storage: {
      from(bucket: string) {
        return {
          upload: async (path: string, _file: unknown, options: Record<string, unknown>) => {
            log.uploads.push({ bucket, path, options })
            return { error: opts.uploadError ?? null }
          },
          getPublicUrl: (path: string) => ({
            data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}` },
          }),
          remove: async (paths: string[]) => {
            log.removes.push(paths)
            return { error: null }
          },
        }
      },
    },
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          log.inserts.push({ table, row })
          return {
            select: () => ({
              single: async () =>
                opts.insertError
                  ? { data: null, error: opts.insertError }
                  : {
                      data: {
                        id: "new-asset-id",
                        display_name: null,
                        alt_text: null,
                        created_at: "2026-09-29T12:00:00Z",
                        ...row,
                      },
                      error: null,
                    },
            }),
          }
        },
      }
    },
  }
  return { client, log }
}

describe("object names", () => {
  it("keeps the YYYY-MM/<stem>-<8hex>.<ext> convention when no folder is given", async () => {
    const { safeObjectName } = await import("../lib/admin/media.ts")
    assert.match(safeObjectName("Acik Badem.JPG", "image/jpeg"), /^\d{4}-\d{2}\/acik-badem-[0-9a-f]{8}\.jpg$/)
  })

  it("puts an upload from an editor under its folder", async () => {
    const { safeObjectName } = await import("../lib/admin/media.ts")
    assert.match(safeObjectName("kavanoz.png", "image/png", "products"), /^products\/\d{4}-\d{2}\/kavanoz-[0-9a-f]{8}\.png$/)
    assert.match(safeObjectName("x.webp", "image/webp", "journal"), /^journal\/\d{4}-\d{2}\/x-[0-9a-f]{8}\.webp$/)
  })

  it("the extension comes from the probed type, never from the file name", async () => {
    const { safeObjectName } = await import("../lib/admin/media.ts")
    assert.match(safeObjectName("evil.html", "image/png"), /\.png$/)
  })

  it("builds a deterministic name for the migration script", async () => {
    const { mediaObjectName } = await import("../lib/admin/media.ts")
    assert.equal(
      mediaObjectName({ stem: "acik-badem", suffix: "1a2b3c4d", ext: "jpg", folder: "products", month: "2026-09" }),
      "products/2026-09/acik-badem-1a2b3c4d.jpg",
    )
    assert.equal(mediaObjectName({ stem: "x", suffix: "aaaaaaaa", ext: "jpg", month: "2026-08" }), "2026-08/x-aaaaaaaa.jpg")
  })

  it("only the three content folders are accepted", async () => {
    const { isMediaFolder, MEDIA_FOLDERS } = await import("../lib/admin/media.ts")
    assert.deepEqual([...MEDIA_FOLDERS], ["products", "producers", "journal"])
    assert.equal(isMediaFolder("products"), true)
    assert.equal(isMediaFolder("../etc"), false)
    assert.equal(isMediaFolder(""), false)
    assert.equal(isMediaFolder(null), false)
  })

  it("objects are cached for a year: names are unique, so they never change", async () => {
    const { MEDIA_CACHE_CONTROL } = await import("../lib/admin/media.ts")
    assert.equal(MEDIA_CACHE_CONTROL, "31536000")
  })
})

describe("performMediaUpload validation", () => {
  it("rejects a missing or empty file before touching storage", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client, log } = fakeSupabase()
    for (const file of [null, new File([], "empty.png", { type: "image/png" })]) {
      const result = await performMediaUpload(client as never, { file, userId: "u1" })
      assert.deepEqual(result, { ok: false, kind: "invalid", message: "Yüklenecek dosya seçilmedi." })
    }
    assert.equal(log.uploads.length, 0)
  })

  it("rejects a file over the size limit", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client, log } = fakeSupabase()
    const big = new File([new Uint8Array(MAX + 1)], "big.png", { type: "image/png" })
    const result = await performMediaUpload(client as never, { file: big, userId: "u1" })
    assert.equal(result.ok, false)
    if (!result.ok && result.kind === "invalid") assert.equal(result.message, "Dosya 10 MB sınırını aşıyor.")
    assert.equal(log.uploads.length, 0)
  })

  it("rejects a declared type that is not an accepted image type", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client } = fakeSupabase()
    const result = await performMediaUpload(client as never, {
      file: new File([new Uint8Array(40)], "a.svg", { type: "image/svg+xml" }),
      userId: "u1",
    })
    assert.equal(result.ok, false)
    if (!result.ok && result.kind === "invalid") assert.match(result.message, /Yalnızca JPEG, PNG, WebP ve AVIF/)
  })

  it("rejects bytes that are not an image even when the type says png", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client, log } = fakeSupabase()
    const html = new File(["<html><script>alert(1)</script></html>".repeat(3)], "x.png", { type: "image/png" })
    const result = await performMediaUpload(client as never, { file: html, userId: "u1" })
    assert.equal(result.ok, false)
    if (!result.ok && result.kind === "invalid") assert.match(result.message, /geçerli bir görsel değil/)
    assert.equal(log.uploads.length, 0)
  })

  it("rejects bytes whose real type differs from the declared one", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client } = fakeSupabase()
    const result = await performMediaUpload(client as never, { file: pngFile("x.jpg", 8, 6, "image/jpeg"), userId: "u1" })
    assert.equal(result.ok, false)
    if (!result.ok && result.kind === "invalid") assert.match(result.message, /uyuşmuyor/)
  })
})

describe("performMediaUpload", () => {
  it("uploads under the folder with a long cache header and returns a full library asset", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client, log } = fakeSupabase()
    const result = await performMediaUpload(client as never, {
      file: pngFile("Kavanoz Bal.png", 800, 600),
      folder: "products",
      userId: "user-1",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(log.uploads.length, 1)
    const upload = log.uploads[0]
    assert.equal(upload.bucket, "product-media")
    assert.match(upload.path, /^products\/\d{4}-\d{2}\/kavanoz-bal-[0-9a-f]{8}\.png$/)
    assert.deepEqual(upload.options, { contentType: "image/png", cacheControl: "31536000", upsert: false })

    assert.equal(log.inserts.length, 1)
    assert.equal(log.inserts[0].table, "media_assets")
    assert.equal(log.inserts[0].row.created_by, "user-1")
    assert.equal(log.inserts[0].row.object_path, upload.path)
    assert.equal(log.inserts[0].row.mime_type, "image/png")
    assert.equal(log.inserts[0].row.width, 800)
    assert.equal(log.inserts[0].row.height, 600)

    assert.equal(result.path, upload.path)
    assert.equal(result.asset.id, "new-asset-id")
    assert.equal(result.asset.url, `https://proj.supabase.co/storage/v1/object/public/product-media/${upload.path}`)
    assert.equal(result.url, result.asset.url)
    assert.equal(result.asset.objectPath, upload.path)
    assert.equal(result.asset.width, 800)
    assert.equal(result.asset.label, "Kavanoz Bal.png")
  })

  it("without a folder the object goes under YYYY-MM/ as before", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client, log } = fakeSupabase()
    await performMediaUpload(client as never, { file: pngFile("a.png"), userId: "u1" })
    assert.match(log.uploads[0].path, /^\d{4}-\d{2}\/a-[0-9a-f]{8}\.png$/)
  })

  it("a storage failure is reported and nothing is catalogued", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client, log } = fakeSupabase({ uploadError: { message: "storage down" } })
    const result = await performMediaUpload(client as never, { file: pngFile("a.png"), userId: "u1" })
    assert.equal(result.ok, false)
    if (!result.ok && result.kind === "failed") assert.equal(result.context, "uploadMedia")
    assert.equal(log.inserts.length, 0)
  })

  it("a catalogue failure removes the object so nothing is orphaned", async () => {
    const { performMediaUpload } = await import("../lib/admin/media-upload.ts")
    const { client, log } = fakeSupabase({ insertError: { message: "rls" } })
    const result = await performMediaUpload(client as never, { file: pngFile("a.png"), userId: "u1" })
    assert.equal(result.ok, false)
    if (!result.ok && result.kind === "failed") assert.equal(result.context, "uploadMedia:catalogue")
    assert.deepEqual(log.removes, [[log.uploads[0].path]])
  })
})

describe("the upload action", () => {
  it("delegates to the core and accepts a folder only from the allow-list", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync("app/admin/(protected)/media/actions.ts", "utf8")
    assert.match(src, /performMediaUpload\(/)
    assert.match(src, /isMediaFolder\(/)
    assert.match(src, /adminContext\("manageMedia"\)/)
  })
})
