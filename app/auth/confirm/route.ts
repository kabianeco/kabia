import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit"
import { confirmLink, invalidLinkPath, parseConfirmation } from "@/lib/auth/customer-confirm"
import { issueRecoveryGrant, RECOVERY_COOKIE } from "@/lib/auth/recovery-grant"

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const parsed = parseConfirmation(url)
  let destination = invalidLinkPath(url.searchParams.get("type"))

  if (parsed) {
    const limit = await checkRateLimit("code_verification", getClientIp(request.headers), parsed.token_hash)
    if (limit.allowed) {
      try {
        const supabase = await createSupabaseServerClient()
        destination = await confirmLink(url, supabase)
        if (destination === "/sifre-yenile") {
          const { data: { user }, error } = await supabase.auth.getUser()
          if (error || !user) {
            destination = invalidLinkPath("recovery")
          } else {
            const cookieStore = await cookies()
            cookieStore.set(RECOVERY_COOKIE, issueRecoveryGrant(user.id), {
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              path: "/sifre-yenile",
              maxAge: 3600,
            })
          }
        }
      } catch {
        destination = invalidLinkPath(parsed.type)
      }
    }
  }

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  const trustedOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ?? (local ? url.origin : "https://kabia-revised.vercel.app")
  const response = NextResponse.redirect(new URL(destination, trustedOrigin), 303)
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
