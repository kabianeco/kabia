"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction, AUDIT_WARNING } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import {
  fieldErrorsFrom,
  imageSchema,
  nutritionSchema,
  productSchema,
  uuid,
  variantSchema,
} from "@/lib/admin/schemas"
import { countOrderReferences, loadProductDetail } from "@/lib/admin/queries/products"

/**
 * Product mutations.
 *
 * Shape of every one of these, without exception:
 *   1. re-derive the administrator and their permission from the session;
 *   2. validate the submitted shape with Zod;
 *   3. re-read the authoritative current row from the database — the form's
 *      idea of the current price, stock or status is never trusted;
 *   4. write through the administrator's own RLS-protected session;
 *   5. audit with the server-derived identity;
 *   6. revalidate the storefront paths the change touches.
 *
 * The storefront reads products through a cookie-bound server client, so its
 * pages are already dynamic and pick changes up on the next request. The
 * revalidate calls below make that explicit rather than incidental.
 */

function revalidateStorefront(slug?: string | null) {
  revalidatePath("/")
  revalidatePath("/shop")
  revalidatePath("/magaza")
  if (slug) revalidatePath(`/shop/${slug}`)
  revalidatePath("/admin/products")
  revalidatePath("/admin/inventory")
}

/** Variants and images travel as JSON so the array shape survives FormData. */
function parseJsonField<T>(raw: FormDataEntryValue | null, schema: z.ZodType<T>): T[] | null {
  if (typeof raw !== "string" || raw.trim() === "") return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const result: T[] = []
    for (const entry of parsed) {
      const check = schema.safeParse(entry)
      if (!check.success) return null
      result.push(check.data)
    }
    return result
  } catch {
    return null
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

export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let redirectTo: string | null = null

  try {
    const { session, supabase } = await adminContext("manageCatalogue")

    const rawId = formData.get("productId")
    const productId = typeof rawId === "string" && rawId ? rawId : null
    if (productId && !uuid.safeParse(productId).success) {
      return { ok: false, message: "Geçersiz ürün kimliği." }
    }

    const variants = parseJsonField(formData.get("variants"), variantSchema)
    const images = parseJsonField(formData.get("images"), imageSchema)
    if (variants === null || images === null) {
      return { ok: false, message: "Ürün seçenekleri veya görselleri okunamadı." }
    }

    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      category_id: formData.get("category_id"),
      short_description: formData.get("short_description"),
      description: formData.get("description"),
      base_price: formData.get("base_price"),
      original_price: formData.get("original_price") ?? "",
      main_image_url: formData.get("main_image_url"),
      origin: textOrNull(formData, "origin"),
      production_method: textOrNull(formData, "production_method"),
      shelf_life: textOrNull(formData, "shelf_life"),
      storage_conditions: textOrNull(formData, "storage_conditions"),
      certifications: textOrNull(formData, "certifications"),
      is_active: boolField(formData, "is_active"),
      is_featured: boolField(formData, "is_featured"),
      low_stock_threshold: formData.get("low_stock_threshold") ?? "5",
      display_order: formData.get("display_order") ?? "0",
      seo_title: textOrNull(formData, "seo_title"),
      seo_description: textOrNull(formData, "seo_description"),
      variants,
    })

    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fieldErrorsFrom(parsed.error),
        message: "Lütfen işaretli alanları düzeltin.",
      }
    }

    const nutritionParsed = nutritionSchema.safeParse({
      calories: textOrNull(formData, "nutrition_calories"),
      protein: textOrNull(formData, "nutrition_protein"),
      carbohydrates: textOrNull(formData, "nutrition_carbohydrates"),
      fat: textOrNull(formData, "nutrition_fat"),
      fiber: textOrNull(formData, "nutrition_fiber"),
      sodium: textOrNull(formData, "nutrition_sodium"),
    })
    if (!nutritionParsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(nutritionParsed.error) }
    }

    const input = parsed.data

    // Slug uniqueness, checked before writing so the operator gets a field-level
    // message rather than a raw unique-violation.
    const slugQuery = supabase.from("products").select("id").eq("slug", input.slug).limit(1)
    const { data: slugMatch } = productId
      ? await slugQuery.neq("id", productId)
      : await slugQuery
    if (slugMatch && slugMatch.length > 0) {
      return {
        ok: false,
        fieldErrors: { slug: "Bu kısa ad başka bir üründe kullanılıyor." },
      }
    }

    const before = productId ? await loadProductDetail(supabase, productId) : null
    if (productId && !before) {
      return { ok: false, message: "Ürün bulunamadı." }
    }

    const productRow = {
      name: input.name,
      slug: input.slug,
      category_id: input.category_id,
      short_description: input.short_description,
      description: input.description,
      base_price: input.base_price,
      original_price: input.original_price,
      main_image_url: input.main_image_url,
      origin: input.origin ?? null,
      production_method: input.production_method ?? null,
      shelf_life: input.shelf_life ?? null,
      storage_conditions: input.storage_conditions ?? null,
      certifications: input.certifications ?? null,
      is_active: input.is_active,
      is_featured: input.is_featured,
      low_stock_threshold: input.low_stock_threshold,
      display_order: input.display_order,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
    }

    let savedId = productId

    if (productId) {
      const { error } = await supabase.from("products").update(productRow).eq("id", productId)
      if (error) return toActionState(error, "saveProduct:update")
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert(productRow)
        .select("id")
        .single()
      if (error) return toActionState(error, "saveProduct:insert")
      savedId = data.id as string
    }

    if (!savedId) return { ok: false, message: "Ürün kaydedilemedi." }

    // ---- variants -----------------------------------------------------------
    // Stock is deliberately NOT taken from this form for existing variants: it
    // moves only through the audited inventory adjustment path. The value
    // written back is the one already in the database.
    const existingById = new Map((before?.variants ?? []).map((v) => [v.id, v]))
    const submittedIds = new Set(
      input.variants.map((v) => v.id).filter((id): id is string => Boolean(id)),
    )

    const removedIds = [...existingById.keys()].filter((id) => !submittedIds.has(id))
    if (removedIds.length > 0) {
      const { error } = await supabase.from("product_variants").delete().in("id", removedIds)
      if (error) return toActionState(error, "saveProduct:variantDelete")
    }

    for (const variant of input.variants) {
      const existing = variant.id ? existingById.get(variant.id) : undefined
      if (existing) {
        const { error } = await supabase
          .from("product_variants")
          .update({
            label: variant.label,
            price: variant.price,
            sku: variant.sku ?? null,
            stock_quantity: existing.stockQuantity,
          })
          .eq("id", existing.id)
        if (error) return toActionState(error, "saveProduct:variantUpdate")
      } else {
        const { error } = await supabase.from("product_variants").insert({
          product_id: savedId,
          label: variant.label,
          price: variant.price,
          sku: variant.sku ?? null,
          stock_quantity: variant.stock_quantity,
        })
        if (error) return toActionState(error, "saveProduct:variantInsert")
      }
    }

    // ---- images -------------------------------------------------------------
    const existingImageIds = new Set((before?.images ?? []).map((i) => i.id))
    const submittedImageIds = new Set(
      images.map((i) => i.id).filter((id): id is string => Boolean(id)),
    )
    const removedImageIds = [...existingImageIds].filter((id) => !submittedImageIds.has(id))
    if (removedImageIds.length > 0) {
      const { error } = await supabase
        .from("product_images")
        .delete()
        .in("id", removedImageIds)
      if (error) return toActionState(error, "saveProduct:imageDelete")
    }

    for (const [index, image] of images.entries()) {
      const payload = {
        image_url: image.image_url,
        alt_text: image.alt_text ?? null,
        sort_order: index,
        storage_path: image.storage_path ?? null,
      }
      if (image.id && existingImageIds.has(image.id)) {
        const { error } = await supabase
          .from("product_images")
          .update(payload)
          .eq("id", image.id)
        if (error) return toActionState(error, "saveProduct:imageUpdate")
      } else {
        const { error } = await supabase
          .from("product_images")
          .insert({ ...payload, product_id: savedId })
        if (error) return toActionState(error, "saveProduct:imageInsert")
      }
    }

    // ---- nutrition ----------------------------------------------------------
    const nutrition = nutritionParsed.data
    const hasNutrition = Object.values(nutrition).some((v) => v && String(v).trim() !== "")
    if (hasNutrition) {
      const { error } = await supabase.from("nutrition_facts").upsert(
        {
          product_id: savedId,
          calories: nutrition.calories ?? null,
          protein: nutrition.protein ?? null,
          carbohydrates: nutrition.carbohydrates ?? null,
          fat: nutrition.fat ?? null,
          fiber: nutrition.fiber ?? null,
          sodium: nutrition.sodium ?? null,
        },
        { onConflict: "product_id" },
      )
      if (error) return toActionState(error, "saveProduct:nutrition")
    }

    const after = await loadProductDetail(supabase, savedId)

    const audited = await logAdminAction(supabase, {
      action: productId ? "product.update" : "product.create",
      entityType: "product",
      entityId: savedId,
      before: before
        ? { name: before.name, slug: before.slug, base_price: before.basePrice, is_active: before.isActive, is_featured: before.isFeatured }
        : null,
      after: after
        ? { name: after.name, slug: after.slug, base_price: after.basePrice, is_active: after.isActive, is_featured: after.isFeatured }
        : null,
      metadata: { variant_count: input.variants.length, image_count: images.length },
    })

    revalidateStorefront(input.slug)
    if (before?.slug && before.slug !== input.slug) revalidatePath(`/shop/${before.slug}`)

    if (!audited) {
      return { ok: true, message: "Ürün kaydedildi.", warning: AUDIT_WARNING }
    }

    void session
    redirectTo = `/admin/products/${savedId}?kayit=1`
  } catch (error) {
    return toActionState(error, "saveProduct")
  }

  if (redirectTo) redirect(redirectTo)
  return { ok: true, message: "Ürün kaydedildi." }
}

