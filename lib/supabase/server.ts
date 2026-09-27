import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// Server-side Supabase client for Server Components / Route Handlers.
// Reads/writes the auth session via cookies.
//
// Per-IP /token rate limiting (Supabase Auth, 150/5min burst 30) sees only
// Vercel's egress IPs for server-side signIn/refresh, so unrelated traffic
// shares the bucket. When `forwardedFor` carries the real client IP (from
// getClientIp) it is sent as `Sb-Forwarded-For` so Supabase limits per end
// user instead of per egress IP. The header is only honored with a secret
// API key (sb_secret_...) and the dashboard's "IP Address Forwarding" switch
// (Authentication > Rate Limits); with the publishable key it is ignored
// harmlessly. Set SUPABASE_SECRET_KEY in Vercel env when available, otherwise
// the anon key is used and forwarding stays a no-op until then.
// Return type pinned for the same reason as the browser client.
export async function createSupabaseServerClient(options?: {
  /** Real client IP for Supabase per-IP rate limiting (see above). */
  forwardedFor?: string | null
}): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
  const key = secretKey || anonKey
  // Vercel'de env eksikse tüm sayfa error boundary'e düşmesin diye placeholder ile client oluştur.
  // Sorgular hata döner ama sayfa çökmez; log'da anlaşılır mesaj bırakır.
  if (!url || !key) {
    console.error("[supabase] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY eksik — Vercel Environment Variables kontrol edin.")
    // Placeholder URL/key ile hata yerine boş sonuç dönen client
    return createServerClient("https://placeholder.supabase.co", "placeholder-anon-key", {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    })
  }
  // Only a real client address is forwarded. "unknown" (no trusted header)
  // must never be sent: it would collapse every header-less caller into one
  // shared bucket and trip the limit faster, not slower.
  const forwardedIp = options?.forwardedFor?.trim() ?? ""
  const forwardedHeader =
    forwardedIp !== "" && forwardedIp !== "unknown"
      ? { "Sb-Forwarded-For": forwardedIp }
      : null
  return createServerClient(url, key, {
    ...(forwardedHeader ? { global: { headers: forwardedHeader } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called from a Server Component where cookies can't be set — safe to ignore.
        }
      },
    },
  })
}
