"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ArrowDown, ArrowUp, GripVertical, Image as ImageIcon, Trash2 } from "lucide-react"
import { MediaPicker } from "@/components/admin/media/media-picker"
import { AdminButton, AdminInput } from "@/components/admin/ui/form"
import {
  addAssets,
  galleryProblem,
  isAttached,
  MAX_GALLERY_IMAGES,
  moveDown,
  moveItem,
  moveUp,
  removeAt,
  setAlt,
  setMain,
  type GalleryState,
} from "@/lib/admin/gallery"
import type { MediaAsset, MediaFolder } from "@/lib/admin/media"
import { cn } from "@/lib/utils"

/**
 * The gallery editor shared by the product and journal editors: choose images
 * from the media library, put them in order, pick which one is the main (or
 * cover) image, write alt text per image.
 *
 * Controlled: the form owns the state (see lib/admin/gallery.ts for every rule)
 * and renders the hidden inputs that submit it, so this component is only the
 * interaction layer.
 *
 * Reordering works three ways, none of them exclusive:
 *   - drag the handle (native HTML5 drag and drop; only the handle is
 *     draggable, so text selection inside the alt-text field keeps working);
 *   - the "Yukarı" / "Aşağı" buttons, which are the keyboard and touch path —
 *     HTML5 drag and drop does not fire on touch screens, so the buttons are the
 *     way that works everywhere;
 *   - the same moves are announced through a polite live region.
 *
 * There is deliberately no free-text URL field: an image comes from the library
 * (picked or uploaded from inside the picker), so a mistyped address can never
 * end up on the storefront.
 */

