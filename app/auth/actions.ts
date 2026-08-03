"use server"

import { headers } from "next/headers"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { ActionState } from "@/lib/admin/errors"
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit"

/**
 * SEC-05: Customer authentication server actions.
 *
 * Password-based login, registration, and password-reset initiation are moved
 * behind trusted server actions so the distributed rate limiter cannot be
 * bypassed by calling Supabase Auth directly from the browser. The client
 * forms call these actions instead of using the Supabase browser client
 * directly for password flows.
 *
 * OAuth flows remain on the browser client (signInWithOAuth) because they
 * redirect through the provider and do not accept a password.
 *
 * All responses are generic: no account enumeration.
 */

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin.").max(254),
  password: z.string().min(1).max(200),
  next: z.string().trim().max(200).optional(),
})

const registerSchema = z.object({
  name: z.string().trim().min(2, "Ad soyad girin.").max(120),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin.").max(254),
  phone: z.string().trim().max(20),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı.").max(200),
})

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin.").max(254),
  redirect_to: z.string().trim().max(200).optional(),
})

/**
 * Returns the same result shape for every failure mode, so the client cannot
 * distinguish "wrong password" from "rate limited" from "no such account".
 */
const GENERIC_AUTH_ERROR = "Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin."

export async function customerLoginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { needsEmailConfirm?: boolean; redirectTo?: string }> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  })

  if (!parsed.success) {
    return { ok: false, message: GENERIC_AUTH_ERROR }
  }

  const { email, password, next } = parsed.data

  // SEC-05: Rate-limit before calling Supabase Auth.
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await checkRateLimit("customer_login", ip, email)
  if (!rl.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { ok: false, message: GENERIC_AUTH_ERROR }
  }

  if (!data.session) {
    return { ok: false, needsEmailConfirm: true, message: "Devam etmek için e-postanızı onaylayın." }
  }

  // Only same-origin paths are acceptable return targets.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/hesabim"
  return { ok: true, redirectTo: safeNext }
}

export async function customerRegisterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { needsEmailConfirm?: boolean }> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz bilgiler." }
  }

  const { name, email, phone, password } = parsed.data

  // SEC-05: Rate-limit registration.
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await checkRateLimit("registration", ip, email)
  if (!rl.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, phone } },
  })

  if (error) {
    return { ok: false, message: GENERIC_AUTH_ERROR }
  }

  if (!data.session) {
    return { ok: true, needsEmailConfirm: true, message: "Hesabınızı oluşturduk. Devam etmek için e-postanızı onaylayın." }
  }

  return { ok: true, message: "Hesap oluşturuldu." }
}

export async function customerResetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    email: formData.get("email"),
    redirect_to: formData.get("redirect_to") ?? undefined,
  })

  if (!parsed.success) {
    // Return the same generic success message for invalid emails too, so
    // the form cannot be used to enumerate accounts.
    return { ok: true, message: "Şifre sıfırlama bağlantısını e-postanıza gönderdik (eğer hesap bulunduysa)." }
  }

  const { email, redirect_to } = parsed.data

  // SEC-05: Rate-limit password reset requests.
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await checkRateLimit("password_reset", ip, email)
  if (!rl.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE }
  }

  const supabase = await createSupabaseServerClient()
  const safeRedirect = redirect_to && redirect_to.startsWith("/") && !redirect_to.startsWith("//")
    ? redirect_to
    : "/hesabim/profil"

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${safeRedirect}`,
  })

  // Always return the same message regardless of whether the email exists.
  return { ok: true, message: "Şifre sıfırlama bağlantısını e-postanıza gönderdik (eğer hesap bulunduysa)." }
}