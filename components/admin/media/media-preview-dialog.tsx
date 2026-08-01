"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import {
  deleteMediaAction,
  updateMediaMetadataAction,
} from "@/app/admin/(protected)/media/actions"
import { ACTION_IDLE } from "@/lib/admin/errors"
import { AdminButton, AdminInput, FormMessage, SubmitButton } from "@/components/admin/ui/form"
import {
  formatBytes,
  formatDimensions,
  MEDIA_MIME_LABELS,
  type MediaAsset,
  type MediaUsage,
} from "@/lib/admin/media"

/**
 * Full-size preview, metadata editor and deletion surface for one asset.
 *
 * Built on the native <dialog> with showModal(), like the rest of the
 * dashboard: focus trapping, Escape-to-close, focus restoration to the trigger
 * and inert background content come from the platform rather than from
 * hand-written key handlers.
 *
 * Deletion is refused here whenever a product references the asset, and the
 * referencing products are named and linked so the operator can go and detach
 * it rather than being told "no" with no way forward. The server enforces the
 * same rule independently — this is the explanation, not the boundary.
 */
export function MediaPreviewDialog({
  asset,
  usage,
  open,
  onClose,
}: {
  asset: MediaAsset | null
  usage: MediaUsage[]
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [metaState, metaAction] = useActionState(updateMediaMetadataAction, ACTION_IDLE)
  const [deleteState, deleteAction] = useActionState(deleteMediaAction, ACTION_IDLE)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Escape and backdrop dismissal both fire the dialog's own close event, so
  // the parent's state is reconciled from there rather than from a key handler.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handle = () => onClose()
    dialog.addEventListener("close", handle)
    return () => dialog.removeEventListener("close", handle)
  }, [onClose])

  useEffect(() => {
    if (deleteState.ok) {
      onClose()
      router.refresh()
    }
  }, [deleteState.ok, onClose, router])

  useEffect(() => {
    if (metaState.ok) router.refresh()
  }, [metaState.ok, router])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  if (!asset) return null

  const referenced = usage.length > 0

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="media-preview-title"
      onClick={(event) => {
        // Clicking the backdrop — that is, the dialog element itself rather
        // than the panel inside it — dismisses.
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-visible rounded-[4px] bg-transparent p-0 backdrop:bg-ink/40"
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[4px] border border-ink/10 bg-ivory">
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <h2 id="media-preview-title" className="min-w-0 font-serif text-lg text-ink">
            <span className="block truncate">{asset.label}</span>
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Önizlemeyi kapat"
            className="-mr-1 shrink-0 rounded-[2px] p-2 text-ink/45 transition-colors hover:text-ink focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-brand"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-ink/[0.05]">
            <Image
              src={asset.url}
              alt={asset.altText ?? asset.label}
              fill
              sizes="(min-width: 768px) 32rem, 90vw"
              className="object-contain"
            />
          </div>

          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <Detail label="Dosya adı" value={asset.originalFilename} />
              <Detail
                label="Tür"
                value={MEDIA_MIME_LABELS[asset.mimeType] ?? asset.mimeType}
              />
              <Detail label="Boyut" value={formatBytes(asset.fileSize)} />
              <Detail label="Ölçüler" value={formatDimensions(asset.width, asset.height)} />
              <Detail
                label="Yüklenme"
                value={new Date(asset.createdAt).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
              <Detail label="Yükleyen" value={asset.uploadedBy ?? "Bilinmiyor"} />
            </dl>

            <div>
              <p className="label mb-1.5 text-olive">Kullanım</p>
              {referenced ? (
                <ul className="space-y-1">
                  {usage.map((entry) => (
                    <li key={entry.productId} className="text-xs">
                      <Link
                        href={`/admin/products/${entry.productId}`}
                        prefetch={false}
                        className="text-brand underline underline-offset-2 hover:text-forest"
                      >
                        {entry.productName}
                      </Link>
                      {entry.isPrimary && <span className="text-ink/45"> · ana görsel</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink/45">Hiçbir üründe kullanılmıyor.</p>
              )}
            </div>

            <form action={metaAction} className="space-y-3">
              <input type="hidden" name="id" value={asset.id} />
              <AdminInput
                label="Görünen ad"
                name="display_name"
                defaultValue={asset.displayName ?? ""}
                maxLength={120}
                hint="Kütüphanede dosya adı yerine gösterilir."
              />
              <AdminInput
                label="Alternatif metin"
                name="alt_text"
                defaultValue={asset.altText ?? ""}
                maxLength={200}
                hint="Görseli göremeyen ziyaretçiler ve arama motorları için kısa açıklama."
              />
              <FormMessage state={metaState} />
              <SubmitButton variant="outline" pendingLabel="Kaydediliyor…">
                Bilgileri kaydet
              </SubmitButton>
            </form>

            <div className="space-y-2 border-t border-ink/10 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdminButton
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(asset.url)
                    setCopied(true)
                  }}
                >
                  {copied ? "Kopyalandı" : "Adresi kopyala"}
                </AdminButton>

                {referenced ? (
                  <p className="text-xs text-ink/50">
                    Kullanımda olduğu için silinemez. Önce yukarıdaki ürünlerden kaldırın.
                  </p>
                ) : (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={asset.id} />
                    <SubmitButton variant="danger" pendingLabel="Siliniyor…">
                      Görseli sil
                    </SubmitButton>
                  </form>
                )}
              </div>
              <FormMessage state={deleteState} />
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label text-olive">{label}</dt>
      <dd className="mt-0.5 truncate text-ink/75" title={value}>
        {value}
      </dd>
    </div>
  )
}
