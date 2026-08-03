import { cache } from "react"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import Image from "next/image"
import { PageShell } from "@/components/layout/page-shell"
import { BlogContent } from "@/components/blog/render-content"
import { BlogPostCard } from "@/components/blog/post-card"
import { ShareButtons } from "@/components/blog/share-buttons"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchAdjacentPosts, fetchPublishedPostBySlug, fetchRelatedPosts, resolveSlugRedirect } from "@/lib/blog/queries"
import { blogImageUrl } from "@/lib/blog/media"
import { formatPostDate, formatReadingTime } from "@/lib/blog/format"
import { site, routes } from "@/lib/site"
import type { BlogPostDetail } from "@/lib/blog/types"

/**
 * One React `cache()` read per request, shared between generateMetadata and
 * the page body — the same pattern lib/admin/auth.ts uses for
 * resolveAdminAccess, so a slug is never fetched twice for one response.
 */
const getPost = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient()
  return fetchPublishedPostBySlug(supabase, slug)
})

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const result = await getPost(slug)
  if (result.status !== "ok") return { title: "Yazı" }

  const post = result.post
  const cover = blogImageUrl(post.coverImagePath) ?? blogImageUrl(post.ogImagePath)
  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt || undefined
  const canonical = post.canonicalUrl || routes.blogPost(post.slug)

  return {
    title,
    description,
    alternates: { canonical },
    robots: post.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "article",
      url: `${site.url}${canonical}`,
      title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      section: post.category?.name,
      images: cover ? [{ url: cover, width: 1200, height: 800, alt: post.title }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  }
}

function Breadcrumbs({ post }: { post: BlogPostDetail }) {
  const items = [
    { label: "Ana sayfa", href: routes.home },
    { label: "Blog", href: routes.blog },
    { label: post.title, href: routes.blogPost(post.slug) },
  ]
  return (
    <nav aria-label="Breadcrumb" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/45">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="truncate text-ink/60">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} prefetch={false} className="transition-colors duration-300 hover:text-ink">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getPost(slug)

  if (result.status === "error") {
    return (
      <PageShell>
        <div role="alert" className="wrap page-top flex min-h-[50vh] flex-col items-start pb-24">
          <p className="font-theme-display text-3xl italic text-clay">Yazı şu anda yüklenemiyor.</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink/55">Lütfen daha sonra yeniden deneyin.</p>
        </div>
      </PageShell>
    )
  }

  if (result.status === "not_found") {
    const supabase = await createSupabaseServerClient()
    const currentSlug = await resolveSlugRedirect(supabase, slug)
    if (currentSlug && currentSlug !== slug) permanentRedirect(routes.blogPost(currentSlug))
    notFound()
  }

  const post = result.post
  const supabase = await createSupabaseServerClient()
  const [{ previous, next }, related] = await Promise.all([
    fetchAdjacentPosts(supabase, post),
    fetchRelatedPosts(supabase, post),
  ])

  const cover = blogImageUrl(post.coverImagePath)
  const canonical = post.canonicalUrl || routes.blogPost(post.slug)
  const canonicalAbsolute = `${site.url}${canonical}`

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt ?? undefined,
        image: cover ?? undefined,
        datePublished: post.publishedAt ?? undefined,
        dateModified: post.updatedAt,
        author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: site.name },
        publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${site.url}/images/logo.svg` } },
        mainEntityOfPage: canonicalAbsolute,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: site.url },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}${routes.blog}` },
          { "@type": "ListItem", position: 3, name: post.title, item: canonicalAbsolute },
        ],
      },
    ],
  }

// SEC-09: Read the per-request nonce for CSP inline script.
  const h = await headers()
  const nonce = h.get("x-nonce") ?? undefined

  return (
    <PageShell>
      {/* JSON.stringify does not escape "<", so a title containing "</script>"
           could otherwise break out of this tag — post titles are admin-authored,
           but the escape costs nothing and removes the question entirely. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        nonce={nonce}
      />

      <article className="wrap page-top pb-24 md:pb-32">
        <div className="mx-auto max-w-[42rem]">
          <Breadcrumbs post={post} />

          {post.category && <p className="label text-olive">{post.category.name}</p>}
          <h1 className="mt-5 text-4xl leading-[1.08] tracking-tight md:text-5xl">{post.title}</h1>
          {post.excerpt && <p className="mt-6 text-lg leading-relaxed text-ink/65">{post.excerpt}</p>}

          <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink/45">
            <time dateTime={post.publishedAt ?? undefined}>{formatPostDate(post.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{formatReadingTime(post.readingTimeMinutes)}</span>
            {post.authorName && (
              <>
                <span aria-hidden="true">·</span>
                <span>{post.authorName}</span>
              </>
            )}
          </p>
        </div>

        {cover && (
          <div className="relative mx-auto mt-10 aspect-[16/9] max-w-4xl overflow-hidden rounded-media bg-paper md:mt-14">
            <Image src={cover} alt="" fill priority sizes="(min-width: 1024px) 56rem, 100vw" className="object-cover" />
          </div>
        )}

        <div className="mt-10 md:mt-14">
          <BlogContent doc={post.contentJson} />
        </div>

        <div className="mx-auto mt-12 flex max-w-[42rem] items-center justify-between border-t border-ink/10 pt-6">
          <ShareButtons title={post.title} url={canonicalAbsolute} />
        </div>

        {(previous || next) && (
          <nav aria-label="Diğer yazılar" className="mx-auto mt-12 grid max-w-[42rem] grid-cols-1 gap-4 border-t border-ink/10 pt-8 sm:grid-cols-2">
            {previous ? (
              <Link href={routes.blogPost(previous.slug)} prefetch={false} className="group block">
                <p className="label text-olive">Önceki yazı</p>
                <p className="mt-2 text-base leading-snug text-ink transition-colors duration-300 group-hover:text-brand">{previous.title}</p>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={routes.blogPost(next.slug)} prefetch={false} className="group block sm:text-right">
                <p className="label text-olive">Sonraki yazı</p>
                <p className="mt-2 text-base leading-snug text-ink transition-colors duration-300 group-hover:text-brand">{next.title}</p>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}

        {related.length > 0 && (
          <div className="mt-20 border-t border-ink/10 pt-14 md:mt-28">
            <p className="label text-olive">İlgili yazılar</p>
            <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <BlogPostCard key={p.id} post={p} />
              ))}
            </ul>
          </div>
        )}
      </article>
    </PageShell>
  )
}
