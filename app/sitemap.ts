import type { MetadataRoute } from "next"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchPublicProducts } from "@/lib/catalog"
import { eligibilityFilter } from "@/lib/blog/queries"
import { site, routes } from "@/lib/site"

/**
 * Only the routes safe to advertise to crawlers: static pages, active
 * products, and — via the same public-eligibility query the storefront
 * itself uses — currently published blog posts. Drafts, scheduled posts
 * before their time, and archived posts are never included, because they
 * never satisfy that query.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createSupabaseServerClient()

  const [productsResult, postsResult] = await Promise.all([
    fetchPublicProducts(supabase),
    supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .or(eligibilityFilter())
      .order("published_at", { ascending: false })
      .limit(5000),
  ])

  const staticEntries: MetadataRoute.Sitemap = [
    { url: site.url, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}${routes.store}`, changeFrequency: "daily", priority: 0.9 },
    { url: `${site.url}${routes.blog}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${site.url}${routes.distanceSalesAgreement}`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site.url}${routes.preliminaryInfo}`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site.url}${routes.privacyPolicy}`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site.url}${routes.kvkkDisclosure}`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site.url}${routes.explicitConsent}`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${site.url}${routes.cookiePolicy}`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${site.url}${routes.deliveryAndReturn}`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site.url}${routes.termsOfUse}`, changeFrequency: "monthly", priority: 0.5 },
  ]

  const productEntries: MetadataRoute.Sitemap =
    productsResult.status === "ok"
      ? productsResult.products.map((p) => ({
          url: `${site.url}${routes.product(p.slug)}`,
          changeFrequency: "weekly",
          priority: 0.7,
        }))
      : []

  const postEntries: MetadataRoute.Sitemap = (postsResult.data ?? []).map((row) => ({
    url: `${site.url}${routes.blogPost(row.slug as string)}`,
    lastModified: row.updated_at as string,
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticEntries, ...productEntries, ...postEntries]
}
