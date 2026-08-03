import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Image from "next/image"
import { adminPageContext } from "@/lib/admin/auth"
import { fetchAdminPostDetail } from "@/lib/blog/queries"
import { verifyBlogPreviewToken, BLOG_PREVIEW_COOKIE } from "@/lib/blog/preview-cookie"
import { blogImageUrl } from "@/lib/blog/media"
import { formatPostDate, formatReadingTime } from "@/lib/blog/format"
import { BlogContent } from "@/components/blog/render-content"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { AppearancePreviewShell } from "@/components/theme/appearance-preview-shell"
import { leaveBlogPreviewAction } from "../../actions"

export const metadata: Metadata = {
  title: "Yazı Önizleme",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Protected draft preview of one post.
 *
 * Three independent gates, the same architecture as
 * /admin/appearance/preview:
 *   1. a valid Supabase session,
 *   2. a current admin/super_admin role with manageBlog, re-read from
 *      `user_roles` on every request via adminPageContext — a revoked
 *      administrator loses access on the very next request,
 *   3. a valid short-lived, post-bound, signed kabia_blog_preview cookie.
 *
 * Any failed gate redirects to the post editor — outside this route, so it
 * renders on its own and cannot recurse. The cookie is issued only by
 * enterBlogPreviewAction and cleared by leaveBlogPreviewAction; there is no
 * predictable query parameter anywhere in this flow.
 */
export default async function BlogPreviewPage({ params }: { params: Promise<{ postId: string }> }) {
  const { session, supabase } = await adminPageContext("manageBlog")
  const { postId } = await params

  const store = await cookies()
  const token = store.get(BLOG_PREVIEW_COOKIE)
  if (!verifyBlogPreviewToken(token?.value, { userId: session.userId, postId })) {
    redirect(`/admin/blog/${postId}`)
  }

  const post = await fetchAdminPostDetail(supabase, postId)
  if (!post) redirect("/admin/blog")

  const cover = blogImageUrl(post.coverImagePath)

  return (
    <div className="min-h-dvh bg-ivory">
      <div
        role="status"
        className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-shell/15 px-4 py-3 text-sm text-ink"
      >
        <span className="font-medium">
          Önizleme modu — bu görünüm yalnızca yöneticilere açık. Yayınlanana kadar ziyaretçiler bu yazıyı göremez.
        </span>
        <form action={leaveBlogPreviewAction}>
          <input type="hidden" name="postId" value={post.id} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-200 hover:border-brand hover:text-brand"
          >
            ← Önizlemeyi kapat
          </button>
        </form>
      </div>

      <AppearancePreviewShell>
        <SiteHeader />

        <article className="wrap page-top pb-24 md:pb-32">
          <div className="mx-auto max-w-[42rem]">
            {post.category && <p className="label text-olive">{post.category.name}</p>}
            <h1 className="mt-5 text-4xl leading-[1.08] tracking-tight md:text-5xl">{post.title}</h1>
            {post.excerpt && <p className="mt-6 text-lg leading-relaxed text-ink/65">{post.excerpt}</p>}
            <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-ink/45">
              <span>{formatPostDate(post.publishedAt) || "Yayınlanmadı"}</span>
              <span aria-hidden="true">·</span>
              <span>{formatReadingTime(post.readingTimeMinutes)}</span>
            </p>
          </div>

          {cover && (
            <div className="relative mx-auto mt-10 aspect-[16/9] max-w-4xl overflow-hidden rounded-media bg-paper md:mt-14">
              <Image src={cover} alt="" fill sizes="(min-width: 1024px) 56rem, 100vw" className="object-cover" />
            </div>
          )}

          <div className="mt-10 md:mt-14">
            <BlogContent doc={post.contentJson} />
          </div>
        </article>

        <SiteFooter />
      </AppearancePreviewShell>
    </div>
  )
}
