import Image from "next/image"
import Link from "next/link"
import { blogImageUrl } from "@/lib/blog/media"
import { formatPostDate, formatReadingTime } from "@/lib/blog/format"
import { routes } from "@/lib/site"
import type { BlogPostSummary } from "@/lib/blog/types"

/** The lead article on an unfiltered first page — a larger, image-led entry point. */
export function FeaturedPost({ post }: { post: BlogPostSummary }) {
  const cover = blogImageUrl(post.coverImagePath)

  return (
    <Link href={routes.blogPost(post.slug)} prefetch={false} className="group block">
      <div className="grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
        <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper md:aspect-[5/4]">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="label text-olive">Kabia</span>
            </div>
          )}
        </div>
        <div>
          {post.category && <p className="label text-olive">{post.category.name}</p>}
          <h2 className="mt-4 text-3xl leading-[1.1] tracking-tight md:text-4xl">
            <span className="transition-colors duration-300 group-hover:text-brand">{post.title}</span>
          </h2>
          {post.excerpt && <p className="mt-5 max-w-md text-base leading-relaxed text-ink/65">{post.excerpt}</p>}
          <p className="mt-6 flex items-center gap-2 text-xs text-ink/45">
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
      </div>
    </Link>
  )
}