const productIdSchema = z.object({ productId: uuid })

/**
 * Archival, not deletion. A product referenced by a historical order must keep
 * existing so that order still renders.
 */
export async function archiveProductAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageCatalogue")
  const parsed = productIdSchema.safeParse({ productId: formData.get("productId") })
  if (!parsed.success) return

  const before = await loadProductDetail(supabase, parsed.data.productId)
  if (!before) return

  const { error } = await supabase
    .from("products")
    .update({ is_active: false, is_featured: false })
    .eq("id", parsed.data.productId)
  if (error) {
    console.error("[admin] archiveProduct:", error)
    return
  }

  await logAdminAction(supabase, {
    action: "product.archive",
    entityType: "product",
    entityId: before.id,
    before: { is_active: true, is_featured: before.isFeatured },
    after: { is_active: false, is_featured: false },
    metadata: { name: before.name, slug: before.slug },
  })

  revalidateStorefront(before.slug)
  redirect(`/admin/products/${before.id}?arsiv=1`)
}

export async function restoreProductAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageCatalogue")
  const parsed = productIdSchema.safeParse({ productId: formData.get("productId") })
  if (!parsed.success) return

  const before = await loadProductDetail(supabase, parsed.data.productId)
  if (!before) return

  const { error } = await supabase
    .from("products")
    .update({ is_active: true })
    .eq("id", parsed.data.productId)
  if (error) {
    console.error("[admin] restoreProduct:", error)
    return
  }

  await logAdminAction(supabase, {
    action: "product.restore",
    entityType: "product",
    entityId: before.id,
    before: { is_active: false },
    after: { is_active: true },
    metadata: { name: before.name, slug: before.slug },
  })

  revalidateStorefront(before.slug)
  redirect(`/admin/products/${before.id}?yayin=1`)
}

/**
 * Permanent deletion, allowed only when nothing historical points at the
 * product. If any order line references it, the request is refused — order
 * history is never rewritten to make a catalogue tidy.
 */
export async function deleteProductAction(formData: FormData): Promise<void> {
  const { supabase } = await adminContext("manageCatalogue")
  const parsed = productIdSchema.safeParse({ productId: formData.get("productId") })
  if (!parsed.success) return

  const before = await loadProductDetail(supabase, parsed.data.productId)
  if (!before) return

  const references = await countOrderReferences(supabase, before.id)
  if (references > 0) {
    redirect(`/admin/products/${before.id}?hata=siparis-referansi`)
  }

  const { error } = await supabase.from("products").delete().eq("id", before.id)
  if (error) {
    console.error("[admin] deleteProduct:", error)
    redirect(`/admin/products/${before.id}?hata=silinemedi`)
  }

  await logAdminAction(supabase, {
    action: "product.delete",
    entityType: "product",
    entityId: before.id,
    before: { name: before.name, slug: before.slug },
    after: null,
    metadata: { order_references: references },
  })

  revalidateStorefront(before.slug)
  redirect("/admin/products?silindi=1")
}
