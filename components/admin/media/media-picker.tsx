"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Check, Search, X } from "lucide-react"
import { MediaThumb } from "@/components/admin/media/media-thumb"
import { AdminButton } from "@/components/admin/ui/form"
import {
  formatBytes,
  formatDimensions,
  MEDIA_MIME_LABELS,
  MEDIA_PAGE_SIZE,
  type MediaAsset,
} from "@/lib/admin/media"
import { cn } from "@/lib/utils"

/**
 * The media library, as a picker, inside the product editor.
 *
 * The point of this component is that an operator never has to leave the
 * product they are editing, go to /admin/media, copy a URL and paste it back.
 * It fetches the same catalogue the library page reads, through the same
 * RLS-governed route handler, one page at a time — the whole bucket is never
 * pulled into the browser.
 *
 * Selection is not communicated by colour alone: a selected tile gets a check
 * mark, a ring, and `aria-pressed`, so it is legible to a screen reader and to
 * anyone who cannot distinguish the ring colour.
 *
 * Built on the native <dialog> with showModal(), consistent with the rest of
 * the dashboard, which supplies focus trapping, Escape-to-close and focus
 * restoration without hand-written key handling.
 */

interface PickerState {
  assets: MediaAsset[]
  total: number
  page: number
  loading: boolean
  error: string | null
}

const EMPTY: PickerState = { assets: [], total: 0, page: 1, loading: false, error: null }

