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

export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error("[supabase] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY eksik (browser) — Vercel env kontrol edin.")
    // Build-time inline env boşsa placeholder ile devam et, runtime hatası yerine sessiz kal
    browserClient = createBrowserClient("https://placeholder.supabase.co", "placeholder-anon-key")
    return browserClient
  }
  browserClient = createBrowserClient(url, key)
  return browserClient
}
