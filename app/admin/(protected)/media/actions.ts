"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { mediaMetadataSchema, MEDIA_MIME_TYPES } from "@/lib/admin/schemas"
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, safeObjectName } from "@/lib/admin/media"
import { probeImage, PROBE_BYTES } from "@/lib/admin/image-probe"
import { loadMediaUsage } from "@/lib/admin/queries/media"

/**
 * Supabase Storage + catalogue operations for product media.
 *
 * Uploads go through the *administrator's own* session, never the service-role
 * client, so the bucket policies are what authorise the write. A customer
 * session reaching these actions would be rejected three times over: by
 * `adminContext` here, by `product_media_admin_insert` on storage.objects, and
 * by `media_assets_admin_insert` on the catalogue row.
 *
 * Note: every export of this module must be an async function — it is a
 * `"use server"` file. Constants and helpers therefore live in
 * lib/admin/media.ts.
 */

export interface UploadResult extends ActionState {
  url?: string
  path?: string
  id?: string
}

async function revalidateMedia() {
  revalidatePath("/admin/media")
  // The picker is rendered inside these, and reads the same catalogue.
  revalidatePath("/admin/products/new")
  revalidatePath("/admin/products", "layout")
}

export async function uploadMediaAction(
  _prev: UploadResult,
  formData: FormData,
): Promise<UploadResult> {
  try {
    const { session, supabase } = await adminContext("manageMedia")

    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Yüklenecek dosya seçilmedi." }
    }
    if (file.size > MEDIA_MAX_BYTES) {
      return { ok: false, message: "Dosya 10 MB sınırını aşıyor." }
    }
    if (!(MEDIA_MIME_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false, message: "Yalnızca JPEG, PNG, WebP ve AVIF görselleri yüklenebilir." }
    }

    // The declared type is a claim; the bytes are the evidence. A file that
    // says image/png but does not begin with a PNG header is rejected before
    // anything is written, and the *probed* type — not the declared one —
    // decides the stored extension and content type from here on.
    const header = await file.slice(0, PROBE_BYTES).arrayBuffer()
    const probed = probeImage(header)
    if (!probed) {
      return {
        ok: false,
        message:
          "Dosya içeriği geçerli bir görsel değil. Yalnızca JPEG, PNG, WebP ve AVIF kabul edilir.",
      }
    }
    if (probed.format !== file.type) {
      return {
        ok: false,
        message: `Dosya türü içeriğiyle uyuşmuyor (gerçek içerik: ${probed.format}). Dosyayı doğru biçimde yeniden kaydedin.`,
      }
    }

    const path = safeObjectName(file.name, probed.format)

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { contentType: probed.format, upsert: false })

    if (uploadError) return toActionState(uploadError, "uploadMedia")

    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)

    // Catalogue row second: if this fails the object is orphaned, so it is
    // removed again rather than left invisible to every screen in the app.
    const { data: asset, error: insertError } = await supabase
      .from("media_assets")
      .insert({
        bucket_id: MEDIA_BUCKET,
        object_path: path,
        original_filename: file.name.slice(0, 200),
        mime_type: probed.format,
        file_size: file.size,
        width: probed.width,
        height: probed.height,
        created_by: session.userId,
      })
      .select("id")
      .single()

    if (insertError || !asset) {
      await supabase.storage.from(MEDIA_BUCKET).remove([path])
      return toActionState(insertError ?? new Error("media row missing"), "uploadMedia:catalogue")
    }

    const audited = await logAdminAction(supabase, {
      action: "media.upload",
      entityType: "media",
      entityId: asset.id,
      after: {
        path,
        size: file.size,
        mime_type: probed.format,
        width: probed.width,
        height: probed.height,
      },
      metadata: { original_filename: file.name },
    })

    await revalidateMedia()

    return {
      ok: true,
      id: asset.id,
      url: publicUrl,
      path,
      message: "Görsel yüklendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "uploadMedia")
  }
}

