"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { fieldErrorsFrom, slugSchema, uuid } from "@/lib/admin/schemas"

/**
 * Category lifecycle.
 *
 * Creating a category only requires a name and a URL slug. Deletion is refused
 * by the database itself when any product still references the category, so the
 * action only has to translate that failure into a readable message.
 */

const categorySchema = z.object({
  name: z.string().trim().min(2, "Kategori adı en az 2 karakter olmalı.").max(60),
  slug: slugSchema,
})

const categoryIdSchema = z.object({ categoryId: uuid })

function revalidateCategoryRoutes() {
  revalidatePath("/admin/categories")
  revalidatePath("/admin/products")
  revalidatePath("/admin/products/new")
  revalidatePath("/shop")
  revalidatePath("/")
}

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageCategories")

    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
    })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Lütfen alanları düzeltin." }
    }

    const slugQuery = await supabase.from("categories").select("id").eq("slug", parsed.data.slug).limit(1)
    if (slugQuery.error) return toActionState(slugQuery.error, "createCategory:slugCheck")
    if (slugQuery.data && slugQuery.data.length > 0) {
      return { ok: false, fieldErrors: { slug: "Bu kısa ad başka bir kategori tarafından kullanılıyor." } }
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({ name: parsed.data.name, slug: parsed.data.slug })
      .select("id")
      .single()

    if (error) return toActionState(error, "createCategory")

    const audited = await logAdminAction(supabase, {
      action: "category.create",
      entityType: "category",
      entityId: data.id as string,
      after: { name: parsed.data.name, slug: parsed.data.slug },
      metadata: { created_by: session.userId },
    })

    revalidateCategoryRoutes()

    return {
      ok: true,
      message: "Kategori eklendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "createCategory")
  }
}

export async function updateCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { session, supabase } = await adminContext("manageCategories")

    const parsed = categorySchema
      .extend({ categoryId: uuid })
      .safeParse({
        categoryId: formData.get("categoryId"),
        name: formData.get("name"),
        slug: formData.get("slug"),
      })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Lütfen alanları düzeltin." }
    }

    const { data: before } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("id", parsed.data.categoryId)
      .maybeSingle()
    if (!before) return { ok: false, message: "Kategori bulunamadı." }

    const slugQuery = await supabase
      .from("categories")
      .select("id")
      .eq("slug", parsed.data.slug)
      .neq("id", parsed.data.categoryId)
      .limit(1)
    if (slugQuery.error) return toActionState(slugQuery.error, "updateCategory:slugCheck")
    if (slugQuery.data && slugQuery.data.length > 0) {
      return { ok: false, fieldErrors: { slug: "Bu kısa ad başka bir kategori tarafından kullanılıyor." } }
    }

    const { error } = await supabase
      .from("categories")
      .update({ name: parsed.data.name, slug: parsed.data.slug })
      .eq("id", parsed.data.categoryId)

    if (error) return toActionState(error, "updateCategory")

    const audited = await logAdminAction(supabase, {
      action: "category.update",
      entityType: "category",
      entityId: before.id,
      before: { name: before.name, slug: before.slug },
      after: { name: parsed.data.name, slug: parsed.data.slug },
      metadata: { updated_by: session.userId },
    })

    revalidateCategoryRoutes()

    return {
      ok: true,
      message: "Kategori güncellendi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "updateCategory")
  }
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  try {
    const { supabase } = await adminContext("manageCategories")

    const parsed = categoryIdSchema.safeParse({ categoryId: formData.get("categoryId") })
    if (!parsed.success) return

    const { data: before } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("id", parsed.data.categoryId)
      .maybeSingle()
    if (!before) return

    const { error } = await supabase.from("categories").delete().eq("id", parsed.data.categoryId)
    if (error) {
      console.error("[admin] deleteCategory:", error)
      return
    }

    await logAdminAction(supabase, {
      action: "category.delete",
      entityType: "category",
      entityId: before.id,
      before: { name: before.name, slug: before.slug },
      after: null,
    })

    revalidateCategoryRoutes()
  } catch (error) {
    console.error("[admin] deleteCategory:", error)
  }
}
