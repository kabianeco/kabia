import { unstable_cache } from "next/cache"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Storefront reads cached through the shared anon client — without ever caching
 * a failure.
 *
 * `unstable_cache` stores whatever its function resolves to. The catalogue and
 * producer readers resolve failures to honest shapes (`{ status: "error" }`,
 * an empty shelf), so a single failed query used to become the authoritative
 * value for the whole revalidate window: the sitemap and listings shrank and
 * nothing said so. Here a failure is thrown inside the cache (a rejected
 * execution is never stored) and turned back into the same honest shape
 * outside it, so the next request retries against the database.
 *
 * A missing Supabase env (a build container without secrets) is a failure of
 * the same kind: degraded, logged, and never cached.
 *
 * Not marked server-only: lib/catalog.ts is also imported by two account client
 * pages for its pure mappers, exactly as it was before this module existed.
 */
class UncachedReadFailure extends Error {
  constructor(label: string) {
    super(`[cache] ${label} read failed; not cached`)
    this.name = "UncachedReadFailure"
  }
}

function getAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export function honestCache<A extends unknown[], R>(
  label: string,
  read: (client: SupabaseClient, ...args: A) => Promise<R>,
  isFailure: (result: R) => boolean,
  fallback: R,
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
): (...args: A) => Promise<R> {
  const cached = unstable_cache(
    async (...args: A): Promise<R> => {
      const client = getAnonClient()
      if (!client) throw new UncachedReadFailure(`${label} (Supabase env eksik)`)
      const result = await read(client, ...args)
      if (isFailure(result)) throw new UncachedReadFailure(label)
      return result
    },
    keyParts,
    options,
  )
  return async (...args: A): Promise<R> => {
    try {
      return await cached(...args)
    } catch (error) {
      if (!(error instanceof UncachedReadFailure)) throw error
      console.error(error.message)
      return fallback
    }
  }
}
