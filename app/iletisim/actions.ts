"use server"

import { headers } from "next/headers"
import { z } from "zod"
import { createSupabaseAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit"
import { CONTACT_SUBJECTS } from "@/lib/contact"
import { fieldErrorsFrom } from "@/lib/admin/schemas"
import type { ActionState } from "@/lib/admin/errors"

/**
 * The İletişim form's one write path.
 *
 * The table has no anon policy and the anon role has no grant on it, so this
 * action is not merely the convenient way in — it is the only one. That is
 * what makes this file the place where "an acceptable message" is defined, and
 * why the schema below is duplicated as CHECK constraints in the migration:
 * the schema is the readable error, the constraints are the guarantee.
 *
 * Nothing about the sender is trusted or stored beyond what they typed, plus
 * the KVKK consent record (§5.1: consent boolean + server timestamp).
 * There is no hidden field, no IP, no user agent — an address that turns
 * out to be unreachable is discovered by replying to it, which is the only
 * check that ever meant anything.
 */

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Adınızı yazar mısınız?")
    .max(120, "Ad en fazla 120 karakter olabilir."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(5, "E-posta adresinizi yazar mısınız?")
    .max(254, "E-posta adresi en fazla 254 karakter olabilir.")
    .email("Bu e-posta adresi geçerli görünmüyor."),
  // Empty is a real answer here, so it is normalised to null rather than
  // failing: the field is genuinely optional, not optional-but-nagged.
  phone: z
    .string()
    .trim()
    .max(32, "Telefon en fazla 32 karakter olabilir.")
    .refine((v) => v === "" || v.length >= 7, "Telefon numarası eksik görünüyor.")
    .transform((v) => (v === "" ? null : v)),
  subject: z.enum(
    CONTACT_SUBJECTS.map((s) => s.id) as [string, ...string[]],
    { message: "Bir konu seçer misiniz?" },
  ),
  message: z
    .string()
    .trim()
    .min(10, "Birkaç cümle yazarsanız size daha iyi dönebiliriz.")
    .max(4000, "Mesaj en fazla 4000 karakter olabilir."),
  // S20/§5.1: explicit KVKK consent — unchecked by default in the forms,
  // rejected server-side when missing. Stored with a server timestamp.
  kvkk: z.literal("1", { message: "Devam etmek için KVKK metnini onaylayın." }),
})

export async function sendContactMessage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
    kvkk: formData.get("kvkk") ?? "",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: "Formda eksik ya da hatalı alanlar var.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    }
  }

  // S20: per-IP + per-email bucket. The failure message stays generic — it
  // must not reveal which limiter was hit.
  const h = await headers()
  const rl = await checkRateLimit("contact_notify", getClientIp(h), parsed.data.email)
  if (!rl.allowed) {
    console.error("[iletisim] contact_notify limit aşıldı.")
    return {
      ok: false,
      message:
        "Mesaj gönderilemedi. Bize doğrudan e-posta ya da telefonla ulaşabilirsiniz.",
    }
  }

  // A deployment without the service-role key cannot write this table at all.
  // Saying so plainly beats a generic failure the operator would have to guess
  // at — and the visitor still gets the address and the phone number below it.
  if (!hasServiceRoleKey()) {
    console.error("[iletisim] SUPABASE_SERVICE_ROLE_KEY eksik — mesaj kaydedilemedi.")
    return {
      ok: false,
      message:
        "Mesaj şu anda kaydedilemiyor. Bize doğrudan e-posta ya da telefonla ulaşabilirsiniz.",
    }
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    subject: parsed.data.subject,
    message: parsed.data.message,
    consent_kvkk: true,
    consent_kvkk_at: new Date().toISOString(),
  })

  if (error) {
    console.error("[iletisim] mesaj kaydedilemedi:", error.message)
    return {
      ok: false,
      message:
        "Mesaj gönderilemedi. Bize doğrudan e-posta ya da telefonla ulaşabilirsiniz.",
    }
  }

  return {
    ok: true,
    message: "Mesajınız bize ulaştı. En kısa sürede döneceğiz.",
  }
}
