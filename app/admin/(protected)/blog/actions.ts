"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext, requirePermission } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { fieldErrorsFrom, uuid } from "@/lib/admin/schemas"
import {
  blogCategorySchema,
  blogPostIdSchema,
  blogPostSchema,
  blogScheduleSchema,
  blogTagSchema,
} from "@/lib/blog/schema"
import { estimateReadingTimeMinutes, parseBlogContent } from "@/lib/blog/content"
import { ensureUniqueSlug, slugify } from "@/lib/blog/slug"
import { fetchAdminPostDetail, fetchPostTagIds } from "@/lib/blog/queries"
import { createBlogPreviewToken, BLOG_PREVIEW_COOKIE } from "@/lib/blog/preview-cookie"

/**
 * Blog post and taxonomy mutations.
 *
 * Same shape as every other admin mutation in this dashboard (see
 * app/admin/(protected)/products/actions.ts): re-derive the administrator
 * and permission from the session, validate with Zod, re-read the
 * authoritative row before acting on it, write through the administrator's
 * own RLS-protected session, audit with the server-derived identity, and
 * revalidate the public paths the change touches.
 */

function revalidateBlogRoutes(slug?: string | null, previousSlug?: string | null) {
  revalidatePath("/blog")
  if (slug) revalidatePath(`/blog/${slug}`)
  if (previousSlug && previousSlug !== slug) revalidatePath(`/blog/${previousSlug}`)
  revalidatePath("/blog/rss.xml")
  revalidatePath("/sitemap.xml")
  revalidatePath("/admin/blog")
}

function boolField(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true"
}

