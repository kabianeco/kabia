import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { adminPageContext } from "@/lib/admin/auth"
import { fetchAdminCategories, fetchAdminPostDetail, fetchAdminTags } from "@/lib/blog/queries"
import { formatDateTime } from "@/lib/admin/format"
import { InlineAlert, PageHeader } from "@/components/admin/ui/surfaces"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"
import { AdminButton } from "@/components/admin/ui/form"
import { BlogStatusTag } from "@/components/admin/ui/status"
import { PostForm } from "../post-form"
import { ScheduleForm } from "./schedule-form"
import {
  archiveBlogPostAction,
  deleteBlogPostAction,
  duplicateBlogPostAction,
  enterBlogPreviewAction,
  publishBlogPostAction,
  unpublishBlogPostAction,
} from "../actions"

export const metadata: Metadata = { title: "Yazıyı Düzenle" }
export const dynamic = "force-dynamic"

export default async function EditBlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { supabase } = await adminPageContext("manageBlog")
  const { postId } = await params
  const query = await searchParams

  const [post, categories, tags] = await Promise.all([
    fetchAdminPostDetail(supabase, postId),
    fetchAdminCategories(supabase),
    fetchAdminTags(supabase),
  ])

  if (!post) notFound()

  return (
    <>
      <PageHeader
        title={post.title}
        description={`Son güncelleme: ${formatDateTime(post.updatedAt)}`}
        breadcrumbs={[
          { label: "Yönetim", href: "/admin" },
          { label: "Blog", href: "/admin/blog" },
          { label: post.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BlogStatusTag status={post.status} />

            {post.status === "published" && (
              <Link
                href={`/blog/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm text-ink transition-colors duration-300 hover:border-brand hover:text-brand"
              >
                Blogda gör
              </Link>
            )}

            <form action={enterBlogPreviewAction}>
              <input type="hidden" name="postId" value={post.id} />
              <AdminButton variant="outline" type="submit">
                Önizle
              </AdminButton>
            </form>

            {post.status !== "published" && (
              <ConfirmAction
                trigger="Yayınla"
                triggerVariant="outline"
                tone="primary"
                title="Yazıyı yayınla"
                description="Yazı blogda herkese açık olarak görünür ve site haritasına eklenir."
                entityName={post.title}
                confirmLabel="Yayınla"
                pendingLabel="Yayınlanıyor…"
                action={publishBlogPostAction}
                hiddenFields={{ postId: post.id }}
              />
            )}

            {(post.status === "published" || post.status === "scheduled") && (
              <ConfirmAction
                trigger="Yayından kaldır"
                triggerVariant="outline"
                title="Yazıyı yayından kaldır"
                description="Yazı taslağa döner ve blogda görünmez. İçerik korunur."
                entityName={post.title}
                confirmLabel="Yayından kaldır"
                pendingLabel="Kaldırılıyor…"
                action={unpublishBlogPostAction}
                hiddenFields={{ postId: post.id }}
              />
            )}

            {post.status !== "archived" && (
              <ConfirmAction
                trigger="Arşivle"
                triggerVariant="outline"
                title="Yazıyı arşivle"
                description="Yazı blog listesinden kaldırılır ancak yönetimde saklanır. İstediğiniz zaman yeniden düzenleyebilirsiniz."
                entityName={post.title}
                confirmLabel="Arşivle"
                pendingLabel="Arşivleniyor…"
                action={archiveBlogPostAction}
                hiddenFields={{ postId: post.id }}
              />
            )}

            <form action={duplicateBlogPostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <AdminButton variant="ghost" type="submit">
                Çoğalt
              </AdminButton>
            </form>

            <ConfirmAction
              trigger="Kalıcı sil"
              triggerVariant="danger"
              title="Yazıyı kalıcı olarak sil"
              description="Bu işlem geri alınamaz. Onaylamak için yazının kısa adını yazın."
              entityName={post.title}
              typedConfirmation={post.slug}
              confirmLabel="Kalıcı olarak sil"
              pendingLabel="Siliniyor…"
              action={deleteBlogPostAction}
              hiddenFields={{ postId: post.id }}
            />
          </div>
        }
      />

      <div className="mb-6 space-y-3">
        {query.kayit === "1" && <InlineAlert tone="success">Yazı kaydedildi.</InlineAlert>}
        {query.yayin === "1" && <InlineAlert tone="success">Yazı yayınlandı.</InlineAlert>}
        {query.taslak === "1" && <InlineAlert tone="warning">Yazı yayından kaldırıldı; artık blogda görünmüyor.</InlineAlert>}
        {query.arsiv === "1" && <InlineAlert tone="warning">Yazı arşivlendi.</InlineAlert>}
        {query.kopyalandi === "1" && <InlineAlert tone="success">Yazı çoğaltıldı; bu kopya taslak olarak kaydedildi.</InlineAlert>}
        {query.hata === "baslik-gerekli" && <InlineAlert tone="danger">Yayınlamadan önce bir başlık girin.</InlineAlert>}
        {query.hata === "slug-gerekli" && <InlineAlert tone="danger">Yayınlamadan önce geçerli bir kısa ad girin.</InlineAlert>}
        {query.hata === "icerik-gecersiz" && <InlineAlert tone="danger">İçerik yapısı geçersiz; yeniden kaydedip tekrar deneyin.</InlineAlert>}
        {query.hata === "yayinlanamadi" && <InlineAlert tone="danger">Yazı yayınlanamadı. Lütfen tekrar deneyin.</InlineAlert>}
        {query.hata === "kopyalanamadi" && <InlineAlert tone="danger">Yazı çoğaltılamadı. Lütfen tekrar deneyin.</InlineAlert>}
        {query.hata === "silinemedi" && <InlineAlert tone="danger">Yazı silinemedi. Lütfen tekrar deneyin.</InlineAlert>}
      </div>

      {post.status !== "published" && (
        <div className="mb-6 rounded-[4px] border border-ink/10 bg-paper/40 px-4 py-4 md:px-5">
          <p className="label mb-3 text-olive">Zamanla</p>
          <ScheduleForm postId={post.id} />
        </div>
      )}

      <PostForm post={post} categories={categories} tags={tags} />
    </>
  )
}
