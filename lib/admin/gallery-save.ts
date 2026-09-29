import type { SupabaseClient } from "@supabase/supabase-js"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { fieldErrorsFrom, journalGallerySchema, productGallerySchema, uuid } from "@/lib/admin/schemas"

/**
 * Saves a gallery together with its main/cover image in ONE database call.
 *
 * admin_save_product_images / admin_save_journal_images do the whole write —
 * cover, deletions, updates, inserts, ordering — inside a single transaction, so
 * a failure leaves the previous gallery exactly as it was. Nothing here writes
 * image rows one by one: the previous editor did, and a failure part-way left a
 * product whose main image and gallery disagreed.
 *
 * Validation runs first, so a malformed payload never reaches the database, and
 * the database re-validates everything it is handed (it does not trust this).
 *
 * The Supabase client is an argument so the caller's own session — and with it
 * RLS — decides what is writable, and so tests can pass a stand-in.
 */

type GalleryFailure = ActionState & { ok: false }

export type GallerySaveResult = { ok: true; count: number } | GalleryFailure

const INVALID: GalleryFailure = { ok: false, message: "Görseller kaydedilemedi. Lütfen görselleri kontrol edin." }

interface ParsedImage {
  id?: string | null
  image_url: string
  alt_text?: string | null
  storage_path?: string | null
}

/** The array position *is* the sort order, so no sort_order is sent. */
function rpcImages(images: readonly ParsedImage[]) {
  return images.map((image) => ({
    id: image.id ?? null,
    image_url: image.image_url,
    alt_text: image.alt_text?.trim() ? image.alt_text.trim() : null,
    storage_path: image.storage_path?.trim() ? image.storage_path.trim() : null,
  }))
}

export async function saveProductGallery(
  supabase: SupabaseClient,
  productId: string,
  payload: unknown,
): Promise<GallerySaveResult> {
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Geçersiz ürün kimliği." }

  const parsed = productGallerySchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ...INVALID,
      fieldErrors: fieldErrorsFrom(parsed.error),
      message: parsed.error.issues[0]?.message ?? INVALID.message,
    }
  }

  const { data, error } = await supabase.rpc("admin_save_product_images", {
    p_product_id: productId,
    p_main_image_url: parsed.data.main_image_url,
    p_images: rpcImages(parsed.data.images),
  })
  if (error) return { ...toActionState(error, "saveProduct:images"), ok: false }
  return { ok: true, count: typeof data === "number" ? data : parsed.data.images.length }
}

export async function saveJournalGallery(
  supabase: SupabaseClient,
  entryId: string,
  payload: unknown,
): Promise<GallerySaveResult> {
  if (!uuid.safeParse(entryId).success) return { ok: false, message: "Geçersiz günlük kimliği." }

  const parsed = journalGallerySchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ...INVALID,
      fieldErrors: fieldErrorsFrom(parsed.error),
      message: parsed.error.issues[0]?.message ?? INVALID.message,
    }
  }

  const { data, error } = await supabase.rpc("admin_save_journal_images", {
    p_entry_id: entryId,
    p_cover_image_url: parsed.data.images.length === 0 ? null : parsed.data.main_image_url,
    p_images: rpcImages(parsed.data.images),
  })
  if (error) return { ...toActionState(error, "saveJournal:images"), ok: false }
  return { ok: true, count: typeof data === "number" ? data : parsed.data.images.length }
}

/**
 * The gallery and its main/cover image arrive as two form fields: `images` (a
 * JSON array in display order) and `main_image_url`. Returned unvalidated — the
 * schemas and the database do that — or null when the JSON itself is unreadable,
 * so nothing half-parsed ever reaches validation. No `images` field means an
 * empty gallery.
 */
export function parseGalleryFormFields(formData: FormData): { main_image_url: string; images: unknown[] } | null {
  const raw = formData.get("images")
  let images: unknown[] = []
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      images = parsed
    } catch {
      return null
    }
  }
  const main = formData.get("main_image_url")
  return { main_image_url: typeof main === "string" ? main.trim() : "", images }
}
