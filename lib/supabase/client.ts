import type { SupabaseClient } from "@supabase/supabase-js"

// Singleton browser Supabase client. Uses the anon (publishable) key only —
// the service_role key is NEVER shipped to the client. All data access is
// protected by Row Level Security.
//
// The return type is pinned to `SupabaseClient` rather than inferred from
// `createBrowserClient`. Its `Database = any` default collapses the inferred
// schema generic, which in turn made `auth.*` results implicitly `any` at every
// call site. Pinning it keeps `auth` and `from()` results properly typed.
//
// §8.3: the implementation (@supabase/ssr, with realtime) is loaded with a
// dynamic import on first use instead of riding in the initial bundle —
// ~65 KB gzipped off the critical parse path. Every call site awaits this
// inside async work; render paths and the first paint never touch it, and
// auth/cart behavior is identical (session resolution just starts after the
// chunk arrives). There is deliberately no synchronous accessor anymore: any
// static import of the implementation would put it back in the bundle.

let browserClient: SupabaseClient | null = null
let cachedUrl: string | null = null
let cachedKey: string | null = null
let inflight: Promise<SupabaseClient> | null = null

export function getSupabaseBrowserClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Env değiştiyse (Vercel rebuild sonrası) singleton'u yenile — placeholder cache'ini temizle
  if (browserClient && cachedUrl === url && cachedKey === key) return Promise.resolve(browserClient)
  if (inflight) return inflight
  if (!url || !key) {
    console.error("[supabase] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY eksik (browser) — Vercel env kontrol edin.")
    // Placeholder'ı cache'leme: env düzelince tekrar denenebilsin
    inflight = import("@supabase/ssr").then(({ createBrowserClient }) => {
      inflight = null
      return createBrowserClient("https://placeholder.supabase.co", "placeholder-anon-key")
    })
    return inflight
  }
  cachedUrl = url
  cachedKey = key
  inflight = import("@supabase/ssr").then(({ createBrowserClient }) => {
    browserClient = createBrowserClient(url, key)
    inflight = null
    return browserClient
  })
  return inflight
}
