import type { MetadataRoute } from "next"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchPublicProducts } from "@/lib/catalog"
import { fetchPublicProducers } from "@/lib/producers"
import { journalEntries } from "@/content/journal"
import { site, routes, sitemapStaticPaths } from "@/lib/site"
import { absoluteUrl } from "@/lib/seo"

/**
 * Only the routes safe to advertise to crawlers: static pages and active
 * products. Preview products and preview producer stores are never
 * included — they exist solely behind the design-review switch.
 *
 * The static list lives in lib/site.ts next to the route table, so a new brand
 * page cannot be added to the site and forgotten here. Producer and journal URLs
 * are appended from live data; a failed producer read advertises none of them
 * rather than failing the whole sitemap.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createSupabaseServerClient()

  const productsResult = await fetchPublicProducts(supabase)

  const staticEntries: MetadataRoute.Sitemap = sitemapStaticPaths.map((entry) => ({
    // The homepage is "/" in the route table; the sitemap wants the bare origin.
    url: entry.path === routes.home ? site.url : `${site.url}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }))

  const productEntries: MetadataRoute.Sitemap =
    productsResult.status === "ok"
      ? productsResult.products.map((p) => ({
          url: `${site.url}${routes.product(p.slug)}`,
          // The row's own last change, not the time of the request.
          ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
          changeFrequency: "weekly" as const,
          priority: 0.8,
          // Sitemap image locations must be absolute.
          images: p.mainImageUrl ? [absoluteUrl(p.mainImageUrl)] : undefined,
        }))
      : []

  // A producer's store page is advertised only while it has something on its
  // shelf, taken from the same product read (each row carries its producer).
  const stockedProducers = new Set(
    productsResult.status === "ok" ? productsResult.products.map((p) => p.producerSlug).filter(Boolean) : [],
  )

  const producersResult = await fetchPublicProducers(supabase)
  const producers = producersResult.status === "ok" ? producersResult.producers : []
  // Producer rows carry no update timestamp, so no lastmod is claimed for
  // them rather than a made-up one.
  const producerEntries: MetadataRoute.Sitemap = producers.map((p) => ({
    url: `${site.url}${routes.producer(p.slug)}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
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
