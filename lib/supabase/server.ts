import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// Server-side Supabase client for Server Components / Route Handlers.
// Reads/writes the auth session via cookies. Uses the anon key only.
// Return type pinned for the same reason as the browser client.
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
  return createServerClient(url, key, {
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
