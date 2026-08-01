"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { adminContext } from "@/lib/admin/auth"
import { logAdminAction } from "@/lib/admin/audit"
import { toActionState } from "@/lib/admin/errors"
import { uuid } from "@/lib/admin/schemas"

const featureSchema = z.object({
  product_id: uuid,
  featured: z.union([z.literal("true"), z.literal("false")]).transform((v) => v === "true"),
})

/**
 * Toggles a product's place in the homepage selection.
 *
 * This is the whole of "homepage featured products" — a flag on a real product,
 * not a page builder. The premium homepage's layout, copy and imagery stay in
 * code where they belong; only the *selection* is operational data.
 */
export async function toggleFeaturedAction(formData: FormData): Promise<void> {
  try {
    const { supabase } = await adminContext("manageContent")

    const parsed = featureSchema.safeParse({
      product_id: formData.get("product_id"),
      featured: formData.get("featured"),
    })
    if (!parsed.success) return

    // Re-read authoritative state; the form's idea of "currently featured" is
    // only used to decide which button was rendered.
    const { data: before } = await supabase
      .from("products")
      .select("id, name, is_featured, is_active")
      .eq("id", parsed.data.product_id)
      .maybeSingle()

    if (!before) return

    if (parsed.data.featured && !before.is_active) {
      // An archived product must never appear in the homepage selection.
      return
    }

    const { error } = await supabase
      .from("products")
      .update({ is_featured: parsed.data.featured })
      .eq("id", parsed.data.product_id)

    if (error) {
      console.error("[admin] toggleFeatured:", error)
      return
    }

    await logAdminAction(supabase, {
      action: "content.update",
      entityType: "product",
      entityId: before.id,
      before: { is_featured: before.is_featured },
      after: { is_featured: parsed.data.featured },
      metadata: { name: before.name, area: "homepage_featured" },
    })

    revalidatePath("/")
    revalidatePath("/shop")
    revalidatePath("/admin/content")
  } catch (error) {
    // Void-returning form action: surface through logs, never through a thrown
    // error that would blank the page.
    toActionState(error, "toggleFeatured")
  }
}