export function GalleryEditor({
  state,
  onChange,
  fallbackAlt,
  folder,
  mainLabel,
  requireMain,
  error,
  emptyText,
}: {
  state: GalleryState
  onChange: (next: GalleryState) => void
  /** Alt text for an image that has none of its own: the record's name. */
  fallbackAlt: string
  /** Where uploads from the picker are filed in the bucket. */
  folder: MediaFolder
  /** Name of the highlighted image: "Ana görsel" (product) or "Kapak" (journal). */
  mainLabel: string
  /** Products need a main image; journal entries may have no images at all. */
  requireMain: boolean
  error?: string
  emptyText: string
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const listRef = useRef<HTMLOListElement>(null)
  // Moving a focused element in the DOM drops its focus; after a keyboard move
  // focus is put back on the same image's button so the next key press works.
  const pendingFocus = useRef<{ key: string; action: "up" | "down" } | null>(null)

  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    const row = listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(pending.key)}"]`)
    const preferred = row?.querySelector<HTMLButtonElement>(`[data-action="${pending.action}"]`)
    const other = row?.querySelector<HTMLButtonElement>(`[data-action="${pending.action === "up" ? "down" : "up"}"]`)
    ;(preferred && !preferred.disabled ? preferred : other)?.focus()
  }, [state.items])

  const problem = state.items.length > 0 ? galleryProblem(state, { requireMain }) : null
  const setMainLabel = `${mainLabel} yap`

  /** A drag-and-drop move. Keyboard moves go through the Yukarı / Aşağı buttons. */
  const relocate = (from: number, to: number) => {
    if (!state.items[from] || from === to) return
    onChange(moveItem(state, from, to))
    setAnnouncement(`${from + 1}. görsel ${to + 1}. sıraya taşındı.`)
  }

  const resetDrag = () => {
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <AdminButton variant="primary" onClick={() => setPickerOpen(true)} disabled={state.items.length >= MAX_GALLERY_IMAGES}>
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
          Medyadan seç
        </AdminButton>
        <p className="text-xs text-ink/50">
          Kütüphanedeki görselleri arayıp seçin ya da seçicinin içinden yeni dosya yükleyin.
        </p>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(assets: MediaAsset[]) =>
          onChange(addAssets(state, assets, { fallbackAlt, makeKey: () => crypto.randomUUID() }))
        }
        multiple
        folder={folder}
        isAttached={(asset) => isAttached(state.items, asset)}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {(error || problem) && (
        <p role="alert" className="mb-4 text-xs text-clay">
          {error ?? problem}
        </p>
      )}

      {state.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink/45">{emptyText}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink/45">
            {state.items.length} / {MAX_GALLERY_IMAGES} görsel · sırayı sürükleyerek ya da ok düğmeleriyle değiştirin
          </p>
          <ol ref={listRef} className="space-y-3">
            {state.items.map((item, index) => {
              const isMain = Boolean(item.imageUrl) && state.mainUrl === item.imageUrl
              return (
                <li
                  key={item.key}
                  data-key={item.key}
                  onDragOver={(event) => {
                    if (dragIndex === null) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    if (overIndex !== index) setOverIndex(index)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragIndex !== null) relocate(dragIndex, index)
                    resetDrag()
                  }}
                  className={cn(
                    // Stacked on a phone (thumbnail, full-width alt text, then the controls
                    // as a wrapping row); side by side from sm up.
                    "flex flex-col gap-3 rounded-[3px] border p-3 transition-colors sm:flex-row sm:flex-wrap sm:items-start sm:gap-4",
                    isMain ? "border-brand/50 bg-brand/[0.03]" : "border-ink/10 bg-ivory/60",
                    dragIndex === index && "opacity-50",
                    dragIndex !== null && overIndex === index && dragIndex !== index && "border-brand ring-2 ring-brand/30",
                  )}
                >
                  <span
                    draggable
                    aria-hidden="true"
                    title="Sıralamak için sürükleyin"
                    onDragStart={(event) => {
                      setDragIndex(index)
                      event.dataTransfer.effectAllowed = "move"
                      event.dataTransfer.setData("text/plain", String(index))
                      const row = event.currentTarget.closest("li")
                      if (row) event.dataTransfer.setDragImage(row, 16, 16)
                    }}
                    onDragEnd={resetDrag}
                    className="mt-1 hidden cursor-grab select-none text-ink/35 hover:text-ink/60 active:cursor-grabbing sm:block"
                  >
                    <GripVertical className="h-5 w-5" />
                  </span>

                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-media bg-ink/[0.06]">
                    {item.imageUrl && (
                      <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
                    )}
                  </span>

                  <div className="min-w-0 space-y-3 sm:flex-1">
                    {/* Position and main status are stated in text, not conveyed
                        by the highlighted border alone. */}
                    <p className="text-xs text-ink/50">
                      {index + 1}. sıra
                      {isMain && <span className="text-brand"> · {mainLabel}</span>}
                    </p>
                    <AdminInput
                      label="Alternatif metin"
                      value={item.altText}
                      maxLength={200}
                      hint="Görme engelli kullanıcılar ve arama motorları için kısa açıklama."
                      onChange={(event) => onChange(setAlt(state, index, event.target.value))}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1 sm:shrink-0 sm:flex-col">
                    <AdminButton
                      variant="ghost"
                      data-action="up"
                      aria-label={`${index + 1}. görseli yukarı taşı`}
                      disabled={index === 0}
                      onClick={() => {
                        pendingFocus.current = { key: item.key, action: "up" }
                        onChange(moveUp(state, index))
                        setAnnouncement(`${index + 1}. görsel ${index}. sıraya taşındı.`)
                      }}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      Yukarı
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      data-action="down"
                      aria-label={`${index + 1}. görseli aşağı taşı`}
                      disabled={index === state.items.length - 1}
                      onClick={() => {
                        pendingFocus.current = { key: item.key, action: "down" }
                        onChange(moveDown(state, index))
                        setAnnouncement(`${index + 1}. görsel ${index + 2}. sıraya taşındı.`)
                      }}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      Aşağı
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={() => {
                        onChange(setMain(state, index))
                        setAnnouncement(`${index + 1}. görsel ${mainLabel.toLocaleLowerCase("tr")} yapıldı.`)
                      }}
                      disabled={isMain || !item.imageUrl}
                    >
                      {isMain ? mainLabel : setMainLabel}
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      className="text-clay hover:text-clay"
                      onClick={() => {
                        onChange(removeAt(state, index))
                        setAnnouncement(`${index + 1}. görsel kaldırıldı.`)
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Kaldır
                    </AdminButton>
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}
