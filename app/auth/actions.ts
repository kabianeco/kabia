"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { ActionState } from "@/lib/admin/errors"
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit"
import { validateSignupCode } from "@/lib/auth/customer-confirm"
import { RECOVERY_COOKIE, verifyRecoveryGrant } from "@/lib/auth/recovery-grant"
import { newPasswordField } from "@/lib/auth/password-policy"
import { parseRegistration, type RegistrationFieldErrors } from "@/lib/auth/registration"

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

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin.").max(254),
})

// One field with show/hide replaces the old "repeat" field; the rule is the
// shared 8-character policy (lib/auth/password-policy.ts).
const newPasswordSchema = z.object({ password: newPasswordField })

const GENERIC_SENT_MESSAGE = "Bu adres için bir hesap varsa e-posta gönderdik. Gelen kutunuzu kontrol edin."
const GENERIC_CODE_ERROR = "Kod doğrulanamadı. Bilgileri kontrol edip tekrar deneyin."

/**
 * Returns the same result shape for every failure mode, so the client cannot
 * distinguish "wrong password" from "rate limited" from "no such account".
 */
const GENERIC_AUTH_ERROR = "Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin."
const GENERIC_REGISTER_ERROR = "Kayıt tamamlanamadı. Bilgilerinizi kontrol edip tekrar deneyin."

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

  if (error?.code === "email_not_confirmed") {
    return { ok: false, needsEmailConfirm: true, message: "Devam etmek için e-postanızı doğrulayın." }
  }
  if (error || !data.user) {
    return { ok: false, message: GENERIC_AUTH_ERROR }
  }

  if (!data.session) {
    return { ok: false, needsEmailConfirm: true, message: "Devam etmek için e-postanızı doğrulayın." }
  }

  // Only same-origin paths are acceptable return targets.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/hesabim"
  return { ok: true, redirectTo: safeNext }
}

export async function customerRegisterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { needsEmailConfirm?: boolean; fields?: RegistrationFieldErrors }> {
  const value = (key: string) => {
    const v = formData.get(key)
    return typeof v === "string" ? v : undefined
  }
  // Terms and KVKK are required here on the server, not only in the browser.
  const parsed = parseRegistration({
    name: value("name"),
    email: value("email"),
    phone: value("phone"),
    password: value("password"),
    terms: value("terms"),
    kvkk: value("kvkk"),
    marketing: value("marketing"),
  })

  if (!parsed.ok) {
    return { ok: false, message: "Lütfen işaretli alanları düzeltin.", fields: parsed.fieldErrors }
  }

  // SEC-05: Rate-limit registration.
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await checkRateLimit("registration", ip, parsed.email)
  if (!rl.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE }
  }

  const supabase = await createSupabaseServerClient()
  // handle_new_user() records metadata.consents in public.customer_consents
  // and starts campaign e-mail from the marketing choice.
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
    options: { data: parsed.metadata },
  })

  if (error) {
    return { ok: false, message: GENERIC_REGISTER_ERROR }
  }

  return { ok: true, needsEmailConfirm: !data.session, message: GENERIC_SENT_MESSAGE }
}

export async function customerResetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    email: formData.get("email"),
  })

  if (!parsed.success) {
    // Return the same generic success message for invalid emails too, so
    // the form cannot be used to enumerate accounts.
    return { ok: true, message: GENERIC_SENT_MESSAGE }
  }

  const { email } = parsed.data

  // SEC-05: Rate-limit password reset requests.
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await checkRateLimit("password_reset", ip, email)
  if (!rl.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE }
  }

  const supabase = await createSupabaseServerClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL(
      "/auth/confirm?type=recovery&next=/sifre-yenile",
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://kabia-revised.vercel.app",
    ).toString(),
  })

  // Always return the same message regardless of whether the email exists.
  return { ok: true, message: GENERIC_SENT_MESSAGE }
}

export async function customerResendConfirmationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { ok: true, message: GENERIC_SENT_MESSAGE }
  const h = await headers()
  const rl = await checkRateLimit("confirmation_resend", getClientIp(h), parsed.data.email)
  if (!rl.allowed) return { ok: false, message: RATE_LIMIT_MESSAGE }
  const supabase = await createSupabaseServerClient()
  await supabase.auth.resend({ type: "signup", email: parsed.data.email })
  return { ok: true, message: GENERIC_SENT_MESSAGE }
}

export async function customerVerifyCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState & { redirectTo?: string }> {
  const emailValue = formData.get("email")
  const tokenValue = formData.get("token")
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : ""
  const h = await headers()
  const rl = await checkRateLimit("code_verification", getClientIp(h), email || null)
  if (!rl.allowed) return { ok: false, message: RATE_LIMIT_MESSAGE }
  const validated = validateSignupCode(email, typeof tokenValue === "string" ? tokenValue : "")
  if (!validated) return { ok: false, message: GENERIC_CODE_ERROR }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ ...validated, type: "email" })
  if (error) return { ok: false, message: GENERIC_CODE_ERROR }
  // WELCOME EMAIL HOOK: verified signup code is here; do not send until enabled.
  return { ok: true, redirectTo: "/eposta-onaylandi" }
}

export async function customerUpdatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  if (error || !user || !verifyRecoveryGrant(cookieStore.get(RECOVERY_COOKIE)?.value, user.id)) {
    redirect("/sifremi-unuttum?reason=session")
  }
  const h = await headers()
  const rl = await checkRateLimit("password_reset", getClientIp(h), user.id)
  if (!rl.allowed) return { ok: false, message: RATE_LIMIT_MESSAGE }
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password") })
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Şifre güncellenemedi."
    return { ok: false, message, fieldErrors: { password: message } }
  }
  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (updateError) {
    const message = updateError.code === "same_password"
      ? "Yeni şifre eskisinden farklı olmalı."
      : updateError.code === "weak_password"
        ? "Bu şifre kabul edilmedi. Daha uzun ya da daha az bilinen bir şifre seçin."
        : "Şifre güncellenemedi. Lütfen tekrar deneyin."
    return { ok: false, message, fieldErrors: { password: message } }
  }
  // The grant is single-purpose: spend it once the password is set.
  cookieStore.set(RECOVERY_COOKIE, "", { path: "/sifre-yenile", maxAge: 0 })
  return { ok: true, message: "Şifreniz güncellendi." }
}
