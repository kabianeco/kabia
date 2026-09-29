"use server"

import { redirect } from "next/navigation"
import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { fieldErrorsFrom, journalEntrySchema, journalGallerySchema, uuid } from "@/lib/admin/schemas"
import { buildJournalRow, buildJournalUpdateRow } from "@/lib/admin/journal-fields"
import { parseGalleryFormFields, saveJournalGallery } from "@/lib/admin/gallery-save"
import { loadJournalDetail } from "@/lib/admin/queries/journal"
import { JOURNAL_TAG } from "@/lib/journal"

/**
 * Journal mutations.
 *
 * Same shape as every other admin entity, without exception:
 *   1. re-derive the administrator and their permission from the session;
 *   2. validate the submitted shape with Zod;
 *   3. re-read the authoritative current row from the database — the form's
 *      idea of the current slug or publish state is never trusted;
 *   4. write through the administrator's own RLS-protected session;
 *   5. audit with the server-derived identity;
 *   6. revalidate the storefront paths the change touches.
 *
 * The cover image and the gallery are written together, in one database call
 * (lib/admin/gallery-save.ts), never statement by statement.
 */

function revalidateJournal(slug?: string | null) {
  revalidatePath("/admin/journal")
  revalidatePath("/gunluk")
  if (slug) revalidatePath(`/gunluk/${slug}`)
  // The orchard guide lists the latest three notes.
  revalidatePath("/rehber/geyve-badem-bahcesi")
  // The reads are tag-cached; the sitemap reads the same cache.
  updateTag(JOURNAL_TAG)
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

const entryIdSchema = z.object({ entryId: uuid })

export async function saveJournalEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let redirectTo: string | null = null

  try {
    const { supabase } = await adminContext("manageJournal")

    const rawId = formData.get("entryId")
    const entryId = typeof rawId === "string" && rawId ? rawId : null
    if (entryId && !uuid.safeParse(entryId).success) {
      return { ok: false, message: "Geçersiz günlük kimliği." }
    }

    const parsed = journalEntrySchema.safeParse({
      slug: formData.get("slug"),
      entry_date: formData.get("entry_date"),
      location: formData.get("location"),
      weather: formData.get("weather"),
      orchard_state: formData.get("orchard_state"),
      application: formData.get("application"),
      observation: formData.get("observation"),
      outcome: formData.get("outcome"),
      video_path: textOrNull(formData, "video_path"),
      is_published: boolField(formData, "is_published"),
    })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Lütfen işaretli alanları düzeltin." }
    }

    const gallery = parseGalleryFormFields(formData)
    if (gallery === null) return { ok: false, message: "Görseller okunamadı." }
    // Checked before anything is written, so a bad gallery never leaves a
    // half-saved entry behind. The save itself re-validates.
    const galleryCheck = journalGallerySchema.safeParse(gallery)
    if (!galleryCheck.success) {
      return {
        ok: false,
        fieldErrors: fieldErrorsFrom(galleryCheck.error),
        message: galleryCheck.error.issues[0]?.message ?? "Lütfen görselleri kontrol edin.",
      }
    }

    const input = parsed.data

    const before = entryId ? await loadJournalDetail(supabase, entryId) : null
    if (entryId && !before) return { ok: false, message: "Günlük notu bulunamadı." }

    // The slug is the public URL and never changes after creation, so it is
    // only checked for uniqueness when it is about to be written.
    if (!entryId) {
      const { data: slugMatch } = await supabase.from("journal_entries").select("id").eq("slug", input.slug).limit(1)
      if (slugMatch && slugMatch.length > 0) {
        return { ok: false, fieldErrors: { slug: "Bu kısa ad başka bir günlük notunda kullanılıyor." } }
      }
    }

    let savedId = entryId
    if (entryId) {
      const { error } = await supabase.from("journal_entries").update(buildJournalUpdateRow(input)).eq("id", entryId)
      if (error) return toActionState(error, "saveJournal:update")
    } else {
      const { data, error } = await supabase.from("journal_entries").insert(buildJournalRow(input)).select("id").single()
      if (error) return toActionState(error, "saveJournal:insert")
      savedId = data.id as string
    }
    if (!savedId) return { ok: false, message: "Günlük notu kaydedilemedi." }

    // Cover and gallery in one transaction.
    const savedGallery = await saveJournalGallery(supabase, savedId, gallery)
    const slug = before?.slug ?? input.slug

    if (!savedGallery.ok) {
      if (!entryId) {
        // The entry exists now; retrying "create" would only fail on its slug.
        // Send the operator to the entry itself, where the images can be re-added.
        revalidateJournal(slug)
        redirectTo = `/admin/journal/${savedId}?hata=gorsel`
      } else {
        return savedGallery
      }
    } else {
      const after = await loadJournalDetail(supabase, savedId)
      const audited = await logAdminAction(supabase, {
        action: entryId ? "journal.update" : "journal.create",
        entityType: "journal_entry",
        entityId: savedId,
        before: before ? { slug: before.slug, entry_date: before.entryDate, is_published: before.isPublished } : null,
        after: after ? { slug: after.slug, entry_date: after.entryDate, is_published: after.isPublished } : null,
        metadata: { image_count: gallery.images.length },
      })

      revalidateJournal(slug)

      if (!audited) return { ok: true, message: "Günlük notu kaydedildi.", warning: AUDIT_WARNING }
      redirectTo = `/admin/journal/${savedId}?kayit=1`
    }
  } catch (error) {
    return toActionState(error, "saveJournal")
  }

  if (redirectTo) redirect(redirectTo)
  return { ok: true, message: "Günlük notu kaydedildi." }
}

