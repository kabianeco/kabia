"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { mediaMetadataSchema } from "@/lib/admin/schemas"
import { isMediaFolder, type MediaAsset, type MediaFolder } from "@/lib/admin/media"
import { performMediaUpload } from "@/lib/admin/media-upload"
import { loadMediaUsage, MediaUsageUnavailableError } from "@/lib/admin/queries/media"
import { deleteBlockedMessage } from "@/lib/admin/media-usage"

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
  /** The catalogued asset, so a picker can select what it just uploaded. */
  asset?: MediaAsset
}

async function revalidateMedia() {
  revalidatePath("/admin/media")
  // The picker is rendered inside these, and reads the same catalogue.
  revalidatePath("/admin/products/new")
  revalidatePath("/admin/products", "layout")
  revalidatePath("/admin/producers", "layout")
  revalidatePath("/admin/journal", "layout")
}

export async function uploadMediaAction(
  _prev: UploadResult,
  formData: FormData,
): Promise<UploadResult> {
  try {
    const { session, supabase } = await adminContext("manageMedia")

    // Where the object is filed. Absent means the library's own YYYY-MM/ layout;
    // anything present must be one of the known content folders.
    const rawFolder = formData.get("folder")
    let folder: MediaFolder | null = null
    if (rawFolder !== null && rawFolder !== "") {
      if (!isMediaFolder(rawFolder)) return { ok: false, message: "Geçersiz yükleme klasörü." }
      folder = rawFolder
    }

    const result = await performMediaUpload(supabase, {
      file: formData.get("file"),
      folder,
      userId: session.userId,
    })
    if (!result.ok) {
      return result.kind === "invalid"
        ? { ok: false, message: result.message }
        : toActionState(result.error, result.context)
    }

    const { asset, path, url } = result
    const audited = await logAdminAction(supabase, {
      action: "media.upload",
      entityType: "media",
      entityId: asset.id,
      after: {
        path,
        size: asset.fileSize,
        mime_type: asset.mimeType,
        width: asset.width,
        height: asset.height,
      },
      metadata: { original_filename: asset.originalFilename, folder },
    })

    await revalidateMedia()

    return {
      ok: true,
      id: asset.id,
      url,
      path,
      asset,
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
 * Deletion refuses while any product, producer or journal entry still points at
 * the object, so a live storefront image cannot be removed out from under it. If
 * usage cannot be determined the delete is refused too.
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

    let usage
    try {
      usage = await loadMediaUsage(supabase, [
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
    } catch (error) {
      // Cannot tell whether it is in use, so it is not deleted.
      if (error instanceof MediaUsageUnavailableError) return { ok: false, message: error.message }
      throw error
    }

    const referencing = usage.get(row.id) ?? []
    if (referencing.length > 0) {
      return { ok: false, message: deleteBlockedMessage(referencing) }
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
