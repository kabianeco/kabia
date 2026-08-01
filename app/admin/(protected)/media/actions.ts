"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { MEDIA_MAX_BYTES, MEDIA_MIME_TYPES } from "@/lib/admin/schemas"
import { MEDIA_BUCKET, safeObjectName } from "@/lib/admin/media"

/**
 * Supabase Storage operations for product media.
 *
 * Uploads go through the *administrator's own* session, not the service-role
 * client, so the bucket policies are what authorise the write. A customer
 * session reaching this action would be rejected twice: by `adminContext` here,
 * and by `product_media_admin_insert` in the database.
 *
 * Type and size are checked here as well as in the bucket configuration. The
 * bucket is the boundary; this is the good error message.
 *
 * Note: every export of this module must be an async function — it is a
 * `"use server"` file. The bucket name and path helper therefore live in
 * lib/admin/media.ts.
 */

export interface UploadResult extends ActionState {
  url?: string
  path?: string
}

export async function uploadMediaAction(
  _prev: UploadResult,
  formData: FormData,
): Promise<UploadResult> {
  try {
    const { supabase } = await adminContext("manageMedia")

    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Yüklenecek dosya seçilmedi." }
    }
    if (!(MEDIA_MIME_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false, message: "Yalnızca JPEG, PNG, WebP ve AVIF görselleri yüklenebilir." }
    }
    if (file.size > MEDIA_MAX_BYTES) {
      return { ok: false, message: "Dosya 5 MB sınırını aşıyor." }
    }

    const path = safeObjectName(file.name, file.type)

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) return toActionState(error, "uploadMedia")

    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)

    const audited = await logAdminAction(supabase, {
      action: "media.upload",
      entityType: "media",
      entityId: path,
      after: { path, size: file.size, mime_type: file.type },
    })

    revalidatePath("/admin/media")

    return {
      ok: true,
      url: publicUrl,
      path,
      message: "Görsel yüklendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "uploadMedia")
  }
}

const deleteSchema = z.object({
  path: z.string().trim().min(1).max(500),
})

/**
 * Deletion refuses while any product image row still points at the object, so a
 * live storefront image cannot be removed out from under a product.
 */
export async function deleteMediaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageMedia")

    const parsed = deleteSchema.safeParse({ path: formData.get("path") })
    if (!parsed.success) return { ok: false, message: "Geçersiz dosya yolu." }

    const { path } = parsed.data

    const { data: publicUrlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
    const publicUrl = publicUrlData.publicUrl

    const [byPath, byUrl, asMain] = await Promise.all([
      supabase.from("product_images").select("id", { count: "exact", head: true }).eq("storage_path", path),
      supabase.from("product_images").select("id", { count: "exact", head: true }).eq("image_url", publicUrl),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("main_image_url", publicUrl),
    ])

    const referenceCount = (byPath.count ?? 0) + (byUrl.count ?? 0) + (asMain.count ?? 0)
    if (referenceCount > 0) {
      return {
        ok: false,
        message:
          "Bu görsel hâlâ bir üründe kullanılıyor. Önce ürünlerden kaldırın, sonra silin.",
      }
    }

    const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([path])
    if (error) return toActionState(error, "deleteMedia")

    const audited = await logAdminAction(supabase, {
      action: "media.delete",
      entityType: "media",
      entityId: path,
      before: { path },
      after: null,
    })

    revalidatePath("/admin/media")

    return {
      ok: true,
      message: "Görsel silindi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "deleteMedia")
  }
}
