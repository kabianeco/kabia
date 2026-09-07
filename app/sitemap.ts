import type { MetadataRoute } from "next"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchPublicProducts } from "@/lib/catalog"
import { fetchPublicProducers } from "@/lib/producers"
import { journalEntries } from "@/content/journal"
import { site, routes, sitemapStaticPaths } from "@/lib/site"

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
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.8,
          images: p.mainImageUrl ? [p.mainImageUrl] : undefined,
        }))
      : []

  const producersResult = await fetchPublicProducers(supabase)
  const producers = producersResult.status === "ok" ? producersResult.producers : []
  const producerEntries: MetadataRoute.Sitemap = producers.map((p) => ({
    url: `${site.url}${routes.producer(p.slug)}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))

  const journalSitemapEntries: MetadataRoute.Sitemap = journalEntries.map((e) => ({
    url: `${site.url}${routes.journalEntry(e.slug)}`,
    lastModified: new Date(e.date),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }))

  return [...staticEntries, ...productEntries, ...producerEntries, ...journalSitemapEntries]
}
