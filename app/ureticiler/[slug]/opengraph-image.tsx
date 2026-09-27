import { getCachedProducerBySlug } from "@/lib/producers"
import { brandOgImage, loadPhotoDataUri } from "@/lib/og-image"

/** Branded 1200×630 share card per producer: real name, real photo, brand type. */
export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function ProducerOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getCachedProducerBySlug(slug).catch(() => ({ status: "error" as const }))
  if (result.status !== "ok") {
    return brandOgImage({
      eyebrow: "Kabia Ekolojik",
      title: "Tanıdığımız üreticiler",
      footer: "Geyve, Sakarya",
      photo: null,
      photoAlt: "",
    })
  }
  const producer = result.producer
  const type = "productType" in producer && typeof producer.productType === "string" ? producer.productType : null
  return brandOgImage({
    eyebrow: type || "Kabia Ekolojik",
    title: producer.name,
    footer: "Kabia Ekolojik · Geyve, Sakarya",
    photo: await loadPhotoDataUri(producer.photoUrl),
    photoAlt: producer.name,
  })
}
