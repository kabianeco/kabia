import type { Metadata } from "next"
import { adminContext } from "@/lib/admin/auth"
import { logQueryError } from "@/lib/admin/errors"
import { ErrorState, InlineAlert, PageHeader, Panel } from "@/components/admin/ui/surfaces"
import { MEDIA_BUCKET } from "@/lib/admin/media"
import { MediaGrid, MediaUploader, type MediaObject } from "./media-manager"

export const metadata: Metadata = { title: "Medya" }
export const dynamic = "force-dynamic"

/**
 * Media manager.
 *
 * Objects are listed through the administrator's own session — the Storage
 * SELECT policy is restricted to administrators, so a customer calling the same
 * endpoint gets nothing. Public product images still load on the storefront
 * because the bucket itself is public and object URLs do not consult that
 * policy.
 *
 * Usage is resolved before anything can be deleted, so an image that a live
 * product still points at cannot be removed out from under it.
 */
export default async function MediaPage() {
  const { supabase } = await adminContext("manageMedia")

  const { data: files, error } = await supabase.storage.from(MEDIA_BUCKET).list("", {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  })

  // Objects live under YYYY-MM/ folders, so a root listing returns the folders.
  // One level down covers everything the uploader creates.
  const objects: MediaObject[] = []
  if (!error && files) {
    const folders = files.filter((entry) => entry.id === null)
    const rootFiles = files.filter((entry) => entry.id !== null)

    const listings = await Promise.all(
      folders.slice(0, 24).map(async (folder) => {
        const { data } = await supabase.storage.from(MEDIA_BUCKET).list(folder.name, {
          limit: 200,
          sortBy: { column: "created_at", order: "desc" },
        })
        return (data ?? []).map((entry) => ({ prefix: `${folder.name}/`, entry }))
      }),
    )

    const all = [
      ...rootFiles.map((entry) => ({ prefix: "", entry })),
      ...listings.flat(),
    ]

    for (const { prefix, entry } of all) {
      if (entry.id === null) continue
      const path = `${prefix}${entry.name}`
      const {
        data: { publicUrl },
      } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
      objects.push({
        name: entry.name,
        path,
        url: publicUrl,
        size: (entry.metadata?.size as number | undefined) ?? 0,
        createdAt: entry.created_at ?? null,
        usedBy: [],
      })
    }
  }

  if (error) logQueryError("media:list", error)

  // Resolve which products reference each object, so deletion can refuse.
  if (objects.length > 0) {
    const urls = objects.map((object) => object.url)
    const [imagesRes, mainRes] = await Promise.all([
      supabase
        .from("product_images")
        .select("image_url, storage_path, products(id, name)")
        .or(
          `image_url.in.(${urls.map((u) => `"${u}"`).join(",")}),storage_path.in.(${objects
            .map((o) => `"${o.path}"`)
            .join(",")})`,
        ),
      supabase.from("products").select("id, name, main_image_url").in("main_image_url", urls),
    ])

    if (imagesRes.error) logQueryError("media:usage:images", imagesRes.error)
    if (mainRes.error) logQueryError("media:usage:main", mainRes.error)

    const byUrl = new Map<string, { productId: string; productName: string }[]>()
    const byPath = new Map<string, { productId: string; productName: string }[]>()

    for (const row of (imagesRes.data ?? []) as unknown as {
      image_url: string
      storage_path: string | null
      products: { id: string; name: string } | null
    }[]) {
      if (!row.products) continue
      const usage = { productId: row.products.id, productName: row.products.name }
      if (row.image_url) byUrl.set(row.image_url, [...(byUrl.get(row.image_url) ?? []), usage])
      if (row.storage_path)
        byPath.set(row.storage_path, [...(byPath.get(row.storage_path) ?? []), usage])
    }

    for (const row of (mainRes.data ?? []) as { id: string; name: string; main_image_url: string }[]) {
      const usage = { productId: row.id, productName: row.name }
      byUrl.set(row.main_image_url, [...(byUrl.get(row.main_image_url) ?? []), usage])
    }

    for (const object of objects) {
      const merged = [...(byUrl.get(object.url) ?? []), ...(byPath.get(object.path) ?? [])]
      const seen = new Set<string>()
      object.usedBy = merged.filter((usage) =>
        seen.has(usage.productId) ? false : (seen.add(usage.productId), true),
      )
    }
  }

  return (
    <>
      <PageHeader
        title="Medya"
        description="Ürün görselleri Supabase Storage'daki product-media kovasında saklanır."
        breadcrumbs={[{ label: "Yönetim", href: "/admin" }, { label: "Medya" }]}
      />

      <div className="mb-6">
        <InlineAlert tone="info">
          Bir görsel herhangi bir üründe kullanılıyorsa silinemez. Önce ürünün görsel
          listesinden kaldırın; böylece mağazadaki hiçbir ürün görseli kırılmaz.
        </InlineAlert>
      </div>

      <div className="space-y-6">
        <MediaUploader />

        <Panel title="Kütüphane" description={`${objects.length} dosya`}>
          {error ? (
            <ErrorState description="Medya kütüphanesi okunamadı. Depolama ayarlarını kontrol edin." />
          ) : (
            <MediaGrid objects={objects} />
          )}
        </Panel>
      </div>
    </>
  )
}
