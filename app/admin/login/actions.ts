"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { GENERIC_LOGIN_ERROR, resolveAdminIdentifier } from "@/lib/admin/login"
import { isAdminRole } from "@/lib/admin/roles"
import type { ActionState } from "@/lib/admin/errors"

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Kullanıcı adı gerekli.").max(254),
  password: z.string().min(1, "Şifre gerekli.").max(200),
  next: z.string().trim().max(200).optional(),
})

/**
 * Administrator sign-in.
 *
 * Four things make this safe:
 *
 *  1. The `admin` → `admin@kabia.local` alias is resolved server-side only.
 *  2. Every failure — unknown alias, unknown email, wrong password, correct
 *     password but no administrative role — returns the same message, so the
 *     form cannot be used to discover which accounts exist.
 *  3. A successful password check is not sufficient. The role is read from
 *     `user_roles` immediately afterwards, and a non-administrator is signed
 *     straight back out, so authenticating as a customer cannot produce an
 *     admin session.
 *  4. The redirect target is validated as an internal admin path, so `next`
 *     cannot be used as an open redirect.
 */
export async function adminLoginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  })

  if (!parsed.success) {
    return { ok: false, message: GENERIC_LOGIN_ERROR }
  }

  const { identifier, password, next } = parsed.data
  const email = resolveAdminIdentifier(identifier)
  const supabase = await createSupabaseServerClient()

  if (!email) {
    return { ok: false, message: GENERIC_LOGIN_ERROR }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return { ok: false, message: GENERIC_LOGIN_ERROR }
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role, is_active, must_change_password")
    .eq("user_id", data.user.id)
    .maybeSingle()

  if (!roleRow || roleRow.is_active !== true || !isAdminRole(roleRow.role)) {
    // A valid customer password must not leave a session lying around on an
    // admin origin.
    await supabase.auth.signOut()
    return { ok: false, message: GENERIC_LOGIN_ERROR }
  }

  if (roleRow.must_change_password === true) {
    redirect("/admin/sifre-degistir")
  }

  // Only same-origin admin paths are acceptable return targets.
  const target = next && /^\/admin(?:\/[\w\-/[\]]*)?$/.test(next) ? next : "/admin"
  redirect(target)
}

export async function adminSignOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/admin/login")
}
