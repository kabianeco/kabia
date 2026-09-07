"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import {
  fieldErrorsFrom,
  producerSchema,
  uuid,
} from "@/lib/admin/schemas"
import { buildProducerRow } from "@/lib/admin/producer-fields"
import {
  countProducerProductReferences,
  loadProducerDetail,
} from "@/lib/admin/queries/producers"

/**
 * Producer mutations.
 *
 * Same shape as every other admin entity, without exception:
 *   1. re-derive the administrator and their permission from the session;
 *   2. validate the submitted shape with Zod;
 *   3. re-read the authoritative current row from the database — the form's
 *      idea of the current slug or publish state is never trusted;
 *   4. write through the administrator's own RLS-protected session;
 *   5. audit with the server-derived identity;
 *   6. revalidate the storefront paths the change touches.
 */

function revalidateProducerRoutes(slug?: string | null) {
  revalidatePath("/admin/producers")
  revalidatePath("/ureticiler")
  revalidatePath("/secki")
  revalidatePath("/magaza")
  if (slug) {
    revalidatePath(`/ureticiler/${slug}`)
    revalidatePath(`/magaza/${slug}`)
  }
}

function boolField(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true"
}

function textOrNull(formData: FormData, name: string): string | null {
  const value = formData.get(name)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export async function saveProducerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let redirectTo: string | null = null

  try {
    const { session, supabase } = await adminContext("manageProducers")

    const rawId = formData.get("producerId")
    const producerId = typeof rawId === "string" && rawId ? rawId : null
    if (producerId && !uuid.safeParse(producerId).success) {
      return { ok: false, message: "Geçersiz üretici kimliği." }
    }

    const parsed = producerSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      source: formData.get("source"),
      desc: formData.get("desc"),
      region: textOrNull(formData, "region"),
      product_type: textOrNull(formData, "product_type"),
      photo_url: textOrNull(formData, "photo_url"),
      story: textOrNull(formData, "story"),
      production_place: textOrNull(formData, "production_place"),
      method: textOrNull(formData, "method"),
      inputs: textOrNull(formData, "inputs"),
      certificates: textOrNull(formData, "certificates"),
      why_selected: textOrNull(formData, "why_selected"),
      is_published: boolField(formData, "is_published"),
      sort_order: formData.get("sort_order") ?? "0",
    })

    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fieldErrorsFrom(parsed.error),
        message: "Lütfen işaretli alanları düzeltin.",
      }
    }

    const input = parsed.data

    // Slug uniqueness, checked before writing so the operator gets a
    // field-level message rather than a raw unique-violation.
    const slugQuery = supabase.from("producers").select("id").eq("slug", input.slug).limit(1)
    const { data: slugMatch } = producerId
      ? await slugQuery.neq("id", producerId)
      : await slugQuery
    if (slugMatch && slugMatch.length > 0) {
      return {
        ok: false,
        fieldErrors: { slug: "Bu kısa ad başka bir üreticide kullanılıyor." },
      }
    }

    const before = producerId ? await loadProducerDetail(supabase, producerId) : null
    if (producerId && !before) {
      return { ok: false, message: "Üretici bulunamadı." }
    }

    const producerRow = buildProducerRow(input)

    let savedId = producerId

    if (producerId) {
      const { error } = await supabase.from("producers").update(producerRow).eq("id", producerId)
      if (error) return toActionState(error, "saveProducer:update")
    } else {
      const { data, error } = await supabase
        .from("producers")
        .insert(producerRow)
        .select("id")
        .single()
      if (error) return toActionState(error, "saveProducer:insert")
      savedId = data.id as string
    }

    if (!savedId) return { ok: false, message: "Üretici kaydedilemedi." }

    const after = await loadProducerDetail(supabase, savedId)

    const audited = await logAdminAction(supabase, {
      action: producerId ? "producer.update" : "producer.create",
      entityType: "producer",
      entityId: savedId,
      before: before
        ? { name: before.name, slug: before.slug, is_published: before.isPublished }
        : null,
      after: after
        ? { name: after.name, slug: after.slug, is_published: after.isPublished }
        : null,
      metadata: { source: input.source },
    })

    revalidateProducerRoutes(input.slug)
    if (before?.slug && before.slug !== input.slug) {
      revalidatePath(`/ureticiler/${before.slug}`)
      revalidatePath(`/magaza/${before.slug}`)
    }

    if (!audited) {
      return { ok: true, message: "Üretici kaydedildi.", warning: AUDIT_WARNING }
    }

    void session
    redirectTo = `/admin/producers/${savedId}?kayit=1`
  } catch (error) {
    return toActionState(error, "saveProducer")
  }

  if (redirectTo) redirect(redirectTo)
  return { ok: true, message: "Üretici kaydedildi." }
}

/**
 * Publish toggle. The target state is derived from the row just read, never
 * from the form, so a crafted request cannot present a stale state.
 */
export async function toggleProducerPublishedAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageProducers")
  const parsed = producerIdSchema.safeParse({ producerId: formData.get("producerId") })
  if (!parsed.success) return

  const before = await loadProducerDetail(supabase, parsed.data.producerId)
  if (!before) return

  const { error } = await supabase
    .from("producers")
    .update({ is_published: !before.isPublished })
    .eq("id", before.id)
  if (error) {
    console.error("[admin] toggleProducerPublished:", error)
    return
  }

  await logAdminAction(supabase, {
    action: before.isPublished ? "producer.unpublish" : "producer.publish",
    entityType: "producer",
    entityId: before.id,
    before: { is_published: before.isPublished },
    after: { is_published: !before.isPublished },
    metadata: { name: before.name, slug: before.slug },
  })

  revalidateProducerRoutes(before.slug)
  redirect(`/admin/producers/${before.id}?yayin=1`)
}

const producerIdSchema = z.object({ producerId: uuid })

/**
 * Permanent deletion, allowed only when no product points at the producer.
 * `products.producer_id` is ON DELETE SET NULL, so the database would let the
 * delete through and silently unlink products — the action refuses first, the
 * way product deletion refuses when order history points at it.
 */
export async function deleteProducerAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageProducers")
  const parsed = producerIdSchema.safeParse({ producerId: formData.get("producerId") })
  if (!parsed.success) return

  const before = await loadProducerDetail(supabase, parsed.data.producerId)
  if (!before) return

  const references = await countProducerProductReferences(supabase, before.id)
  if (references > 0) {
    redirect(`/admin/producers/${before.id}?hata=urun-referansi`)
  }

  const { error } = await supabase.from("producers").delete().eq("id", before.id)
  if (error) {
    console.error("[admin] deleteProducer:", error)
    redirect(`/admin/producers/${before.id}?hata=silinemedi`)
  }

  await logAdminAction(supabase, {
    action: "producer.delete",
    entityType: "producer",
    entityId: before.id,
    before: { name: before.name, slug: before.slug },
    after: null,
    metadata: { product_references: references },
  })

  revalidateProducerRoutes(before.slug)
  redirect("/admin/producers?silindi=1")
}
