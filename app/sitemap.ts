import type { MetadataRoute } from "next"
import { getCachedPublicProducts } from "@/lib/catalog"
import { getCachedPublicProducers } from "@/lib/producers"
import { journalEntries } from "@/content/journal"
import { site, routes, sitemapStaticPaths } from "@/lib/site"
import { absoluteUrl } from "@/lib/seo"
import { isAllowedImageUrl } from "@/lib/shop-banner"

/**
 * Only the routes safe to advertise to crawlers: static pages and active
 * products. Preview products and preview producer stores are never
 * included — they exist solely behind the design-review switch.
 *
 * The static list lives in lib/site.ts next to the route table, so a new brand
 * page cannot be added to the site and forgotten here. Product and producer URLs
 * are appended from live data.
 *
 * Rendered per request from the tag-cached catalogue (no build-time prerender,
 * so a build container without Supabase env cannot bake in a shrunken list).
 * A failed catalogue or producer read fails the response with a 5xx instead of
 * advertising a silently shorter sitemap: crawlers keep their last good copy
 * and Search Console shows the fetch error.
 */
export const dynamic = "force-dynamic"

/** Absolute, de-duplicated image locations; undefined when there are none. */
function imageList(urls: readonly string[]): string[] | undefined {
  const unique = [...new Set(urls.filter(Boolean).map(absoluteUrl))]
  return unique.length > 0 ? unique : undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productsResult, producersResult] = await Promise.all([getCachedPublicProducts(), getCachedPublicProducers()])
  if (productsResult.status !== "ok") throw new Error("[sitemap] product read failed; refusing to publish a partial sitemap")
  if (producersResult.status !== "ok") throw new Error("[sitemap] producer read failed; refusing to publish a partial sitemap")

  const staticEntries: MetadataRoute.Sitemap = sitemapStaticPaths.map((entry) => ({
    // The homepage is "/" in the route table; the sitemap wants the bare origin.
    url: entry.path === routes.home ? site.url : `${site.url}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))

  const productEntries: MetadataRoute.Sitemap = productsResult.products.map((p) => ({
          url: `${site.url}${routes.product(p.slug)}`,
          // The row's own last change, not the time of the request.
          ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
          changeFrequency: "weekly" as const,
          priority: 0.8,
          // Every photo the product page shows — the main image and the
          // gallery — once each. Sitemap image locations must be absolute.
          images: imageList([p.mainImageUrl, ...p.images]),
        }))

  // A producer's store page is advertised only while it has something on its
  // shelf, taken from the same product read (each row carries its producer).
  const stockedProducers = new Set(productsResult.products.map((p) => p.producerSlug).filter(Boolean))

  const producers = producersResult.producers
  // Producer rows carry no update timestamp, so no lastmod is claimed for
  // them rather than a made-up one.
  const producerEntries: MetadataRoute.Sitemap = producers.map((p) => ({
    url: `${site.url}${routes.producer(p.slug)}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
    // The story page shows the photo only when it passes the same allowlist.
    images: imageList(p.photoUrl && isAllowedImageUrl(p.photoUrl) ? [p.photoUrl] : []),
  }))
  const producerStoreEntries: MetadataRoute.Sitemap = producers
    .filter((p) => stockedProducers.has(p.slug))
    .map((p) => ({
      url: `${site.url}/magaza/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))

  const journalSitemapEntries: MetadataRoute.Sitemap = journalEntries.map((e) => ({
    url: `${site.url}${routes.journalEntry(e.slug)}`,
    lastModified: new Date(e.date),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }))

  return [...staticEntries, ...productEntries, ...producerEntries, ...producerStoreEntries, ...journalSitemapEntries]
}
