"use server"

import { randomInt } from "crypto"
import { headers } from "next/headers"
import { adminContext, requireSuperAdmin } from "@/lib/admin/auth"
import { AUDIT_WARNING, logAdminAction } from "@/lib/admin/audit"
import { toActionState, type ActionState } from "@/lib/admin/errors"
import {
  adminSetCustomerPasswordSchema,
  customerIdParamSchema,
  fieldErrorsFrom,
} from "@/lib/admin/schemas"
import { loadAuthSummary } from "@/lib/admin/queries/customers"
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit"
import { createSupabaseAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { adminPasswordResetEmail } from "@/lib/email"
import { siteUrl } from "@/lib/site"
import { sendEmail } from "@/lib/email/send"

/**
 * Feature 3 — müşteri parola işlemleri (yönetici müşteri detayı).
 *
 * a) "Şifre yenileme bağlantısı gönder": standart Supabase recovery e-postası,
 *    mevcut sıfırlama akışıyla aynı redirect hedefiyle. manageCustomers yetkili
 *    her yönetici kullanabilir. Denetlenir. Arayüzde önce onay istenir.
 *
 * b) "Şifre belirle": YALNIZCA süper yönetici (sunucuda zorlanır). Gerekçe
 *    zorunlu ve denetim kaydına yazılır. Parola sunucuda üretilir ve yanıtta
 *    bir kez gösterilir, ya da elle girilir (müşteri parolalarıyla aynı kural:
 *    en az 8). Müşterinin diğer oturumları kapatılır, must_change_password
 *    bayrağı kurulur, müşteriye Resend ile bildirim gider. Parola hiçbir yere
 *    loglanmaz — hata nesnelerine ve denetim kaydına asla konmaz.
 */

export type RecoverySendState = ActionState

export async function sendCustomerRecoveryAction(
  _prev: RecoverySendState,
  formData: FormData,
): Promise<RecoverySendState> {
  try {
    const { session, supabase } = await adminContext("manageCustomers")

    const parsed = customerIdParamSchema.safeParse({ customer_id: formData.get("customer_id") })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Geçersiz istek." }
    }

    const h = await headers()
    const rl = await checkRateLimit("password_reset", getClientIp(h), session.userId)
    if (!rl.allowed) return { ok: false, message: RATE_LIMIT_MESSAGE }

    const auth = await loadAuthSummary(parsed.data.customer_id)
    if (!auth?.email) {
      return {
        ok: false,
        message: "Müşteri e-postası okunamadı. Servis anahtarı yapılandırmasını kontrol edin.",
      }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(auth.email, {
      redirectTo: new URL(
        "/auth/confirm?type=recovery&next=/sifre-yenile",
        siteUrl,
      ).toString(),
    })
    if (error) return toActionState(error, "sendCustomerRecovery")

    const audited = await logAdminAction(supabase, {
      action: "customer.recovery_sent",
      entityType: "customer",
      entityId: parsed.data.customer_id,
    })

    return {
      ok: true,
      message: "Şifre yenileme bağlantısı gönderildi.",
      warning: audited ? undefined : AUDIT_WARNING,
    }
  } catch (error) {
    return toActionState(error, "sendCustomerRecovery")
  }
}

// ---------------------------------------------------------------------------
// b) Şifre belirle (süper yönetici)
// ---------------------------------------------------------------------------

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

function generatePassword(length = 16): string {
  let out = ""
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]
  return out
}

export interface SetPasswordState extends ActionState {
  /** Sunucuda üretilen parola — yanıtta BİR KEZ gösterilir, saklanmaz. */
  generatedPassword?: string
  emailWarning?: string
}

