import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeImage, PROBE_BYTES } from "@/lib/admin/image-probe"
import {
  MEDIA_BUCKET,
  MEDIA_CACHE_CONTROL,
  MEDIA_MAX_BYTES,
  safeObjectName,
  type MediaAsset,
  type MediaFolder,
} from "@/lib/admin/media"
import { toAsset, type MediaRow } from "@/lib/admin/queries/media"
import { MEDIA_MIME_TYPES } from "@/lib/admin/schemas"

/**
 * Validates one uploaded file, stores it, and catalogues it — the part of an
 * upload that does not depend on who is asking.
 *
 * The server action around it decides *whether* the caller may upload
 * (`adminContext`), audits and revalidates; this decides whether the file is
 * acceptable and what happens to Storage and the catalogue. Taking the Supabase
 * client as an argument keeps it testable without a session.
 *
 * The result carries a full library asset, so a picker that just uploaded a
 * file can select it immediately without a second round trip.
 *
 * Two kinds of failure are kept apart: "invalid" is the operator's file (a
 * message they can act on), "failed" is infrastructure (mapped to a safe message
 * and logged by the caller with `context`).
 */

export type MediaUploadResult =
  | { ok: true; asset: MediaAsset; path: string; url: string }
  | { ok: false; kind: "invalid"; message: string }
  | { ok: false; kind: "failed"; error: unknown; context: string }

const ASSET_COLUMNS =
  "id, bucket_id, object_path, original_filename, display_name, mime_type, file_size, width, height, alt_text, created_at, created_by"

export async function performMediaUpload(
  supabase: SupabaseClient,
  input: { file: FormDataEntryValue | null; folder?: MediaFolder | null; userId: string },
): Promise<MediaUploadResult> {
  const { file, folder, userId } = input

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, kind: "invalid", message: "Yüklenecek dosya seçilmedi." }
  }
  if (file.size > MEDIA_MAX_BYTES) {
    return { ok: false, kind: "invalid", message: "Dosya 10 MB sınırını aşıyor." }
  }
  if (!(MEDIA_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, kind: "invalid", message: "Yalnızca JPEG, PNG, WebP ve AVIF görselleri yüklenebilir." }
  }

  // The declared type is a claim; the bytes are the evidence. A file that says
  // image/png but does not begin with a PNG header is rejected before anything
  // is written, and the *probed* type — not the declared one — decides the
  // stored extension and content type from here on.
  const header = await file.slice(0, PROBE_BYTES).arrayBuffer()
  const probed = probeImage(header)
  if (!probed) {
    return {
      ok: false,
      kind: "invalid",
      message: "Dosya içeriği geçerli bir görsel değil. Yalnızca JPEG, PNG, WebP ve AVIF kabul edilir.",
    }
  }
  if (probed.format !== file.type) {
    return {
      ok: false,
      kind: "invalid",
      message: `Dosya türü içeriğiyle uyuşmuyor (gerçek içerik: ${probed.format}). Dosyayı doğru biçimde yeniden kaydedin.`,
    }
  }

  const path = safeObjectName(file.name, probed.format, folder)

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: probed.format, cacheControl: MEDIA_CACHE_CONTROL, upsert: false })
  if (uploadError) return { ok: false, kind: "failed", error: uploadError, context: "uploadMedia" }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)

  // Catalogue row second: if this fails the object is orphaned, so it is
  // removed again rather than left invisible to every screen in the app.
  const { data: row, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      bucket_id: MEDIA_BUCKET,
      object_path: path,
      original_filename: file.name.slice(0, 200),
      mime_type: probed.format,
      file_size: file.size,
      width: probed.width,
      height: probed.height,
      created_by: userId,
    })
    .select(ASSET_COLUMNS)
    .single()

  if (insertError || !row) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path])
    return {
      ok: false,
      kind: "failed",
      error: insertError ?? new Error("media row missing"),
      context: "uploadMedia:catalogue",
    }
  }

  const asset = toAsset(row as unknown as MediaRow, publicUrl, null)
  return { ok: true, asset, path, url: publicUrl }
}
