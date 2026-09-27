import { getCachedProductBase } from "@/lib/catalog"
import { brandOgImage, loadPhotoDataUri } from "@/lib/og-image"

/** Branded 1200×630 share card per product: real name, real photo, brand type. */
export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function ProductOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getCachedProductBase(slug).catch(() => null)
  if (!product) {
    return brandOgImage({
      eyebrow: "Kabia Ekolojik",
      title: "Toprağa saygıyla üretilenler",
      footer: "Geyve, Sakarya",
      photo: null,
      photoAlt: "",
    })
  }
  return brandOgImage({
    eyebrow: product.categoryName || "Kabia Ekolojik",
    title: product.name,
    footer: "Kabia Ekolojik · Geyve, Sakarya",
    photo: await loadPhotoDataUri(product.mainImageUrl),
    photoAlt: product.name,
  })
}
