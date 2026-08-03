"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { saveBlogPostAction, autosaveBlogPostAction } from "./actions"
import { RichTextEditor } from "@/components/admin/blog/rich-text-editor"
import { MediaPicker } from "@/components/admin/media/media-picker"
import { slugify } from "@/lib/blog/slug"
import { estimateReadingTimeMinutes, wordCount } from "@/lib/blog/content"
import { EMPTY_DOC, type BlogDocNode, type BlogCategorySummary, type BlogPostDetail, type BlogTag } from "@/lib/blog/types"
import { ACTION_IDLE } from "@/lib/admin/errors"
import {
  AdminCheckbox,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import { Panel } from "@/components/admin/ui/surfaces"

/**
 * The article editor.
 *
 * A manual "Taslağı kaydet" submit (saveBlogPostAction) is always the
 * authoritative save — it writes every field, syncs tags, and is what
 * revalidates the public routes. A separate, narrower autosave
 * (autosaveBlogPostAction) runs only for an already-created post, touches
 * only title/excerpt/content, never revalidates anything public, and never
 * redirects — so it cannot become a save/render/refresh loop. It uses the
 * row's `version` in its WHERE clause: if a manual save or another tab moved
 * the version on, the autosave affects zero rows and reports "stale" rather
 * than overwriting newer data.
 */

const AUTOSAVE_DEBOUNCE_MS = 2500

type AutosaveState = "idle" | "saving" | "saved" | "stale" | "error"

interface CoverDraft {
  mediaId: string | null
  path: string | null
  url: string | null
}

function toCoverDraft(mediaId: string | null, path: string | null): CoverDraft {
  return { mediaId, path, url: null }
}

export function PostForm({
  post,
  categories,
  tags,
}: {
  post: BlogPostDetail | null
  categories: BlogCategorySummary[]
  tags: BlogTag[]
}) {
  const [state, formAction] = useActionState(saveBlogPostAction, ACTION_IDLE)
  const isEdit = Boolean(post)

  const [title, setTitle] = useState(post?.title ?? "")
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [doc, setDoc] = useState<BlogDocNode>(post?.contentJson ?? EMPTY_DOC)
  const [categoryId, setCategoryId] = useState(post?.categoryId ?? "")
  const [tagIds, setTagIds] = useState<string[]>(post?.tags.map((t) => t.id) ?? [])
  const [authorName, setAuthorName] = useState(post?.authorName ?? "")
  const [featured, setFeatured] = useState(post?.featured ?? false)
  const [allowIndexing, setAllowIndexing] = useState(post?.allowIndexing ?? true)
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "")
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "")
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonicalUrl ?? "")

  const [cover, setCover] = useState<CoverDraft>(toCoverDraft(post?.coverMediaId ?? null, post?.coverImagePath ?? null))
  const [og, setOg] = useState<CoverDraft>(toCoverDraft(post?.ogMediaId ?? null, post?.ogImagePath ?? null))
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [ogPickerOpen, setOgPickerOpen] = useState(false)

  const [version, setVersion] = useState(post?.version ?? 1)
  const [autosave, setAutosave] = useState<AutosaveState>("idle")
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextAutosave = useRef(true)

  const errors = state.fieldErrors ?? {}

  useEffect(() => {
    if (!isEdit || !post) return
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setAutosave("idle")
    autosaveTimer.current = setTimeout(async () => {
      setAutosave("saving")
      const result = await autosaveBlogPostAction({
        postId: post.id,
        title,
        slug,
        excerpt,
        contentJson: JSON.stringify(doc),
        expectedVersion: version,
      })
      if (result.ok) {
        setVersion(result.version)
        setAutosave("saved")
      } else if (result.reason === "stale") {
        setAutosave("stale")
      } else {
        setAutosave("error")
      }
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, excerpt, doc])

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value)
      if (!slugTouched) setSlug(slugify(value))
    },
    [slugTouched],
  )

  const toggleTag = useCallback((tagId: string) => {
    setTagIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]))
  }, [])

  const readingTime = estimateReadingTimeMinutes(doc)
  const words = wordCount(doc)

  const contentPayload = JSON.stringify(doc)
  const tagsPayload = JSON.stringify(tagIds)

  const autosaveLabel: Record<AutosaveState, string> = {
    idle: "",
    saving: "Kaydediliyor…",
    saved: "Taslak kaydedildi",
    stale: "Bu yazı başka bir sekmede güncellendi — sayfayı yenileyin.",
    error: "Taslak kaydedilemedi.",
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {post && <input type="hidden" name="postId" value={post.id} />}
      <input type="hidden" name="content_json" value={contentPayload} />
      <input type="hidden" name="tag_ids" value={tagsPayload} />
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="cover_media_id" value={cover.mediaId ?? ""} />
      <input type="hidden" name="cover_image_path" value={cover.path ?? ""} />
      <input type="hidden" name="og_media_id" value={og.mediaId ?? ""} />
      <input type="hidden" name="og_image_path" value={og.path ?? ""} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Temel bilgiler">
            <div className="space-y-5">
              <AdminInput
                label="Başlık"
                name="title"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                error={errors.title}
              />
              <AdminInput
                label="Kısa ad (URL)"
                name="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                error={errors.slug}
                hint="Yayında iken değiştirilirse eski adres otomatik yönlendirilir."
              />
              <AdminTextarea
                label="Özet"
                name="excerpt"
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                error={errors.excerpt}
                hint="Blog listesinde ve arama sonuçlarında görünür."
              />
            </div>
          </Panel>

          <Panel
            title="İçerik"
            description={`${words} kelime · ${readingTime} dk okuma`}
            bodyClassName="px-0 py-0 md:px-0"
          >
            <div className="p-4 md:p-5">
              <RichTextEditor
                initialContent={post?.contentJson ?? EMPTY_DOC}
                onUpdate={(next) => setDoc(next)}
              />
              {isEdit && (
                <p role="status" aria-live="polite" className="mt-2 text-xs text-ink/45">
                  {autosaveLabel[autosave]}
                </p>
              )}
              {!isEdit && (
                <p className="mt-2 text-xs text-ink/45">
                  Otomatik kaydetme, yazı ilk kez kaydedildikten sonra etkinleşir.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="SEO">
            <div className="space-y-5">
              <AdminInput
                label="SEO başlığı"
                name="seo_title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                error={errors.seo_title}
                hint="Boş bırakılırsa başlık kullanılır."
              />
              <AdminTextarea
                label="SEO açıklaması"
                name="seo_description"
                rows={2}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                error={errors.seo_description}
              />
              <AdminInput
                label="Kanonik adres"
                name="canonical_url"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                error={errors.canonical_url}
                hint="/blog/kisa-ad ya da https://…"
              />
              <AdminCheckbox
                name="allow_indexing"
                checked={allowIndexing}
                onChange={(e) => setAllowIndexing(e.target.checked)}
                label="Arama motorları dizinlesin"
              />
              <MediaField
                label="Open Graph görseli"
                asset={og}
                onPick={() => setOgPickerOpen(true)}
                onClear={() => setOg(toCoverDraft(null, null))}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Yayın">
            <div className="space-y-4">
              <AdminCheckbox
                name="featured"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                label="Öne çıkan yazı"
              />
              <AdminInput
                label="Yazar"
                name="author_name"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                hint="Boş bırakılabilir."
              />
              <AdminSelect label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Kategorisiz</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </AdminSelect>

              <div>
                <span className="label mb-1.5 block text-olive">Etiketler</span>
                <div className="flex flex-wrap gap-2">
                  {tags.length === 0 && <p className="text-xs text-ink/45">Henüz etiket yok.</p>}
                  {tags.map((tag) => {
                    const active = tagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleTag(tag.id)}
                        className={`min-h-9 rounded-full border px-3 text-xs transition-colors duration-200 ${
                          active ? "border-brand bg-brand/10 text-brand" : "border-ink/15 text-ink/60 hover:border-brand/40"
                        }`}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Kapak görseli">
            <MediaField label="" asset={cover} onPick={() => setCoverPickerOpen(true)} onClear={() => setCover(toCoverDraft(null, null))} large />
          </Panel>

          <FormMessage state={state} />
          <SubmitButton pendingLabel="Kaydediliyor…" className="w-full">
            Taslağı kaydet
          </SubmitButton>
        </div>
      </div>

      <MediaPicker
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        multiple={false}
        title="Kapak görseli seç"
        onConfirm={(assets) => {
          const asset = assets[0]
          if (asset) setCover({ mediaId: asset.id, path: asset.objectPath, url: asset.url })
          setCoverPickerOpen(false)
        }}
      />
      <MediaPicker
        open={ogPickerOpen}
        onClose={() => setOgPickerOpen(false)}
        multiple={false}
        title="Open Graph görseli seç"
        onConfirm={(assets) => {
          const asset = assets[0]
          if (asset) setOg({ mediaId: asset.id, path: asset.objectPath, url: asset.url })
          setOgPickerOpen(false)
        }}
      />
    </form>
  )
}

function MediaField({
  label,
  asset,
  onPick,
  onClear,
  large = false,
}: {
  label: string
  asset: CoverDraft
  onPick: () => void
  onClear: () => void
  large?: boolean
}) {
  return (
    <div>
      {label && <span className="label mb-1.5 block text-olive">{label}</span>}
      {asset.path ? (
        <div className="relative">
          <div className={`relative overflow-hidden rounded-[4px] bg-ink/[0.05] ${large ? "aspect-[4/3]" : "h-16 w-16"}`}>
            {asset.url && <Image src={asset.url} alt="" fill sizes="200px" className="object-cover" />}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onPick} className="text-xs text-brand hover:text-forest">
              Değiştir
            </button>
            <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs text-clay hover:text-clay/80">
              <X className="h-3 w-3" aria-hidden="true" /> Kaldır
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex min-h-11 w-full items-center justify-center rounded-[3px] border border-dashed border-ink/20 px-4 text-sm text-ink/55 transition-colors duration-200 hover:border-brand hover:text-brand"
        >
          Medyadan seç
        </button>
      )}
    </div>
  )
}