export async function setCustomerPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  try {
    const session = await requireSuperAdmin()
    const { createSupabaseServerClient } = await import("@/lib/supabase/server")
    const supabase = await createSupabaseServerClient()

    const parsed = adminSetCustomerPasswordSchema.safeParse({
      customer_id: formData.get("customer_id"),
      reason: formData.get("reason"),
      mode: formData.get("mode"),
      password: formData.get("password") ?? null,
      confirm: formData.get("confirm") ?? null,
    })
    if (!parsed.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error), message: "Geçersiz istek." }
    }

    const h = await headers()
    const rl = await checkRateLimit("password_reset", getClientIp(h), session.userId)
    if (!rl.allowed) return { ok: false, message: RATE_LIMIT_MESSAGE }

    if (!hasServiceRoleKey()) {
      return {
        ok: false,
        message: "Servis anahtarı yapılandırılmamış. Parola işlemi için SUPABASE_SERVICE_ROLE_KEY gerekli.",
      }
    }

    // Parola bellek dışında hiçbir yere yazılmaz: log ve denetime konmaz.
    const newPassword = parsed.data.mode === "generate" ? generatePassword() : (parsed.data.password as string)

    const admin = createSupabaseAdminClient()
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(parsed.data.customer_id)
    if (targetError || !target.user) {
      return { ok: false, message: "Müşteri bulunamadı." }
    }
    if (!target.user.email) {
      return { ok: false, message: "Müşterinin e-posta adresi yok; bildirim gönderilemez." }
    }

    // Önce bayrak (güvenli yön): parola adımı düşerse bile müşteri ilk
    // girişte değiştirmeye zorlanır.
    const { error: flagError } = await supabase.rpc("admin_set_customer_must_change", {
      p_customer_id: parsed.data.customer_id,
      p_value: true,
    })
    if (flagError) return toActionState(flagError, "setCustomerPassword:flag")

    const { error: passwordError } = await admin.auth.admin.updateUserById(parsed.data.customer_id, {
      password: newPassword,
    })
    if (passwordError) return toActionState(passwordError, "setCustomerPassword:password")

    // Diğer oturumları gerçekten kapat: Auth Admin API yalnızca bir JWT ile
    // global kapatmaya izin verir; müşteri kimliği tek başına yetmez. Yeni
    // parolayla yalıtılmış (cookie'siz) bir oturum açıp o oturumdan global
    // çıkış yapılır — bu, kullanıcının TÜM oturumlarını geçersiz kılar.
    // Yöneticinin kendi oturumu bu istemcide değildir, etkilenmez.
    let revoked = false
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (url && anon) {
        const { createClient } = await import("@supabase/supabase-js")
        const probe = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })
        const { data: probeSession, error: probeError } = await probe.auth.signInWithPassword({
          email: target.user.email,
          password: newPassword,
        })
        if (!probeError && probeSession.session) {
          const { error: globalError } = await probe.auth.signOut({ scope: "global" })
          revoked = !globalError
        }
      }
    } catch {
      revoked = false
    }

    const audited = await logAdminAction(supabase, {
      action: "customer.password_set",
      entityType: "customer",
      entityId: parsed.data.customer_id,
      metadata: { reason: parsed.data.reason, mode: parsed.data.mode },
    })

    // Müşteriye bildirim (parola bu e-postada YOK).
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", parsed.data.customer_id)
      .maybeSingle()
    const mail = adminPasswordResetEmail({
      name: (profile as { full_name?: string } | null)?.full_name ?? undefined,
    })
    const sent = await sendEmail({ to: target.user.email, subject: mail.subject, html: mail.html, text: mail.text })

    const warnings = [
      audited ? null : AUDIT_WARNING,
      revoked
        ? null
        : "Şifre değişti ancak açık oturumlar kapatılamadı; müşteri ilk girişte yine de yeni şifre belirlemek zorunda.",
      sent.ok ? null : sent.message,
    ].filter(Boolean) as string[]

    return {
      ok: true,
      message:
        parsed.data.mode === "generate"
          ? "Şifre belirlendi. Aşağıdaki parolayı müşteriye iletin — bir daha gösterilmeyecek."
          : "Şifre belirlendi. Müşteri ilk girişinde değiştirmeye zorlanacak.",
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      generatedPassword: parsed.data.mode === "generate" ? newPassword : undefined,
    }
  } catch (error) {
    return toActionState(error, "setCustomerPassword")
  }
}
