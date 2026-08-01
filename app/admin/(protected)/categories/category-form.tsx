"use client"

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "./actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import {
  AdminButton,
  AdminInput,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui/form"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function CategoryForm() {
  const [state, formAction] = useActionState(createCategoryAction, ACTION_IDLE)
  const router = useRouter()
  const id = useId()
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
          placeholder="Örn. Kuruyemiş"
          error={state.fieldErrors?.name}
          onChange={(event) => {
            const next = event.target.value
            setName(next)
            if (!slugTouched) setSlug(slugify(next))
          }}
        />
        <AdminInput
          label="Kısa ad (URL)"
          name="slug"
          required
          value={slug}
          placeholder="Orn. kuruyemis"
          error={state.fieldErrors?.slug}
          onChange={(event) => {
            setSlugTouched(true)
            setSlug(slugify(event.target.value))
          }}
          hint="Yalnızca küçük harf, rakam ve tire."
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Ekleniyor…">Kategori ekle</SubmitButton>
      <span id={`${id}-hint`} className="sr-only">
        Kategori adı girildiğinde kısa ad otomatik oluşur.
      </span>
    </form>
  )
}

export function CategoryRowActions({
  categoryId,
  name: initialName,
  slug: initialSlug,
  productCount,
}: {
  categoryId: string
  name: string
  slug: string
  productCount: number
}) {
  const [editing, setEditing] = useState(false)
  const handleCancel = useCallback(() => setEditing(false), [])

  if (editing) {
    return (
      <CategoryEditForm
        categoryId={categoryId}
        initialName={initialName}
        initialSlug={initialSlug}
        productCount={productCount}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <AdminButton variant="ghost" onClick={() => setEditing(true)}>
        Düzenle
      </AdminButton>
      {productCount > 0 ? (
        <span className="text-xs text-ink/40">Ürün bağlı</span>
      ) : (
        <ConfirmAction
          trigger="Sil"
          triggerVariant="ghost"
          tone="danger"
          title="Kategoriyi sil"
          description="Bu işlem geri alınamaz. Kategori kalıcı olarak silinecek."
          entityName={initialName}
          confirmLabel="Sil"
          pendingLabel="Siliniyor…"
          action={deleteCategoryAction}
          hiddenFields={{ categoryId }}
        />
      )}
    </div>
  )
}

function CategoryEditForm({
  categoryId,
  initialName,
  initialSlug,
  productCount,
  onCancel,
}: {
  categoryId: string
  initialName: string
  initialSlug: string
  productCount: number
  onCancel: () => void
}) {
  const [state, formAction] = useActionState(updateCategoryAction, ACTION_IDLE)
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
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
        <form action={formAction} className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="categoryId" value={categoryId} />
          <AdminInput
            label="Kategori adı"
            name="name"
            required
            value={name}
            error={state.fieldErrors?.name}
            onChange={(event) => setName(event.target.value)}
            wrapperClassName="min-w-0 flex-1"
          />
          <AdminInput
            label="Kısa ad"
            name="slug"
            required
            value={slug}
            error={state.fieldErrors?.slug}
            onChange={(event) => setSlug(slugify(event.target.value))}
            wrapperClassName="min-w-0 flex-1"
          />
          <div className="flex shrink-0 items-end gap-2">
            <AdminButton variant="ghost" onClick={onCancel}>
              İptal
            </AdminButton>
            <SubmitButton pendingLabel="Kaydediliyor…">Kaydet</SubmitButton>
          </div>
        </form>
        <div className="flex shrink-0 items-end">
          {productCount === 0 ? (
            <ConfirmAction
              trigger="Sil"
              triggerVariant="danger"
              tone="danger"
              title="Kategoriyi sil"
              description="Bu işlem geri alınamaz. Kategori kalıcı olarak silinecek."
              entityName={initialName}
              confirmLabel="Sil"
              pendingLabel="Siliniyor…"
              action={deleteCategoryAction}
              hiddenFields={{ categoryId }}
            />
          ) : (
            <span className="inline-flex min-h-11 items-center text-xs text-ink/40">
              Silinemez
            </span>
          )}
        </div>
      </div>
      <FormMessage state={state} />
    </div>
  )
}