function textOrNull(formData: FormData, name: string): string | null {
  const value = formData.get(name)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

async function syncPostTags(supabase: Awaited<ReturnType<typeof adminContext>>["supabase"], postId: string, tagIds: string[]) {
  const { error: deleteError } = await supabase.from("blog_post_tags").delete().eq("post_id", postId)
  if (deleteError) return deleteError
  if (tagIds.length === 0) return null
  const rows = tagIds.map((tag_id) => ({ post_id: postId, tag_id }))
  const { error: insertError } = await supabase.from("blog_post_tags").insert(rows)
  return insertError ?? null
}

export async function saveBlogPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let redirectTo: string | null = null

  try {
    const { session, supabase } = await adminContext("manageBlog")

    const rawId = formData.get("postId")
    const postId = typeof rawId === "string" && rawId ? rawId : null
    if (postId && !uuid.safeParse(postId).success) {
      return { ok: false, message: "Geçersiz yazı kimliği." }
    }

    const parsed = blogPostSchema.safeParse({
      title: formData.get("title"),
      slug: formData.get("slug"),
      excerpt: textOrNull(formData, "excerpt"),
      content_json: formData.get("content_json"),
      category_id: textOrNull(formData, "category_id"),
      cover_media_id: textOrNull(formData, "cover_media_id"),
      cover_image_path: textOrNull(formData, "cover_image_path"),
      og_media_id: textOrNull(formData, "og_media_id"),
      og_image_path: textOrNull(formData, "og_image_path"),
      featured: boolField(formData, "featured"),
      allow_indexing: boolField(formData, "allow_indexing"),
      author_name: textOrNull(formData, "author_name"),
      seo_title: textOrNull(formData, "seo_title"),
      seo_description: textOrNull(formData, "seo_description"),
      canonical_url: textOrNull(formData, "canonical_url"),
      tag_ids: formData.get("tag_ids") ?? "[]",
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Lütfen işaretli alanları düzeltin." }
    }
    const input = parsed.data

    const slug = await ensureUniqueSlug(supabase, "blog_posts", slugify(input.slug) || slugify(input.title), postId)

    const before = postId ? await fetchAdminPostDetail(supabase, postId) : null
    if (postId && !before) return { ok: false, message: "Yazı bulunamadı." }

    const readingTime = estimateReadingTimeMinutes(input.content_json)

    const row = {
      title: input.title,
      slug,
      excerpt: input.excerpt,
      content_json: input.content_json,
      category_id: input.category_id,
      cover_media_id: input.cover_media_id,
      cover_image_path: input.cover_image_path,
      og_media_id: input.og_media_id,
      og_image_path: input.og_image_path,
      featured: input.featured,
      allow_indexing: input.allow_indexing,
      author_name: input.author_name,
      seo_title: input.seo_title,
      seo_description: input.seo_description,
      canonical_url: input.canonical_url,
      reading_time_minutes: readingTime,
      updated_by: session.userId,
    }

    let savedId = postId

    if (postId) {
      const { error } = await supabase.from("blog_posts").update(row).eq("id", postId)
      if (error) return toActionState(error, "saveBlogPost:update")
    } else {
      const { data, error } = await supabase
        .from("blog_posts")
        .insert({ ...row, created_by: session.userId, updated_by: session.userId, author_id: session.userId })
        .select("id")
        .single()
      if (error) return toActionState(error, "saveBlogPost:insert")
      savedId = data.id as string
    }

    if (!savedId) return { ok: false, message: "Yazı kaydedilemedi." }

    const tagError = await syncPostTags(supabase, savedId, input.tag_ids)
    if (tagError) return toActionState(tagError, "saveBlogPost:tags")

    const audited = await logAdminAction(supabase, {
      action: postId ? "blog.post_update" : "blog.post_create",
      entityType: "blog_post",
      entityId: savedId,
      before: before ? { title: before.title, slug: before.slug, status: before.status } : null,
      after: { title: input.title, slug, status: before?.status ?? "draft" },
      metadata: { tag_count: input.tag_ids.length },
    })

    revalidateBlogRoutes(slug, before?.slug)

    if (!audited) return { ok: true, message: "Yazı kaydedildi.", warning: AUDIT_WARNING }
    redirectTo = `/admin/blog/${savedId}?kayit=1`
  } catch (error) {
    return toActionState(error, "saveBlogPost")
  }

  if (redirectTo) redirect(redirectTo)
  return { ok: true, message: "Yazı kaydedildi." }
}

// ---- autosave ---------------------------------------------------------------

interface AutosaveInput {
  postId: string
  title: string
  slug: string
  excerpt: string
  contentJson: string
  expectedVersion: number
}

export type AutosaveResult =
  | { ok: true; version: number }
  | { ok: false; reason: "stale" | "invalid" | "unauthorized" | "error"; message: string }

/**
 * Called imperatively (not via a <form> submit) from the editor's debounced
 * autosave. Touches only draft-safe fields — never status, never publication
 * timestamps — and never publishes. The version check in the WHERE clause is
 * the whole of "does not overwrite newer server data silently": if another
 * tab or a manual save has moved the row's version on, this affects zero
 * rows and the caller is told to reload rather than having its write win
 * silently.
 */
export async function autosaveBlogPostAction(input: AutosaveInput): Promise<AutosaveResult> {
  try {
    const { session, supabase } = await adminContext("manageBlog")
    void session

    const idCheck = uuid.safeParse(input.postId)
    if (!idCheck.success) return { ok: false, reason: "invalid", message: "Geçersiz yazı kimliği." }

    const title = input.title.trim().slice(0, 200)
    if (title.length < 2) return { ok: false, reason: "invalid", message: "Başlık gerekli." }

    let content: unknown
    try {
      content = JSON.parse(input.contentJson)
    } catch {
      return { ok: false, reason: "invalid", message: "İçerik okunamadı." }
    }
    const doc = parseBlogContent(content)
    if (!doc) return { ok: false, reason: "invalid", message: "İçerik yapısı geçersiz." }

    const { data, error } = await supabase
      .from("blog_posts")
      .update({
        title,
        excerpt: input.excerpt.trim().slice(0, 400) || null,
        content_json: doc,
        reading_time_minutes: estimateReadingTimeMinutes(doc),
      })
      .eq("id", input.postId)
      .eq("version", input.expectedVersion)
      .select("version")
      .maybeSingle()

    if (error) return { ok: false, reason: "error", message: "Taslak kaydedilemedi." }
    if (!data) return { ok: false, reason: "stale", message: "Yazı başka bir yerde güncellendi." }

    return { ok: true, version: data.version as number }
  } catch {
    return { ok: false, reason: "unauthorized", message: "Yetki doğrulanamadı." }
  }
}

// ---- lifecycle ----------------------------------------------------------------

async function loadBeforeOrReturn(supabase: Awaited<ReturnType<typeof adminContext>>["supabase"], postId: string) {
  return fetchAdminPostDetail(supabase, postId)
}

export async function publishBlogPostAction(formData: FormData): Promise<void> {
  const { session, supabase } = await adminContext("manageBlog")
  const parsed = blogPostIdSchema.safeParse({ postId: formData.get("postId") })
  if (!parsed.success) return

  const before = await loadBeforeOrReturn(supabase, parsed.data.postId)
  if (!before) return

  if (!before.title || before.title.trim().length < 2) redirect(`/admin/blog/${before.id}?hata=baslik-gerekli`)
  if (!before.slug) redirect(`/admin/blog/${before.id}?hata=slug-gerekli`)
  const contentCheck = parseBlogContent(before.contentJson)
  if (!contentCheck) redirect(`/admin/blog/${before.id}?hata=icerik-gecersiz`)

  const publishedAt = before.publishedAt ?? new Date().toISOString()

  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "published", published_at: publishedAt, updated_by: session.userId })
    .eq("id", before.id)
  if (error) {
    console.error("[admin] publishBlogPost:", error)
    redirect(`/admin/blog/${before.id}?hata=yayinlanamadi`)
  }

  await logAdminAction(supabase, {
    action: "blog.post_publish",
    entityType: "blog_post",
    entityId: before.id,
    before: { status: before.status },
    after: { status: "published" },
    metadata: { title: before.title, slug: before.slug },
  })

  revalidateBlogRoutes(before.slug)
  redirect(`/admin/blog/${before.id}?yayin=1`)
}

