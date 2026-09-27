import { z } from "zod"
import type { ActionState } from "@/lib/admin/errors"
import { newPasswordField } from "@/lib/auth/password-policy"
import { RATE_LIMIT_MESSAGE } from "@/lib/auth/rate-limit-message"

/**
 * Signed-in account actions, written against injected dependencies so every
 * branch runs in the database-free suite. app/hesabim/actions.ts wires the real
 * Supabase clients and the rate limiter; nothing here imports them.
 *
 * Order in every handler: session → validation → rate limit → proof
 * (current password) → effect. Validation runs before the limiter so a typo
 * does not spend an attempt; the limiter runs before the password check so
 * guessing stays throttled.
 */

export interface SessionUser {
  id: string
  email: string
  /** True when the account has an e-mail/password identity. */
  hasPassword: boolean
  /**
   * True when an administrator set this customer's password and the customer
   * has not changed it yet (profiles.must_change_password). Only the password
   * change itself is allowed until it is cleared.
   */
  mustChangePassword?: boolean
}

export type Bucket = "account_reauth" | "account_update"

export interface BaseDeps {
  getUser(): Promise<SessionUser | null>
  /** False when the caller is over the limit for this bucket. */
  allow(bucket: Bucket, key: string): Promise<boolean>
}

export interface ReauthDeps extends BaseDeps {
  verifyPassword(email: string, password: string): Promise<boolean>
}

export type AccountResult = ActionState & { redirectTo?: string }

export const MESSAGES = {
  signedOut: "Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.",
  wrongPassword: "Mevcut şifre doğrulanamadı.",
  generic: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
  noPassword:
    "Hesabınızda henüz şifre yok. Önce “Şifremi unuttum” ile e-postanıza gelen bağlantıdan bir şifre belirleyin.",
  rateLimited: RATE_LIMIT_MESSAGE,
  mustChangePassword:
    "Önce şifrenizi yenileyin. Yöneticiniz şifrenizi güncelledi; devam etmek için yeni bir şifre belirleyin.",
} as const

const currentPasswordField = z.string().min(1, "Mevcut şifrenizi girin.").max(200)

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    if (!out[key]) out[key] = issue.message
  }
  return out
}

function invalid(error: z.ZodError): AccountResult {
  return { ok: false, message: "Lütfen işaretli alanları düzeltin.", fieldErrors: fieldErrorsOf(error) }
}

/** Shared gate for the password-proved actions. */
async function reauthenticate(
  deps: ReauthDeps,
  user: SessionUser,
  currentPassword: string,
): Promise<AccountResult | null> {
  if (!user.hasPassword) return { ok: false, message: MESSAGES.noPassword }
  if (!(await deps.allow("account_reauth", user.id))) return { ok: false, message: MESSAGES.rateLimited }
  if (!(await deps.verifyPassword(user.email, currentPassword))) {
    return { ok: false, message: MESSAGES.wrongPassword, fieldErrors: { currentPassword: MESSAGES.wrongPassword } }
  }
  return null
}

/**
 * Forced-rotation guard (customer counterpart of the admin must_change_password
 * gate): while the flag stands, only the password change itself may run.
 * Checked in every mutating handler below — server-side, never only in pages.
 */
function passwordChangeOwed(user: SessionUser): AccountResult | null {
  if (user.mustChangePassword) return { ok: false, message: MESSAGES.mustChangePassword }
  return null
}

// ---------------------------------------------------------------------------
// Password change
// ---------------------------------------------------------------------------

export const changePasswordSchema = z
  .object({ currentPassword: currentPasswordField, newPassword: newPasswordField })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ["newPassword"],
    message: "Yeni şifre mevcut şifreden farklı olmalı.",
  })

export type PasswordUpdateOutcome = "ok" | "invalid_current" | "weak" | "same" | "error"

export interface ChangePasswordDeps extends BaseDeps {
  /** Proves `current` in an isolated session and sets `next` from it. */
  updatePassword(email: string, current: string, next: string): Promise<PasswordUpdateOutcome>
  /**
   * Clears profiles.must_change_password after a successful change
   * (customer_complete_password_change). Best-effort: a failure leaves the
   * flag standing, which is the safe direction.
   */
  clearPasswordFlag?: () => Promise<boolean>
}

