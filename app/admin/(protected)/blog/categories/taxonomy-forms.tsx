"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  createBlogCategoryAction,
  createBlogTagAction,
  deleteBlogCategoryAction,
  deleteBlogTagAction,
  updateBlogCategoryAction,
} from "../actions"
import { slugify } from "@/lib/blog/slug"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { AdminButton, AdminCheckbox, AdminInput, AdminTextarea, FormMessage, SubmitButton } from "@/components/admin/ui/form"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"

export function CategoryForm() {
  const [state, formAction] = useActionState(createBlogCategoryAction, ACTION_IDLE)
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (state.ok) {
      setName("")
      setSlug("")
      setSlugTouched(false)
      router.refresh()
    }
  }, [state.ok, router])

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label="Kategori adı"
          name="name"
          required
          value={name}
          error={state.fieldErrors?.name}
          onChange={(e) => {
            setName(e.target.value)
            if (!slugTouched) setSlug(slugify(e.target.value))
          }}
        />
        <AdminInput
          label="Kısa ad (URL)"
          name="slug"
          required
          value={slug}
          error={state.fieldErrors?.slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(slugify(e.target.value))
          }}
        />
      </div>
      <AdminTextarea label="Açıklama" name="description" rows={2} />
      <input type="hidden" name="sort_order" value="0" />
      <AdminCheckbox name="is_active" defaultChecked label="Etkin" />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Ekleniyor…">Kategori ekle</SubmitButton>
    </form>
  )
}

export function CategoryRowActions({
  categoryId,
  name,
  slug,
  postCount,
}: {
  categoryId: string
  name: string
  slug: string
  postCount: number
}) {
  const [editing, setEditing] = useState(false)
  const handleCancel = useCallback(() => setEditing(false), [])

  if (editing) {
    return <CategoryEditForm categoryId={categoryId} initialName={name} initialSlug={slug} onCancel={handleCancel} />
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <AdminButton variant="ghost" onClick={() => setEditing(true)}>
        Düzenle
      </AdminButton>
      <ConfirmAction
        trigger="Sil"
        triggerVariant="ghost"
        tone="danger"
        title="Kategoriyi sil"
        description={
          postCount > 0
            ? `Bu işlem geri alınamaz. ${postCount} yazı bu kategoriden ayrılır (yazılar silinmez).`
            : "Bu işlem geri alınamaz."
        }
        entityName={name}
        confirmLabel="Sil"
        pendingLabel="Siliniyor…"
        action={deleteBlogCategoryAction}
        hiddenFields={{ categoryId }}
      />
    </div>
  )
}

function CategoryEditForm({
  categoryId,
  initialName,
  initialSlug,
  onCancel,
}: {
  categoryId: string
  initialName: string
  initialSlug: string
  onCancel: () => void
}) {
  const [state, formAction] = useActionState(updateBlogCategoryAction, ACTION_IDLE)
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    if (state.ok) {
      onCancelRef.current()
      router.refresh()
    }
  }, [state.ok, router])

  return (
    <div className="w-full">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="sort_order" value="0" />
        <AdminInput label="Kategori adı" name="name" required value={name} error={state.fieldErrors?.name} onChange={(e) => setName(e.target.value)} wrapperClassName="min-w-0 flex-1" />
        <AdminInput label="Kısa ad" name="slug" required value={slug} error={state.fieldErrors?.slug} onChange={(e) => setSlug(slugify(e.target.value))} wrapperClassName="min-w-0 flex-1" />
        <AdminCheckbox name="is_active" defaultChecked label="Etkin" />
        <div className="flex shrink-0 items-end gap-2">
          <AdminButton variant="ghost" onClick={onCancel}>
            İptal
          </AdminButton>
          <SubmitButton pendingLabel="Kaydediliyor…">Kaydet</SubmitButton>
        </div>
      </form>
      <FormMessage state={state} />
    </div>
  )
}

export function TagForm() {
  const [state, formAction] = useActionState(createBlogTagAction, ACTION_IDLE)
  const router = useRouter()
  const [name, setName] = useState("")

  useEffect(() => {
    if (state.ok) {
      setName("")
      router.refresh()
    }
  }, [state.ok, router])

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      <AdminInput
        label="Etiket adı"
        name="name"
        required
        value={name}
        error={state.fieldErrors?.name}
        onChange={(e) => setName(e.target.value)}
        wrapperClassName="min-w-0 flex-1 sm:max-w-xs"
      />
      <input type="hidden" name="slug" value={slugify(name)} />
      <SubmitButton pendingLabel="Ekleniyor…">Etiket ekle</SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function TagChip({ tagId, name }: { tagId: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 py-1 pl-3 pr-1 text-xs text-ink/70">
      {name}
      <ConfirmAction
        trigger="×"
        triggerVariant="ghost"
        triggerClassName="!min-h-0 !px-1.5 !py-0.5 text-sm"
        tone="danger"
        title="Etiketi sil"
        description="Bu işlem geri alınamaz. Etiket, kullanıldığı yazılardan da kaldırılır."
        entityName={name}
        confirmLabel="Sil"
        pendingLabel="Siliniyor…"
        action={deleteBlogTagAction}
        hiddenFields={{ tagId }}
      />
    </span>
  )
}