export async function unpublishBlogPostAction(formData: FormData): Promise<void> {
  const { session, supabase } = await adminContext("manageBlog")
  const parsed = blogPostIdSchema.safeParse({ postId: formData.get("postId") })
  if (!parsed.success) return

  const before = await loadBeforeOrReturn(supabase, parsed.data.postId)
  if (!before) return

  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "draft", updated_by: session.userId })
    .eq("id", before.id)
  if (error) {
    console.error("[admin] unpublishBlogPost:", error)
    return
  }

  await logAdminAction(supabase, {
    action: "blog.post_unpublish",
    entityType: "blog_post",
    entityId: before.id,
    before: { status: before.status },
    after: { status: "draft" },
    metadata: { title: before.title, slug: before.slug },
  })

  revalidateBlogRoutes(before.slug)
  redirect(`/admin/blog/${before.id}?taslak=1`)
}

export async function scheduleBlogPostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageBlog")
    const parsed = blogScheduleSchema.safeParse({
      postId: formData.get("postId"),
      scheduled_at: formData.get("scheduled_at"),
    })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Lütfen zamanlama tarihini kontrol edin." }
    }

    const before = await loadBeforeOrReturn(supabase, parsed.data.postId)
    if (!before) return { ok: false, message: "Yazı bulunamadı." }
    const contentCheck = parseBlogContent(before.contentJson)
    if (!contentCheck) return { ok: false, message: "Zamanlama öncesi içerik geçerli olmalı." }

    const { error } = await supabase
      .from("blog_posts")
      .update({
        status: "scheduled",
        published_at: parsed.data.scheduled_at,
        scheduled_at: parsed.data.scheduled_at,
        updated_by: session.userId,
      })
      .eq("id", before.id)
    if (error) return toActionState(error, "scheduleBlogPost")

    await logAdminAction(supabase, {
      action: "blog.post_schedule",
      entityType: "blog_post",
      entityId: before.id,
      before: { status: before.status },
      after: { status: "scheduled", scheduled_at: parsed.data.scheduled_at },
      metadata: { title: before.title, slug: before.slug },
    })

    revalidateBlogRoutes(before.slug)
    return { ok: true, message: "Yazı zamanlandı." }
  } catch (error) {
    return toActionState(error, "scheduleBlogPost")
  }
}

export async function archiveBlogPostAction(formData: FormData): Promise<void> {
  const { session, supabase } = await adminContext("manageBlog")
  const parsed = blogPostIdSchema.safeParse({ postId: formData.get("postId") })
  if (!parsed.success) return

  const before = await loadBeforeOrReturn(supabase, parsed.data.postId)
  if (!before) return

  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "archived", updated_by: session.userId })
    .eq("id", before.id)
  if (error) {
    console.error("[admin] archiveBlogPost:", error)
    return
  }

  await logAdminAction(supabase, {
    action: "blog.post_archive",
    entityType: "blog_post",
    entityId: before.id,
    before: { status: before.status },
    after: { status: "archived" },
    metadata: { title: before.title, slug: before.slug },
  })

  revalidateBlogRoutes(before.slug)
  redirect(`/admin/blog/${before.id}?arsiv=1`)
}

