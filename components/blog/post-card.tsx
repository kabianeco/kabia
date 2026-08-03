import Image from "next/image"
import Link from "next/link"
import { blogImageUrl } from "@/lib/blog/media"
import { formatPostDate, formatReadingTime } from "@/lib/blog/format"
import { routes } from "@/lib/site"
import type { BlogPostSummary } from "@/lib/blog/types"

/**
 * One entry in the blog grid — the same editorial language as
 * components/shop/product-entry.tsx: the image sits directly on the page,
 * a hairline carries the metadata, no card surface, no shadow.
 */
export function BlogPostCard({ post, priority = false }: { post: BlogPostSummary; priority?: boolean }) {
  const cover = blogImageUrl(post.coverImagePath)

  return (
    <li className="group">
      <Link href={routes.blogPost(post.slug)} prefetch={false} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-paper">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="label text-olive">Kabia</span>
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-ink/10 pt-4">
          {post.category && <p className="label text-olive">{post.category.name}</p>}
          <h2 className="mt-2 text-xl leading-snug tracking-tight transition-colors duration-300 group-hover:text-brand">
            {post.title}
          </h2>
          {post.excerpt && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink/60">{post.excerpt}</p>}
          <p className="mt-3 flex items-center gap-2 text-xs text-ink/45">
            <time dateTime={post.publishedAt ?? undefined}>{formatPostDate(post.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{formatReadingTime(post.readingTimeMinutes)}</span>
          </p>
        </div>
      </Link>
    </li>
  )
}
