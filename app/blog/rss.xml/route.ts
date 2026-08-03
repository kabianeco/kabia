import { createSupabaseServerClient } from "@/lib/supabase/server"
import { eligibilityFilter } from "@/lib/blog/queries"
import { site, routes } from "@/lib/site"

export const revalidate = 3600

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

interface FeedRow {
  slug: string
  title: string
  excerpt: string | null
  published_at: string | null
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, published_at")
    .or(eligibilityFilter())
    .order("published_at", { ascending: false })
    .limit(50)

  const rows = (data ?? []) as FeedRow[]

  const items = rows
    .map((row) => {
      const link = `${site.url}${routes.blogPost(row.slug)}`
      const pubDate = row.published_at ? new Date(row.published_at).toUTCString() : undefined
      return `  <item>
    <title>${xmlEscape(row.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
    ${row.excerpt ? `<description>${xmlEscape(row.excerpt)}</description>` : ""}
  </item>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${xmlEscape(site.name)} — Blog</title>
  <link>${site.url}${routes.blog}</link>
  <description>${xmlEscape("Kabia'nın bahçe günlüğü: hasat takvimi, üretim notları ve mevsim yazıları.")}</description>
  <language>tr</language>
${items}
</channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  })
}