export function MediaPicker({
  open,
  onClose,
  onConfirm,
  multiple = true,
  initialSelected = [],
  title = "Medyadan seç",
}: {
  open: boolean
  onClose: () => void
  onConfirm: (assets: MediaAsset[]) => void
  multiple?: boolean
  /** Object paths already attached to the product, shown as pre-selected. */
  initialSelected?: string[]
  title?: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchId = useId()
  const [state, setState] = useState<PickerState>(EMPTY)
  const [query, setQuery] = useState("")
  const [mimeType, setMimeType] = useState("")
  const [selected, setSelected] = useState<Map<string, MediaAsset>>(new Map())

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Every dismissal route — Escape, the backdrop, the close button, Cancel and
  // Confirm — ends in the dialog's own close event, so the selection is cleared
  // there rather than in an effect keyed on `open`. That keeps "cancel really
  // cancels" true without a setState-during-effect cascade on every open.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handle = () => {
      setSelected(new Map())
      onClose()
    }
    dialog.addEventListener("close", handle)
    return () => dialog.removeEventListener("close", handle)
  }, [onClose])

  const load = useCallback(
    async (page: number, search: string, mime: string, append: boolean) => {
      setState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const params = new URLSearchParams({ page: String(page) })
        if (search.trim().length >= 2) params.set("q", search.trim())
        if (mime) params.set("tur", mime)

        const response = await fetch(`/admin/media/api?${params}`, {
          cache: "no-store",
        })
        if (!response.ok) throw new Error(String(response.status))
        const body = (await response.json()) as { assets: MediaAsset[]; total: number }

        setState((prev) => ({
          assets: append ? [...prev.assets, ...body.assets] : body.assets,
          total: body.total,
          page,
          loading: false,
          error: null,
        }))
      } catch {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Medya kütüphanesi yüklenemedi. Tekrar deneyin.",
        }))
      }
    },
    [],
  )

  // Debounced: typing "badem" issues one request, not five.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void load(1, query, mimeType, false), 300)
    return () => window.clearTimeout(timer)
  }, [open, query, mimeType, load])

  const toggle = (asset: MediaAsset) => {
    setSelected((prev) => {
      const next = new Map(multiple ? prev : [])
      if (prev.has(asset.id) && (multiple || prev.size === 1)) next.delete(asset.id)
      else next.set(asset.id, asset)
      return next
    })
  }

  const confirm = () => {
    onConfirm([...selected.values()])
    dialogRef.current?.close()
  }

  const hasMore = state.assets.length < state.total

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="media-picker-title"
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
      className="m-auto w-[min(64rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] rounded-[4px] bg-transparent p-0 backdrop:bg-ink/40"
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col rounded-[4px] border border-ink/10 bg-ivory">
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id="media-picker-title" className="font-serif text-lg text-ink">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-ink/50">
              {multiple
                ? "Bir veya daha fazla görsel seçebilirsiniz."
                : "Bir görsel seçin."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Seçiciyi kapat"
            className="-mr-1 shrink-0 rounded-[2px] p-2 text-ink/45 transition-colors hover:text-ink focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-brand"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-ink/10 px-5 py-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label htmlFor={searchId} className="label mb-1.5 block text-olive">
              Ara
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/30"
                aria-hidden="true"
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="badem…"
                className="min-h-11 w-full rounded-[3px] border border-ink/15 bg-ivory pl-9 pr-3 text-sm text-ink placeholder:text-ink/30 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${searchId}-mime`} className="label mb-1.5 block text-olive">
              Tür
            </label>
            <select
              id={`${searchId}-mime`}
              value={mimeType}
              onChange={(event) => setMimeType(event.target.value)}
              className="min-h-11 cursor-pointer rounded-[3px] border border-ink/15 bg-ivory px-3 pr-8 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40"
            >
              <option value="">Tüm türler</option>
              {Object.entries(MEDIA_MIME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <p className="ml-auto text-xs text-ink/50" aria-live="polite">
            {selected.size > 0 ? `${selected.size} görsel seçildi` : "Seçim yok"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {state.error && (
            <p role="alert" className="rounded-[3px] border border-clay/30 bg-clay/5 px-3 py-2 text-sm text-clay">
              {state.error}
            </p>
          )}

          {!state.error && state.assets.length === 0 && !state.loading && (
            <div className="py-12 text-center">
              <p className="text-sm text-ink/60">
                {query || mimeType
                  ? "Aramanızla eşleşen görsel yok."
                  : "Kütüphanede henüz görsel yok."}
              </p>
              <p className="mt-1.5 text-xs text-ink/40">
                Görselleri Medya sayfasından yükleyebilirsiniz.
              </p>
            </div>
          )}

          {state.assets.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {state.assets.map((asset) => {
                const isSelected = selected.has(asset.id)
                const alreadyAttached = initialSelected.includes(asset.objectPath)
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      onClick={() => toggle(asset)}
                      aria-pressed={isSelected}
                      className={cn(
                        "group relative block w-full overflow-hidden rounded-[4px] border text-left transition-colors duration-200 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand",
                        isSelected
                          ? "border-brand ring-2 ring-brand/40"
                          : "border-ink/10 hover:border-brand/40",
                      )}
                    >
                      <span className="relative block aspect-square bg-ink/[0.05]">
                        <MediaThumb
                          asset={asset}
                          sizes="(min-width: 1280px) 11rem, (min-width: 640px) 20vw, 45vw"
                        />
                        {isSelected && (
                          <span
                            aria-hidden="true"
                            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-on-brand"
                          >
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                      <span className="block p-2">
                        <span className="block truncate text-xs text-ink" title={asset.label}>
                          {asset.label}
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-ink/45">
                          {formatDimensions(asset.width, asset.height)} ·{" "}
                          {formatBytes(asset.fileSize)}
                        </span>
                        {alreadyAttached && (
                          <span className="mt-0.5 block text-[0.6875rem] text-olive">
                            Bu üründe ekli
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {state.loading && (
            <p role="status" className="py-6 text-center text-xs text-ink/50">
              Yükleniyor…
            </p>
          )}

          {hasMore && !state.loading && (
            <div className="mt-5 text-center">
              <AdminButton
                variant="outline"
                onClick={() => void load(state.page + 1, query, mimeType, true)}
              >
                Daha fazla göster ({state.assets.length}/{state.total})
              </AdminButton>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 px-5 py-4">
          <AdminButton variant="ghost" onClick={() => dialogRef.current?.close()}>
            Vazgeç
          </AdminButton>
          <AdminButton onClick={confirm} disabled={selected.size === 0}>
            {selected.size > 0 ? `${selected.size} görseli ekle` : "Seçimi onayla"}
          </AdminButton>
        </div>
      </div>
    </dialog>
  )
}

export { MEDIA_PAGE_SIZE }
