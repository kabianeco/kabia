"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/admin/auth"
import { passwordChangeSchema, fieldErrorsFrom } from "@/lib/admin/schemas"
import { toActionState, type ActionState } from "@/lib/admin/errors"

/**
 * Forced (and voluntary) password rotation for an administrator.
 *
 * The new password is validated against a policy that is *stricter* than
 * Supabase's — 12 characters with mixed case and a digit. Nothing here relaxes
 * the project's Auth settings; the requirement only ever moves upward.
 */
export async function changeAdminPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let shouldRedirect = false

  try {
    await requireAdmin()

    const parsed = passwordChangeSchema.safeParse({
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    })

    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) {
      // Supabase rejects a password that fails the project's own policy (length,
      // complexity, or a known-breached password when that check is enabled).
      return {
        ok: false,
        fieldErrors: {
          password:
            "Bu parola kabul edilmedi. Daha uzun ve benzersiz bir parola deneyin.",
        },
      }
    }

    const { error: flagError } = await supabase.rpc("admin_complete_password_change")
    if (flagError) {
      return {
        ok: true,
        message: "Parolanız güncellendi.",
        warning:
          "Parola değiştirme zorunluluğu kaldırılamadı. Yönetici panelinde tekrar sorulabilir.",
      }
    }

    shouldRedirect = true
  } catch (error) {
    return toActionState(error, "changeAdminPassword")
  }

  // Outside the try: redirect() signals through a thrown control-flow value that
  // must not be caught and turned into an error state.
  if (shouldRedirect) redirect("/admin")
  return { ok: false }
}