export async function changePassword(input: unknown, deps: ChangePasswordDeps): Promise<AccountResult> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  if (!user.hasPassword) return { ok: false, message: MESSAGES.noPassword }
  if (!(await deps.allow("account_reauth", user.id))) return { ok: false, message: MESSAGES.rateLimited }
  const outcome = await deps.updatePassword(user.email, parsed.data.currentPassword, parsed.data.newPassword)
  switch (outcome) {
    case "ok":
      if (deps.clearPasswordFlag) await deps.clearPasswordFlag()
      return { ok: true, message: "Şifreniz güncellendi." }
    case "invalid_current":
      return { ok: false, message: MESSAGES.wrongPassword, fieldErrors: { currentPassword: MESSAGES.wrongPassword } }
    case "weak":
      return {
        ok: false,
        message: "Bu şifre kabul edilmedi. Daha uzun ya da daha az bilinen bir şifre seçin.",
        fieldErrors: { newPassword: "Bu şifre kabul edilmedi. Daha uzun ya da daha az bilinen bir şifre seçin." },
      }
    case "same":
      return {
        ok: false,
        message: "Yeni şifre mevcut şifreden farklı olmalı.",
        fieldErrors: { newPassword: "Yeni şifre mevcut şifreden farklı olmalı." },
      }
    default:
      return { ok: false, message: MESSAGES.generic }
  }
}

// ---------------------------------------------------------------------------
// E-mail change
// ---------------------------------------------------------------------------

export const changeEmailSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin.").max(254),
  currentPassword: currentPasswordField,
})

export interface ChangeEmailDeps extends ReauthDeps {
  /** Starts Supabase's confirmed e-mail change on the caller's session. */
  requestEmailChange(newEmail: string): Promise<"ok" | "exists" | "error">
}

/** Same words whether or not the address is taken: no account enumeration. */
export const EMAIL_CHANGE_SENT =
  "Bu adres kullanılabiliyorsa onay bağlantısını gönderdik. Değişiklik, e-postadaki bağlantıyı açtığınızda tamamlanır."

export async function changeEmail(input: unknown, deps: ChangeEmailDeps): Promise<AccountResult> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const owed = passwordChangeOwed(user)
  if (owed) return owed
  const parsed = changeEmailSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  if (parsed.data.newEmail === user.email.toLowerCase()) {
    return { ok: false, message: "Bu zaten hesabınızdaki adres.", fieldErrors: { newEmail: "Bu zaten hesabınızdaki adres." } }
  }
  const denied = await reauthenticate(deps, user, parsed.data.currentPassword)
  if (denied) return denied
  const outcome = await deps.requestEmailChange(parsed.data.newEmail)
  if (outcome === "error") return { ok: false, message: MESSAGES.generic }
  return { ok: true, message: EMAIL_CHANGE_SENT }
}

// ---------------------------------------------------------------------------
// Sign out of every device
// ---------------------------------------------------------------------------

export const passwordOnlySchema = z.object({ currentPassword: currentPasswordField })

export interface SignOutEverywhereDeps extends ReauthDeps {
  signOutGlobal(): Promise<boolean>
}

export const SIGNED_OUT_EVERYWHERE_PATH = "/giris?cikis=tum"

export async function signOutEverywhere(input: unknown, deps: SignOutEverywhereDeps): Promise<AccountResult> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const owed = passwordChangeOwed(user)
  if (owed) return owed
  const parsed = passwordOnlySchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const denied = await reauthenticate(deps, user, parsed.data.currentPassword)
  if (denied) return denied
  if (!(await deps.signOutGlobal())) return { ok: false, message: MESSAGES.generic }
  return { ok: true, redirectTo: SIGNED_OUT_EVERYWHERE_PATH }
}

// ---------------------------------------------------------------------------
// Personal data export
// ---------------------------------------------------------------------------

export interface ExportDeps extends ReauthDeps {
  /** Everything the export contains, already scoped to this user. */
  collect(user: SessionUser): Promise<unknown | null>
}

export type ExportResult = AccountResult & { filename?: string; data?: string }

export function exportFilename(now: Date): string {
  return `kabia-verilerim-${now.toISOString().slice(0, 10)}.json`
}

export async function exportData(input: unknown, deps: ExportDeps, now = new Date()): Promise<ExportResult> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const owed = passwordChangeOwed(user)
  if (owed) return owed
  const parsed = passwordOnlySchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const denied = await reauthenticate(deps, user, parsed.data.currentPassword)
  if (denied) return denied
  const document = await deps.collect(user)
  if (!document) return { ok: false, message: "Verileriniz şu anda hazırlanamadı. Lütfen tekrar deneyin." }
  return {
    ok: true,
    message: "Verileriniz indirildi.",
    filename: exportFilename(now),
    data: JSON.stringify(document, null, 2),
  }
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export const deleteAccountSchema = z.object({
  currentPassword: currentPasswordField,
  confirm: z.literal("on", { message: "Devam etmek için bu kutuyu işaretleyin." }),
})

export interface DeleteAccountDeps extends ReauthDeps {
  /** Any row in user_roles, active or not: such accounts are not deleted here. */
  hasStaffRole(userId: string): Promise<boolean>
  /** Account-only data outside the profile cascade (reviews). */
  removeAccountContent(userId: string): Promise<boolean>
  /** Deletes the Auth user; profiles and their children cascade, orders detach. */
  deleteAuthUser(userId: string): Promise<boolean>
}

export const ACCOUNT_DELETED_PATH = "/hesap-silindi"

