"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { GENERIC_LOGIN_ERROR, resolveAdminIdentifier } from "@/lib/admin/login"
import { isAdminRole } from "@/lib/admin/roles"
import type { ActionState } from "@/lib/admin/errors"
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit"

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Kullanıcı adı gerekli.").max(254),
  password: z.string().min(1, "Şifre gerekli.").max(200),
  next: z.string().trim().max(200).optional(),
})

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

  if (!email) {
    return { ok: false, message: GENERIC_LOGIN_ERROR }
  }

  // SEC-05: Rate-limit the admin login path. The limiter runs BEFORE the
  // Supabase auth call so even a flood of invalid attempts cannot reach Auth.
  // The identifier is hashed before storage; raw email/IP is never persisted.
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await checkRateLimit("admin_login", ip, email)
  if (!rl.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE }
  }

  const supabase = await createSupabaseServerClient()

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
    await supabase.auth.signOut()
    return { ok: false, message: GENERIC_LOGIN_ERROR }
  }

  if (roleRow.must_change_password === true) {
    redirect("/admin/sifre-degistir")
  }

  const target = next && /^\/admin(?:\/[\w\-/[\]]*)?$/.test(next) ? next : "/admin"
  redirect(target)
}

export async function adminSignOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/admin/login")
}
