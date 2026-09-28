import { getCachedPublicProducts } from "@/lib/catalog"
import { buildMerchantFeed } from "@/lib/merchant-feed"

/**
 * The Google Merchant Center feed at a stable URL, from the live catalogue
 * (tag-cached for 300 s like every storefront read). A failed catalogue read
 * answers 503 rather than an empty feed: Merchant Center would otherwise read
 * an empty file as "every product is gone" and drop the whole catalogue.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const result = await getCachedPublicProducts()
  if (result.status !== "ok") {
    return new Response("Katalog şu an okunamadı.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" },
    })
  }
  const feed = buildMerchantFeed(result.products)
  return new Response(feed.xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