export async function duplicateBlogPostAction(formData: FormData): Promise<void> {
  const { session, supabase } = await adminContext("manageBlog")
  const parsed = blogPostIdSchema.safeParse({ postId: formData.get("postId") })
  if (!parsed.success) return

  const before = await loadBeforeOrReturn(supabase, parsed.data.postId)
  if (!before) return

  const tagIds = await fetchPostTagIds(supabase, before.id)
  const newSlug = await ensureUniqueSlug(supabase, "blog_posts", `${before.slug}-kopya`)

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      title: `${before.title} (Kopya)`,
      slug: newSlug,
      excerpt: before.excerpt,
      content_json: before.contentJson,
      category_id: before.categoryId,
      cover_media_id: before.coverMediaId,
      cover_image_path: before.coverImagePath,
      og_media_id: before.ogMediaId,
      og_image_path: before.ogImagePath,
      author_name: before.authorName,
      seo_title: before.seoTitle,
      seo_description: before.seoDescription,
      canonical_url: null,
      reading_time_minutes: before.readingTimeMinutes,
      status: "draft",
      created_by: session.userId,
      updated_by: session.userId,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("[admin] duplicateBlogPost:", error)
    redirect(`/admin/blog/${before.id}?hata=kopyalanamadi`)
  }

  const newId = data.id as string
  if (tagIds.length > 0) {
    await supabase.from("blog_post_tags").insert(tagIds.map((tag_id) => ({ post_id: newId, tag_id })))
  }

  await logAdminAction(supabase, {
    action: "blog.post_duplicate",
    entityType: "blog_post",
    entityId: newId,
    before: null,
    after: { title: `${before.title} (Kopya)`, slug: newSlug },
    metadata: { duplicated_from: before.id },
  })

  revalidatePath("/admin/blog")
  redirect(`/admin/blog/${newId}?kopyalandi=1`)
}

const deletePostSchema = z.object({ postId: uuid })

export async function deleteBlogPostAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageBlog")
  const parsed = deletePostSchema.safeParse({ postId: formData.get("postId") })
  if (!parsed.success) return

  const before = await loadBeforeOrReturn(supabase, parsed.data.postId)
  if (!before) return

  const { error } = await supabase.from("blog_posts").delete().eq("id", before.id)
  if (error) {
    console.error("[admin] deleteBlogPost:", error)
    redirect(`/admin/blog/${before.id}?hata=silinemedi`)
  }

  await logAdminAction(supabase, {
    action: "blog.post_delete",
    entityType: "blog_post",
    entityId: before.id,
    before: { title: before.title, slug: before.slug, status: before.status },
    after: null,
  })

  revalidateBlogRoutes(before.slug)
  redirect("/admin/blog?silindi=1")
}

// ---- preview --------------------------------------------------------------

/**
 * Enter the secure draft preview: set a short-lived, post-bound, signed
 * cookie — the same architecture as the appearance preview
 * (lib/theme-engine/preview-cookie.ts), reimplemented independently
 * (lib/blog/preview-cookie.ts) so a blog preview token can never be replayed
 * against the appearance preview route or vice versa.
 */