export async function deleteAccount(input: unknown, deps: DeleteAccountDeps): Promise<AccountResult> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const owed = passwordChangeOwed(user)
  if (owed) return owed
  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  const denied = await reauthenticate(deps, user, parsed.data.currentPassword)
  if (denied) return denied
  if (await deps.hasStaffRole(user.id)) {
    return { ok: false, message: "Bu hesap yönetim paneline bağlı. Silme işlemi için yöneticinizle iletişime geçin." }
  }
  if (!(await deps.removeAccountContent(user.id))) return { ok: false, message: MESSAGES.generic }
  if (!(await deps.deleteAuthUser(user.id))) return { ok: false, message: MESSAGES.generic }
  return { ok: true, redirectTo: ACCOUNT_DELETED_PATH }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const PHONE_RE = /^[\d\s+()]{10,20}$/

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Ad soyad girin.").max(120, "Ad soyad en fazla 120 karakter olabilir."),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || PHONE_RE.test(v), "Geçerli bir telefon numarası girin."),
  birthDate: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Geçerli bir tarih girin.")
    .refine((v) => v === "" || (v >= "1900-01-01" && Date.parse(v) <= Date.now()), "Geçerli bir tarih girin."),
})

export interface ProfilePatch {
  full_name: string
  phone: string | null
  birth_date: string | null
}

export interface ProfileDeps extends BaseDeps {
  saveProfile(userId: string, patch: ProfilePatch): Promise<boolean>
}

export async function updateProfile(input: unknown, deps: ProfileDeps): Promise<AccountResult & { profile?: ProfilePatch }> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const owed = passwordChangeOwed(user)
  if (owed) return owed
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)
  if (!(await deps.allow("account_update", user.id))) return { ok: false, message: MESSAGES.rateLimited }
  const patch: ProfilePatch = {
    full_name: parsed.data.name,
    phone: parsed.data.phone || null,
    birth_date: parsed.data.birthDate || null,
  }
  if (!(await deps.saveProfile(user.id, patch))) return { ok: false, message: "Bilgileriniz kaydedilemedi. Lütfen tekrar deneyin." }
  return { ok: true, message: "Bilgileriniz kaydedildi.", profile: patch }
}

// ---------------------------------------------------------------------------
// Campaign e-mail consent
// ---------------------------------------------------------------------------

export const marketingSchema = z.object({ granted: z.enum(["true", "false"]) })

export interface MarketingDeps extends BaseDeps {
  /** public.set_marketing_email_consent — updates the preference and logs consent. */
  setMarketingConsent(granted: boolean): Promise<boolean>
}

export async function setMarketingConsent(input: unknown, deps: MarketingDeps): Promise<AccountResult & { granted?: boolean }> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const owed = passwordChangeOwed(user)
  if (owed) return owed
  const parsed = marketingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: MESSAGES.generic }
  if (!(await deps.allow("account_update", user.id))) return { ok: false, message: MESSAGES.rateLimited }
  const granted = parsed.data.granted === "true"
  if (!(await deps.setMarketingConsent(granted))) return { ok: false, message: "Tercihiniz kaydedilemedi. Lütfen tekrar deneyin." }
  return { ok: true, message: granted ? "Kampanya e-postalarına izin verdiniz." : "Kampanya e-postaları kapatıldı.", granted }
}

// ---------------------------------------------------------------------------
// Order-status e-mail preference (kargo + teslimat bildirimleri)
// ---------------------------------------------------------------------------

export const orderStatusSchema = z.object({ granted: z.enum(["true", "false"]) })

export interface OrderStatusDeps extends BaseDeps {
  /** notification_preferences.order_status upsert for the signed-in user. */
  setOrderStatus(granted: boolean): Promise<boolean>
}

/**
 * Kargo/teslimat e-postaları tercihi (opt-out, default açık). Sipariş
 * alındı ve iptal e-postaları transactional'dır, bu anahtardan bağımsız
 * her zaman gider. Kayıt yazılamazsa hata döner; arayan, anahtarı yalnızca
 * başarıda çevirir (iyimser çevirme yok).
 */
export async function setOrderStatus(input: unknown, deps: OrderStatusDeps): Promise<AccountResult & { granted?: boolean }> {
  const user = await deps.getUser()
  if (!user) return { ok: false, message: MESSAGES.signedOut }
  const owed = passwordChangeOwed(user)
  if (owed) return owed
  const parsed = orderStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: MESSAGES.generic }
  if (!(await deps.allow("account_update", user.id))) return { ok: false, message: MESSAGES.rateLimited }
  const granted = parsed.data.granted === "true"
  if (!(await deps.setOrderStatus(granted))) return { ok: false, message: "Tercihiniz kaydedilemedi. Lütfen tekrar deneyin." }
  return { ok: true, message: granted ? "Kargo ve teslimat bildirimleri açıldı." : "Kargo ve teslimat bildirimleri kapatıldı.", granted }
}

/** FormData → plain object for the schemas above (only string values). */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value
  }
  return out
}
