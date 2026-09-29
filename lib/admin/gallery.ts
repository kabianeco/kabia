import type { MediaAsset } from "@/lib/admin/media"

/**
 * The gallery model shared by the product and journal editors.
 *
 * An ordered list of images, one of which is the main (product) or cover
 * (journal) image. Position is display order. "Main" is tracked by URL rather
 * than by position, so reordering the gallery never silently changes which
 * image is main.
 *
 * Every function returns a new state and never mutates its input, so the editor
 * can hold it in React state and the tests can compare before and after.
 *
 * Pure: no React, no Next, no Supabase — this is the logic the UI is a thin
 * skin over, which is why it is where the tests are.
 */

/** Mirrors the ceiling enforced by the save RPCs. */
export const MAX_GALLERY_IMAGES = 30

export interface GalleryItem {
  /** Stable React key: the saved row's id, or a client-made key for a new image. */
  key: string
  /** The saved row's id; null for an image that has not been saved yet. */
  id: string | null
  imageUrl: string
  altText: string
  storagePath: string | null
}

export interface GalleryState {
  items: GalleryItem[]
  /** URL of the main/cover image; "" when the gallery is empty. */
  mainUrl: string
}

export interface SavedImageRow {
  id: string
  imageUrl: string
  altText: string | null
  storagePath: string | null
}

export function galleryFromRows(rows: readonly SavedImageRow[], mainUrl: string): GalleryState {
  return {
    items: rows.map((row) => ({
      key: row.id,
      id: row.id,
      imageUrl: row.imageUrl,
      altText: row.altText ?? "",
      storagePath: row.storagePath,
    })),
    mainUrl,
  }
}

/**
 * Adds assets picked from the library, in selection order.
 *
 * An asset already attached — matched by URL *or* object path, because older
 * rows carry only a URL — is skipped. Alt text comes from the library when the
 * asset has one, else from `fallbackAlt` (the record's own name), and stays
 * editable per image: the same photograph can warrant a different description
 * elsewhere. The first image a record ever receives becomes its main image, so
 * the common case needs no second click.
 */
export function addAssets(
  state: GalleryState,
  assets: readonly MediaAsset[],
  options: { fallbackAlt: string; makeKey: () => string },
): GalleryState {
  const items = [...state.items]
  for (const asset of assets) {
    if (items.length >= MAX_GALLERY_IMAGES) break
    if (isAttached(items, asset)) continue
    items.push({
      key: options.makeKey(),
      id: null,
      imageUrl: asset.url,
      altText: asset.altText?.trim() || options.fallbackAlt,
      storagePath: asset.objectPath,
    })
  }
  const mainUrl = state.mainUrl || items[0]?.imageUrl || ""
  return { items, mainUrl }
}

/** Whether the asset is already in the gallery, by URL or by object path. */
export function isAttached(items: readonly GalleryItem[], asset: Pick<MediaAsset, "url" | "objectPath">): boolean {
  return items.some((item) => item.imageUrl === asset.url || item.storagePath === asset.objectPath)
}

const inRange = (state: GalleryState, index: number) => Number.isInteger(index) && index >= 0 && index < state.items.length

export function moveItem(state: GalleryState, from: number, to: number): GalleryState {
  if (!inRange(state, from) || !inRange(state, to) || from === to) return { ...state, items: [...state.items] }
  const items = [...state.items]
  const [moved] = items.splice(from, 1)
  items.splice(to, 0, moved)
  return { ...state, items }
}

export const moveUp = (state: GalleryState, index: number) => moveItem(state, index, index - 1)
export const moveDown = (state: GalleryState, index: number) => moveItem(state, index, index + 1)

export function setMain(state: GalleryState, index: number): GalleryState {
  if (!inRange(state, index)) return state
  return { ...state, mainUrl: state.items[index].imageUrl }
}

/**
 * Removes an image. Removing the main image promotes the next one (or the
 * previous when it was last) — a product must always have a main image, and a
 * gallery that just lost its main should not be left without one.
 */
export function removeAt(state: GalleryState, index: number): GalleryState {
  if (!inRange(state, index)) return state
  const removed = state.items[index]
  const items = state.items.filter((_, i) => i !== index)
  if (removed.imageUrl !== state.mainUrl) return { items, mainUrl: state.mainUrl }
  const promoted = items[index] ?? items[index - 1]
  return { items, mainUrl: promoted?.imageUrl ?? "" }
}

export function setAlt(state: GalleryState, index: number, altText: string): GalleryState {
  if (!inRange(state, index)) return state
  return { ...state, items: state.items.map((item, i) => (i === index ? { ...item, altText } : item)) }
}

export interface GalleryPayload {
  main_image_url: string
  images: { id: string | null; image_url: string; alt_text: string; storage_path: string | null }[]
}

/** What the editor submits: the gallery in display order plus the main image. */
export function toPayload(state: GalleryState): GalleryPayload {
  return {
    main_image_url: state.mainUrl,
    images: state.items.map((item) => ({
      id: item.id,
      image_url: item.imageUrl.trim(),
      alt_text: item.altText.trim(),
      storage_path: item.storagePath,
    })),
  }
}

/**
 * The reason a gallery cannot be saved, in Turkish, or null when it can. A
 * product needs a main image (products.main_image_url is NOT NULL); a journal
 * entry may have no images, but once it has any it needs a cover.
 */
export function galleryProblem(state: GalleryState, options: { requireMain: boolean }): string | null {
  const urls = state.items.map((item) => item.imageUrl.trim())
  if (options.requireMain && urls.length === 0) return "En az bir görsel ekleyin."
  if (new Set(urls).size !== urls.length) return "Aynı görsel galeride birden fazla kez yer alamaz."
  if (urls.length > 0 && !urls.includes(state.mainUrl.trim())) {
    return options.requireMain ? "Ana görsel galerideki görsellerden biri olmalı." : "Kapak görseli galerideki görsellerden biri olmalı."
  }
  return null
}
