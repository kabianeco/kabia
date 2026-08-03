import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { PageShell } from "@/components/layout/page-shell"
import { FeaturedPost } from "@/components/blog/featured-post"
import { BlogPostCard } from "@/components/blog/post-card"
import { BlogPagination } from "@/components/blog/blog-pagination"
import { ArrowLink } from "@/components/ui/button"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { fetchPublicCategoriesWithCounts, fetchPublicPostList, PUBLIC_PAGE_SIZE } from "@/lib/blog/queries"
import { routes } from "@/lib/site"

export const metadata: Metadata = {
  title: "Blog",
  description: "Kabia'nın bahçe günlüğü: hasat takvimi, üretim notları ve mevsim yazıları.",
  alternates: { canonical: "/blog" },
}

function blogHref(params: { kategori?: string; q?: string; sayfa?: number }) {
  const usp = new URLSearchParams()
  if (params.kategori) usp.set("kategori", params.kategori)
  if (params.q) usp.set("q", params.q)
  if (params.sayfa && params.sayfa > 1) usp.set("sayfa", String(params.sayfa))
  const qs = usp.toString()
  return qs ? `${routes.blog}?${qs}` : routes.blog
}

function GridSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Yazılar yükleniyor</span>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pt-14 pb-24 sm:grid-cols-2 md:pb-32 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <div className="aspect-[4/3] animate-pulse rounded-media bg-paper" />
            <div className="mt-5 border-t border-ink/10 pt-4">
              <div className="h-3 w-16 animate-pulse bg-paper" />
              <div className="mt-3 h-5 w-3/4 animate-pulse bg-paper" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

async function CategoryFilter({ activeCategory }: { activeCategory: string | undefined }) {
  const supabase = await createSupabaseServerClient()
  const categories = await fetchPublicCategoriesWithCounts(supabase)
  if (categories.length === 0) return null

  return (
    <nav aria-label="Kategoriler" className="border-t border-ink/10 pt-5">
      <ul className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <li>
          <Link
            href={blogHref({})}
            prefetch={false}
            aria-current={!activeCategory ? "true" : undefined}
            className={`inline-flex min-h-11 items-center text-sm transition-colors duration-300 ${
              !activeCategory ? "text-ink underline decoration-brand decoration-2 underline-offset-8" : "text-ink/55 hover:text-ink"
            }`}
          >
            Tümü
          </Link>
        </li>
        {categories.map((cat) => {
          const active = cat.slug === activeCategory
          return (
            <li key={cat.id}>
              <Link
                href={blogHref({ kategori: cat.slug })}
                prefetch={false}
                aria-current={active ? "true" : undefined}
                className={`inline-flex min-h-11 items-center text-sm transition-colors duration-300 ${
                  active ? "text-ink underline decoration-brand decoration-2 underline-offset-8" : "text-ink/55 hover:text-ink"
                }`}
              >
                {cat.name}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

async function PostGrid({
  categorySlug,
  query,
  page,
}: {
  categorySlug: string | undefined
  query: string | undefined
  page: number
}) {
  const supabase = await createSupabaseServerClient()
  const result = await fetchPublicPostList(supabase, {
    categorySlug,
    query,
    page,
    perPage: PUBLIC_PAGE_SIZE,
  })

  if (result.status === "error") {
    return (
      <div role="alert" className="py-24 text-center">
        <p className="font-theme-display text-2xl italic text-clay">Yazılar şu anda yüklenemiyor.</p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
          Blog sayfası açık kalacak. Lütfen daha sonra yeniden deneyin.
        </p>
      </div>
    )
  }

  const { items, total } = result
  const isUnfiltered = !categorySlug && !query && page === 1
  const showFeatured = isUnfiltered && items.length > 0
  const featured = showFeatured ? items[0] : null
  const rest = showFeatured ? items.slice(1) : items

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="font-theme-display text-2xl italic text-ink/70">
          {query ? "Aramanızla eşleşen yazı yok." : categorySlug ? "Bu kategoride henüz yazı yok." : "Blog şu an boş."}
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink/55">
          {query || categorySlug
            ? "Farklı bir arama veya kategori deneyebilirsiniz."
            : "Yeni yazılar yayınlandığında burada listelenir."}
        </p>
        {(query || categorySlug) && (
          <div className="mt-8">
            <ArrowLink href={routes.blog} prefetch={false}>
              Tüm yazılar
            </ArrowLink>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {featured && (
        <div className="pb-16 md:pb-20">
          <FeaturedPost post={featured} />
        </div>
      )}

      {rest.length > 0 && (
        <>
          <p className="label pb-5 text-olive">{total} yazı</p>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-14 pb-16 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post, i) => (
              <BlogPostCard key={post.id} post={post} priority={i < 3} />
            ))}
          </ul>
        </>
      )}

      <BlogPagination
        page={page}
        perPage={PUBLIC_PAGE_SIZE}
        total={total}
        buildHref={(p) => blogHref({ kategori: categorySlug, q: query, sayfa: p })}
      />
    </>
  )
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; q?: string; sayfa?: string }>
}) {
  const { kategori, q, sayfa } = await searchParams
  const page = Math.max(1, Number.parseInt(sayfa ?? "1", 10) || 1)
  const query = q?.trim() || undefined

  return (
    <PageShell>
      <section aria-labelledby="blog-heading">
        <div className="wrap page-top">
          <p className="label text-olive">Blog</p>
          <h1 id="blog-heading" className="mt-6 max-w-3xl text-4xl leading-[1.08] tracking-tight md:text-6xl">
            Bahçe <em className="font-theme-display italic text-brand">günlüğü</em>.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-ink/65">
            Hasat takvimi, üretim notları ve mevsim yazıları — Geyve&apos;deki bahçelerimizden.
          </p>
        </div>

        <div className="wrap mt-14 md:mt-20">
          <div className="flex flex-col gap-5 border-b border-ink/10 pb-5 md:flex-row md:items-end md:justify-between">
            <Suspense fallback={<div className="h-11" />}>
              <CategoryFilter activeCategory={kategori} />
            </Suspense>

            <form action={routes.blog} method="get" role="search" className="w-full max-w-xs md:w-auto">
              {kategori && <input type="hidden" name="kategori" value={kategori} />}
              <label htmlFor="blog-search" className="sr-only">
                Yazılarda ara
              </label>
              <input
                id="blog-search"
                type="search"
                name="q"
                defaultValue={query ?? ""}
                placeholder="Yazılarda ara…"
                className="min-h-11 w-full rounded-theme-input border border-ink/15 bg-ivory px-4 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
              />
            </form>
          </div>

          <div className="pt-14">
            <Suspense key={`${kategori ?? ""}-${query ?? ""}-${page}`} fallback={<GridSkeleton />}>
              <PostGrid categorySlug={kategori} query={query} page={page} />
            </Suspense>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
