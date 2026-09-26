import type { EmailOtpType } from "@supabase/supabase-js"
import { isValidCode } from "@/lib/auth/code"

const destinations = {
  email: "/eposta-onaylandi",
  recovery: "/sifre-yenile",
  email_change: "/eposta-degisikligi-onaylandi",
} as const

type CustomerOtpType = keyof typeof destinations

/** Only the exact destination assigned to this email flow may be followed. */
export function destinationFor(type: string | null, next: string | null): string | null {
  if (!type || !(type in destinations) || !next) return null
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null
  return destinations[type as CustomerOtpType] === next ? next : null
}

export function invalidLinkPath(type: string | null): string {
  const flow = type === "email" ? "signup" : type === "recovery" ? "recovery" : "change"
  return `/baglanti-gecersiz?flow=${flow}`
}

export function parseConfirmation(url: URL): { token_hash: string; type: CustomerOtpType; next: string } | null {
  const params = url.searchParams
  if (["token_hash", "type", "next"].some((key) => params.getAll(key).length !== 1)) return null
  const token_hash = params.get("token_hash")
  const type = params.get("type")
  const next = destinationFor(type, params.get("next"))
  if (!token_hash || token_hash.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token_hash) || !type || !next) return null
  return { token_hash, type: type as CustomerOtpType, next }
}

type VerificationClient = {
  auth: { verifyOtp: (params: { token_hash: string; type: EmailOtpType }) => Promise<{ error: unknown }> }
}

/** Called by the route handler, with the Supabase client injected for branch tests. */
export async function confirmLink(url: URL, client: VerificationClient): Promise<string> {
  const parsed = parseConfirmation(url)
  if (!parsed) return invalidLinkPath(url.searchParams.get("type"))
  const { error } = await client.auth.verifyOtp({ token_hash: parsed.token_hash, type: parsed.type })
  if (error) return invalidLinkPath(parsed.type)
  // WELCOME EMAIL HOOK: send only when parsed.type === "email"; not enabled yet.
  return parsed.next
}

/** Signup email code is exactly CODE_LENGTH digits; never normalize the code itself. */
export function validateSignupCode(emailValue: string, token: string): { email: string; token: string } | null {
  const email = emailValue.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isValidCode(token)) return null
  return { email, token }
}
