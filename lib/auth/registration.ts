import { z } from "zod"
import { newPasswordField } from "@/lib/auth/password-policy"
import { registrationConsents } from "@/lib/auth/consent"

/**
 * Registration input, validated on the server. The two legal consents are
 * required here — not only in the browser — and the optional marketing choice
 * is carried into Supabase user metadata, where handle_new_user() records all
 * three in public.customer_consents and seeds campaign_emails from it.
 */

const PHONE_RE = /^[\d\s+()]{10,20}$/

export const TERMS_REQUIRED = "Üyelik sözleşmesini ve KVKK aydınlatma metnini onaylamanız gerekiyor."

export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Ad soyad girin.").max(120, "Ad soyad en fazla 120 karakter olabilir."),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin.").max(254),
  phone: z.string().trim().max(20).regex(PHONE_RE, "Geçerli bir telefon numarası girin."),
  password: newPasswordField,
  terms: z.literal("on", { message: TERMS_REQUIRED }),
  kvkk: z.literal("on", { message: TERMS_REQUIRED }),
  marketing: z.enum(["on"]).optional(),
})

export type RegistrationFieldErrors = Partial<Record<"name" | "email" | "phone" | "password" | "consents", string>>

export type ParsedRegistration =
  | { ok: true; email: string; password: string; metadata: { full_name: string; phone: string; consents: ReturnType<typeof registrationConsents> } }
  | { ok: false; fieldErrors: RegistrationFieldErrors }

export function parseRegistration(values: Record<string, string | undefined>): ParsedRegistration {
  const parsed = registrationSchema.safeParse({
    name: values.name ?? "",
    email: values.email ?? "",
    phone: values.phone ?? "",
    password: values.password ?? "",
    terms: values.terms,
    kvkk: values.kvkk,
    marketing: values.marketing || undefined,
  })
  if (!parsed.success) {
    const fieldErrors: RegistrationFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0])
      const field = key === "terms" || key === "kvkk" || key === "marketing" ? "consents" : (key as keyof RegistrationFieldErrors)
      if (!fieldErrors[field]) fieldErrors[field] = issue.message
    }
    return { ok: false, fieldErrors }
  }
  const { name, email, phone, password, marketing } = parsed.data
  return {
    ok: true,
    email,
    password,
    metadata: { full_name: name, phone, consents: registrationConsents(marketing === "on") },
  }
}