export async function enterBlogPreviewAction(formData: FormData): Promise<void> {
  const parsed = blogPostIdSchema.safeParse({ postId: formData.get("postId") })
  if (!parsed.success) return

  const session = await requirePermission("manageBlog")
  const store = await cookies()
  const token = createBlogPreviewToken({ userId: session.userId, postId: parsed.data.postId })
  store.set(BLOG_PREVIEW_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/admin/blog/${parsed.data.postId}/preview`,
    maxAge: 600,
  })
  redirect(`/admin/blog/${parsed.data.postId}/preview`)
}

export async function leaveBlogPreviewAction(formData: FormData): Promise<void> {
  const parsed = blogPostIdSchema.safeParse({ postId: formData.get("postId") })
  const store = await cookies()
  if (parsed.success) {
    store.delete({ name: BLOG_PREVIEW_COOKIE, path: `/admin/blog/${parsed.data.postId}/preview` })
    redirect(`/admin/blog/${parsed.data.postId}`)
  }
  redirect("/admin/blog")
}

// ---- categories -----------------------------------------------------------

export async function createBlogCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageBlog")
    const parsed = blogCategorySchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: textOrNull(formData, "description"),
      image_media_id: textOrNull(formData, "image_media_id"),
      image_path: textOrNull(formData, "image_path"),
      sort_order: formData.get("sort_order") ?? "0",
      is_active: boolField(formData, "is_active"),
    })
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

    const slug = await ensureUniqueSlug(supabase, "blog_categories", slugify(parsed.data.slug) || slugify(parsed.data.name))

    const { data, error } = await supabase
      .from("blog_categories")
      .insert({ ...parsed.data, slug })
      .select("id")
      .single()
    if (error) return toActionState(error, "createBlogCategory")

    await logAdminAction(supabase, {
      action: "blog.category_create",
      entityType: "blog_category",
      entityId: data.id as string,
      after: { name: parsed.data.name, slug },
      metadata: { created_by: session.userId },
    })

    revalidatePath("/admin/blog/categories")
    revalidatePath("/blog")
    return { ok: true, message: "Kategori eklendi." }
  } catch (error) {
    return toActionState(error, "createBlogCategory")
  }
}

export async function updateBlogCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageBlog")
    const categoryId = formData.get("categoryId")
    if (typeof categoryId !== "string" || !uuid.safeParse(categoryId).success) {
      return { ok: false, message: "Geçersiz kategori kimliği." }
    }

    const parsed = blogCategorySchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: textOrNull(formData, "description"),
      image_media_id: textOrNull(formData, "image_media_id"),
      image_path: textOrNull(formData, "image_path"),
      sort_order: formData.get("sort_order") ?? "0",
      is_active: boolField(formData, "is_active"),
    })
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

    const { data: before } = await supabase.from("blog_categories").select("id, name, slug").eq("id", categoryId).maybeSingle()
    if (!before) return { ok: false, message: "Kategori bulunamadı." }

    const slug = await ensureUniqueSlug(supabase, "blog_categories", slugify(parsed.data.slug) || slugify(parsed.data.name), categoryId)

    const { error } = await supabase.from("blog_categories").update({ ...parsed.data, slug }).eq("id", categoryId)
    if (error) return toActionState(error, "updateBlogCategory")

    await logAdminAction(supabase, {
      action: "blog.category_update",
      entityType: "blog_category",
      entityId: categoryId,
      before: { name: before.name, slug: before.slug },
      after: { name: parsed.data.name, slug },
    })

    revalidatePath("/admin/blog/categories")
    revalidatePath("/blog")
    return { ok: true, message: "Kategori güncellendi." }
  } catch (error) {
    return toActionState(error, "updateBlogCategory")
  }
}

const categoryIdSchema = z.object({ categoryId: uuid })

export async function deleteBlogCategoryAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageBlog")
  const parsed = categoryIdSchema.safeParse({ categoryId: formData.get("categoryId") })
  if (!parsed.success) return

  const { data: before } = await supabase.from("blog_categories").select("id, name, slug").eq("id", parsed.data.categoryId).maybeSingle()
  if (!before) return

  // Deleting sets referencing posts' category_id to NULL (ON DELETE SET NULL)
  // — the "safe handling" for a referenced category. Posts are never blocked
  // from deletion by this.
  const { error } = await supabase.from("blog_categories").delete().eq("id", before.id)
  if (error) {
    console.error("[admin] deleteBlogCategory:", error)
    return
  }

  await logAdminAction(supabase, {
    action: "blog.category_delete",
    entityType: "blog_category",
    entityId: before.id,
    before: { name: before.name, slug: before.slug },
    after: null,
  })

  revalidatePath("/admin/blog/categories")
  revalidatePath("/blog")
}

// ---- tags -------------------------------------------------------------------

export async function createBlogTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageBlog")
    const parsed = blogTagSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") || formData.get("name") })
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

    const slug = await ensureUniqueSlug(supabase, "blog_tags", slugify(parsed.data.slug) || slugify(parsed.data.name))

    const { data, error } = await supabase.from("blog_tags").insert({ name: parsed.data.name, slug }).select("id").single()
    if (error) return toActionState(error, "createBlogTag")

    await logAdminAction(supabase, {
      action: "blog.tag_create",
      entityType: "blog_tag",
      entityId: data.id as string,
      after: { name: parsed.data.name, slug },
    })

    revalidatePath("/admin/blog/categories")
    return { ok: true, message: "Etiket eklendi." }
  } catch (error) {
    return toActionState(error, "createBlogTag")
  }
}

const tagIdSchema = z.object({ tagId: uuid })

export async function deleteBlogTagAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageBlog")
  const parsed = tagIdSchema.safeParse({ tagId: formData.get("tagId") })
  if (!parsed.success) return

  const { data: before } = await supabase.from("blog_tags").select("id, name, slug").eq("id", parsed.data.tagId).maybeSingle()
  if (!before) return

  const { error } = await supabase.from("blog_tags").delete().eq("id", before.id)
  if (error) {
    console.error("[admin] deleteBlogTag:", error)
    return
  }

  await logAdminAction(supabase, {
    action: "blog.tag_delete",
    entityType: "blog_tag",
    entityId: before.id,
    before: { name: before.name, slug: before.slug },
    after: null,
  })

  revalidatePath("/admin/blog/categories")
}
