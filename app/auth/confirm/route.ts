import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp } from "@/lib/auth/rate-limit"
import { confirmLink, invalidLinkPath, parseConfirmation } from "@/lib/auth/customer-confirm"
import { issueRecoveryGrant, RECOVERY_COOKIE } from "@/lib/auth/recovery-grant"
import { defaultMailer, sendWelcomeEmail, supabaseNotificationStore } from "@/lib/email/notify"
import { FLOW_COOKIES, flowCookieOptions, issueFlowMarker } from "@/lib/auth/flow-marker"
import { siteUrl } from "@/lib/site"

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
        if (destination === "/eposta-degisikligi-onaylandi") {
          // The status page shows only right after a verified change link.
          const cookieStore = await cookies()
          cookieStore.set(FLOW_COOKIES.email_change.name, issueFlowMarker("email_change", "link"), flowCookieOptions("email_change"))
        }
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
        if (destination === "/eposta-onaylandi" && parsed.type === "email") {
          // Welcome: doğrulanmış kayıt — bir kez gönderilir (idempotency
          // anahtarı user_id+kind). Yönlendirmeyi asla bozmaz.
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .maybeSingle()
              const name = (profile as { full_name?: unknown } | null)?.full_name
              await sendWelcomeEmail(supabaseNotificationStore(supabase), defaultMailer, {
                userId: user.id,
                email: user.email,
                name: typeof name === "string" ? name : "",
              })
            }
          } catch (error) {
            console.error("[email] welcome after link confirm failed:", error instanceof Error ? error.message : error)
          }
        }
      } catch {
        destination = invalidLinkPath(parsed.type)
      }
    }
  }

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  const trustedOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ?? (local ? url.origin : siteUrl)
  const response = NextResponse.redirect(new URL(destination, trustedOrigin), 303)
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("Referrer-Policy", "no-referrer")
  return response
}