/** Alt text and display name. Nothing here touches the stored object. */
export async function updateMediaMetadataAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageMedia")

    const parsed = mediaMetadataSchema.safeParse({
      id: formData.get("id"),
      display_name: formData.get("display_name"),
      alt_text: formData.get("alt_text"),
    })
    if (!parsed.success) return { ok: false, message: "Geçersiz görsel bilgisi." }

    const { data: before } = await supabase
      .from("media_assets")
      .select("id, display_name, alt_text")
      .eq("id", parsed.data.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!before) return { ok: false, message: "Görsel bulunamadı." }

    const { error } = await supabase
      .from("media_assets")
      .update({ display_name: parsed.data.display_name, alt_text: parsed.data.alt_text })
      .eq("id", parsed.data.id)

    if (error) return toActionState(error, "updateMediaMetadata")

    const audited = await logAdminAction(supabase, {
      action: "media.update",
      entityType: "media",
      entityId: parsed.data.id,
      before: { display_name: before.display_name, alt_text: before.alt_text },
      after: { display_name: parsed.data.display_name, alt_text: parsed.data.alt_text },
    })

    await revalidateMedia()
    return {
      ok: true,
      message: "Görsel bilgileri güncellendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "updateMediaMetadata")
  }
}

const deleteSchema = z.object({ id: z.string().uuid() })

/**
 * Deletion refuses while any product still points at the object, so a live
 * storefront image cannot be removed out from under a product.
 *
 * The order is deliberate: the catalogue row is soft-deleted first, then the
 * Storage object is removed, then the row is hard-deleted where permitted. If
 * the Storage step fails the soft delete is rolled back, so what never happens
 * is a product pointing at a missing file, or a row nobody can see.
 */
export async function deleteMediaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageMedia")

    const parsed = deleteSchema.safeParse({ id: formData.get("id") })
    if (!parsed.success) return { ok: false, message: "Geçersiz görsel kimliği." }

    const { data: row } = await supabase
      .from("media_assets")
      .select(
        "id, bucket_id, object_path, original_filename, display_name, mime_type, file_size, width, height, alt_text, created_at, created_by",
      )
      .eq("id", parsed.data.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!row) return { ok: false, message: "Görsel bulunamadı." }

    const {
      data: { publicUrl },
    } = supabase.storage.from(row.bucket_id).getPublicUrl(row.object_path)

    const usage = await loadMediaUsage(supabase, [
      {
        id: row.id,
        bucketId: row.bucket_id,
        objectPath: row.object_path,
        url: publicUrl,
        originalFilename: row.original_filename,
        displayName: row.display_name,
        label: row.display_name || row.original_filename,
        mimeType: row.mime_type,
        fileSize: Number(row.file_size),
        width: row.width,
        height: row.height,
        altText: row.alt_text,
        createdAt: row.created_at,
        uploadedBy: null,
      },
    ])

    const referencing = usage.get(row.id) ?? []
    if (referencing.length > 0) {
      const names = referencing.map((entry) => entry.productName).join(", ")
      return {
        ok: false,
        message: `Bu görsel şu ürünlerde kullanılıyor: ${names}. Önce ürünlerden kaldırın, sonra silin.`,
      }
    }

    const { error: softError } = await supabase
      .from("media_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", row.id)
    if (softError) return toActionState(softError, "deleteMedia:soft")

    const { error: storageError } = await supabase.storage
      .from(row.bucket_id)
      .remove([row.object_path])

    if (storageError) {
      // Put the row back: nothing was removed, so the library should still show
      // it rather than hiding an object that is still there.
      await supabase.from("media_assets").update({ deleted_at: null }).eq("id", row.id)
      return toActionState(storageError, "deleteMedia:storage")
    }

    // Hard delete is super-admin only by policy; an ordinary administrator
    // leaves the soft-deleted record behind, which is itself part of the trail.
    if (session.role === "super_admin") {
      await supabase.from("media_assets").delete().eq("id", row.id)
    }

    const audited = await logAdminAction(supabase, {
      action: "media.delete",
      entityType: "media",
      entityId: row.id,
      before: { path: row.object_path, original_filename: row.original_filename },
      after: null,
      metadata: { hard_deleted: session.role === "super_admin" },
    })

    await revalidateMedia()
    return {
      ok: true,
      message: "Görsel silindi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "deleteMedia")
  }
}