/**
 * Publish toggle. The target state is derived from the row just read, never
 * from the form, so a crafted request cannot present a stale state.
 */
export async function toggleJournalPublishedAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageJournal")
  const parsed = entryIdSchema.safeParse({ entryId: formData.get("entryId") })
  if (!parsed.success) return

  const before = await loadJournalDetail(supabase, parsed.data.entryId)
  if (!before) return

  const { error } = await supabase
    .from("journal_entries")
    .update({ is_published: !before.isPublished })
    .eq("id", before.id)
  if (error) {
    console.error("[admin] toggleJournalPublished:", error)
    return
  }

  await logAdminAction(supabase, {
    action: before.isPublished ? "journal.unpublish" : "journal.publish",
    entityType: "journal_entry",
    entityId: before.id,
    before: { is_published: before.isPublished },
    after: { is_published: !before.isPublished },
    metadata: { slug: before.slug },
  })

  revalidateJournal(before.slug)
  redirect(`/admin/journal/${before.id}?yayin=1`)
}

/**
 * Permanent deletion, allowed only for an unpublished entry. A published entry
 * is a live URL, so it has to be unpublished first; the database enforces the
 * same rule in its delete policy, this refuses with an explanation before asking.
 */
export async function deleteJournalEntryAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageJournal")
  const parsed = entryIdSchema.safeParse({ entryId: formData.get("entryId") })
  if (!parsed.success) return

  const before = await loadJournalDetail(supabase, parsed.data.entryId)
  if (!before) return

  if (before.isPublished) {
    redirect(`/admin/journal/${before.id}?hata=yayinda`)
  }

  const { error } = await supabase.from("journal_entries").delete().eq("id", before.id)
  if (error) {
    console.error("[admin] deleteJournalEntry:", error)
    redirect(`/admin/journal/${before.id}?hata=silinemedi`)
  }

  await logAdminAction(supabase, {
    action: "journal.delete",
    entityType: "journal_entry",
    entityId: before.id,
    before: { slug: before.slug, entry_date: before.entryDate },
    after: null,
    metadata: { image_count: before.gallery.items.length },
  })

  revalidateJournal(before.slug)
  redirect("/admin/journal?silindi=1")
}
