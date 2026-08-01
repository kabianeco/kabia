"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { deleteMediaAction, uploadMediaAction } from "./actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { AdminButton, FormMessage, SubmitButton } from "@/components/admin/ui/form"
import { EmptyState, Panel } from "@/components/admin/ui/surfaces"
import { ConfirmAction } from "@/components/admin/ui/confirm-dialog"

export interface MediaObject {
  name: string
  path: string
  url: string
  size: number
  createdAt: string | null
  usedBy: { productId: string; productName: string }[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaUploader() {
  const [state, formAction] = useActionState(uploadMediaAction, ACTION_IDLE as never)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const result = state as { ok: boolean; message?: string; url?: string }
  const lastSeen = useRef<string | null>(null)

  useEffect(() => {
    if (result.ok && result.url && lastSeen.current !== result.url) {
      lastSeen.current = result.url
      router.refresh()
    }
  }, [result.ok, result.url, router])

  return (
    <Panel title="Görsel yükle" description="JPEG, PNG, WebP veya AVIF · en fazla 5 MB">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="media-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          aria-label="Yüklenecek görseli seçin"
          className="block w-full max-w-sm text-sm text-ink/70 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-ink/20 file:bg-transparent file:px-4 file:text-sm file:text-ink hover:file:border-brand hover:file:text-brand"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const data = new FormData()
            data.set("file", file)
            startTransition(() => formAction(data))
            event.target.value = ""
          }}
        />
        <Upload className="h-4 w-4 text-ink/30" aria-hidden="true" />
        {pending && (
          <span className="inline-flex items-center gap-2 text-xs text-ink/55" role="status">
            <span
              aria-hidden="true"
              className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none"
            />
            Yükleniyor…
          </span>
        )}
      </div>
      <div className="mt-3">
        <FormMessage state={result} />
      </div>
    </Panel>
  )
}

export function MediaGrid({ objects }: { objects: MediaObject[] }) {
  const [state, formAction] = useActionState(deleteMediaAction, ACTION_IDLE)
  const router = useRouter()
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  const filtered = query.trim()
    ? objects.filter((object) =>
        object.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")),
      )
    : objects

  if (objects.length === 0) {
    return (
      <EmptyState
        title="Henüz görsel yok"
        description="Yüklediğiniz görseller burada listelenir ve ürün düzenleme ekranından seçilebilir."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <label htmlFor="media-search" className="label mb-1.5 block text-olive">
          Dosya adına göre filtrele
        </label>
        <input
          id="media-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-11 w-full rounded-[3px] border border-ink/15 bg-ivory px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
          placeholder="badem…"
        />
      </div>

      <FormMessage state={state} />

      {filtered.length === 0 ? (
        <EmptyState title="Sonuç bulunamadı" compact />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((object) => (
            <li
              key={object.path}
              className="flex flex-col overflow-hidden rounded-[4px] border border-ink/10 bg-paper/50"
            >
              <div className="relative aspect-[4/3] bg-ink/[0.05]">
                <Image
                  src={object.url}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 90vw"
                  className="object-cover"
                  unoptimized
                />
              </div>

              <div className="flex flex-1 flex-col p-3">
                <p className="truncate text-sm text-ink" title={object.name}>
                  {object.name}
                </p>
                <p className="mt-1 text-xs text-ink/45">{formatBytes(object.size)}</p>

                {object.usedBy.length > 0 ? (
                  <p className="mt-2 text-xs text-ink/60">
                    Kullanımda: {object.usedBy.map((u) => u.productName).join(", ")}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink/40">Hiçbir üründe kullanılmıyor</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  <AdminButton
                    variant="ghost"
                    onClick={() => navigator.clipboard?.writeText(object.url)}
                  >
                    Adresi kopyala
                  </AdminButton>

                  {object.usedBy.length === 0 ? (
                    <ConfirmAction
                      trigger="Sil"
                      triggerVariant="danger"
                      title="Görseli sil"
                      description="Bu dosya Supabase Storage'dan kalıcı olarak silinir. İşlem geri alınamaz."
                      entityName={object.name}
                      confirmLabel="Sil"
                      pendingLabel="Siliniyor…"
                      action={formAction}
                      hiddenFields={{ path: object.path }}
                    />
                  ) : (
                    <span className="text-xs text-ink/40">
                      Kullanımda olduğu için silinemez
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SubmitPlaceholder() {
  return <SubmitButton>Kaydet</SubmitButton>
}
