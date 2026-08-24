import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

// Singleton browser Supabase client. Uses the anon (publishable) key only —
// the service_role key is NEVER shipped to the client. All data access is
// protected by Row Level Security.
//
// The return type is pinned to `SupabaseClient` rather than inferred from
// `createBrowserClient`. Its `Database = any` default collapses the inferred
// schema generic, which in turn made `auth.*` results implicitly `any` at every
// call site. Pinning it keeps `auth` and `from()` results properly typed.
let browserClient: SupabaseClient | null = null
let cachedUrl: string | null = null
let cachedKey: string | null = null

export function createSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Env değiştiyse (Vercel rebuild sonrası) singleton'u yenile — placeholder cache'ini temizle
  if (browserClient && cachedUrl === url && cachedKey === key) return browserClient
  if (!url || !key) {
    console.error("[supabase] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY eksik (browser) — Vercel env kontrol edin.")
    // Placeholder'ı cache'leme: env düzelince tekrar denenebilsin
    return createBrowserClient("https://placeholder.supabase.co", "placeholder-anon-key")
  }
  cachedUrl = url
  cachedKey = key
  browserClient = createBrowserClient(url, key)
  return browserClient
}
