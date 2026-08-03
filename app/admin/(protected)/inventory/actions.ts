"use server"

import { revalidatePath } from "next/cache"
import { adminContext } from "@/lib/admin/auth"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import { fieldErrorsFrom, stockAdjustmentSchema } from "@/lib/admin/schemas"

/**
 * Stock movement.
 *
 * The whole operation lives in `admin_adjust_stock()`: it re-checks the
 * caller's role, locks the variant, re-reads the authoritative current
 * quantity, refuses to go negative, records the history row and writes the
 * audit entry — all inside one transaction. This action's only jobs are to
 * validate the submitted shape and to translate a database error into
 * something an operator can act on.
 *
 * In particular, the previous quantity is never taken from the form. Two
 * administrators adjusting the same variant at once cannot overwrite each
 * other, because neither one's idea of "current stock" is used.
 */
export async function adjustStockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { supabase } = await adminContext("manageInventory")

    const parsed = stockAdjustmentSchema.safeParse({
      variant_id: formData.get("variant_id"),
      direction: formData.get("direction"),
      quantity: formData.get("quantity"),
      reason: formData.get("reason"),
      note: formData.get("note") ?? null,
    })

    if (!parsed.success) {
      return {
        ok: false,
        fieldErrors: fieldErrorsFrom(parsed.error),
        message: "Lütfen işaretli alanları düzeltin.",
      }
    }

    const { data, error } = await supabase.rpc("admin_adjust_stock", {
      p_variant_id: parsed.data.variant_id,
      p_change: parsed.data.change,
      p_reason: parsed.data.reason,
      p_note: parsed.data.note,
    })

    if (error) return toActionState(error, "adjustStock")

    const result = (data ?? {}) as { previous_quantity?: number; new_quantity?: number }

    revalidatePath("/admin/inventory")
    revalidatePath("/admin/products")
    revalidatePath("/admin")
    revalidatePath("/shop")
    revalidatePath("/magaza")

    return {
      ok: true,
      message: `Stok güncellendi: ${result.previous_quantity ?? "?"} → ${result.new_quantity ?? "?"}`,
    }
  } catch (error) {
    return toActionState(error, "adjustStock")
  }
}
